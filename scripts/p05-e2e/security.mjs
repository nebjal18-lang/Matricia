import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { chmod, readFile, stat } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CHILD_ENV_ALLOWLIST = new Set([
  "CI", "E2E_LOCAL_ISOLATED", "E2E_LOCAL_PROJECT_ID", "COREPACK_HOME", "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH", "PLAYWRIGHT_VIDEO", "COLORTERM", "ComSpec", "FORCE_COLOR", "HOME", "HOMEDRIVE", "HOMEPATH", "LANG", "LOCALAPPDATA",
  "NO_COLOR", "NUMBER_OF_PROCESSORS", "OS", "PATH", "PATHEXT", "ProgramData", "ProgramFiles", "ProgramFiles(x86)",
  "SystemDrive", "SystemRoot", "TEMP", "TERM", "TMP", "USERPROFILE", "windir",
]);

export function buildChildEnvironment(source, additions) {
  const environment = {};
  for (const [key, value] of Object.entries(source)) {
    if (CHILD_ENV_ALLOWLIST.has(key) && typeof value === "string") environment[key] = value;
  }
  for (const [key, value] of Object.entries(additions)) {
    if (!key.startsWith("E2E_") && key !== "PLAYWRIGHT_JSON_OUTPUT_FILE") throw new Error("Unsafe child environment key");
    environment[key] = value;
  }
  return environment;
}

export async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export async function validateFreshManifest(manifest, config, now = Date.now()) {
  if (manifest?.schemaVersion !== 1 || manifest?.environment !== config.environment || manifest?.projectRef !== config.projectRef
      || manifest?.baseUrl !== config.baseUrl || !/^[a-z0-9-]{8,64}$/.test(manifest?.runId ?? "")) {
    throw new Error("P05 E2E manifest context mismatch");
  }
  const createdAt = Date.parse(manifest.createdAt);
  const expiresAt = Date.parse(manifest.expiresAt);
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || createdAt > now + 5_000
      || now - createdAt > 120_000 || expiresAt <= now || expiresAt - createdAt > 600_000) {
    throw new Error("P05 E2E manifest is stale");
  }
  for (const key of ["clientA", "clientB", "centralAal1", "centralAal2", "noRole"]) {
    const state = manifest.states?.[key];
    if (!state?.path || !/^[0-9a-f]{64}$/.test(state.sha256) || await sha256File(state.path) !== state.sha256) {
      throw new Error("P05 E2E storage state integrity failure");
    }
  }
  return manifest;
}

async function windowsIdentity() {
  const { stdout } = await execFileAsync("whoami.exe", ["/user", "/fo", "csv", "/nh"], { windowsHide: true });
  const match = stdout.match(/^"([^"]+)","(S-(?:\d+-)+\d+)"/);
  if (!match) throw new Error("Unable to resolve the Windows owner SID");
  return { name: match[1], sid: match[2] };
}

async function setWindowsAcl(path, owner, directory) {
  const inheritance = directory ? "(OI)(CI)F" : "F";
  await execFileAsync("icacls.exe", [path, "/inheritance:r", "/grant:r", `*${owner.sid}:${inheritance}`, `*S-1-5-18:${inheritance}`], { windowsHide: true });
  const { stdout } = await execFileAsync("icacls.exe", [path], { windowsHide: true });
  validateWindowsAclOutput(stdout, owner);
}

export function validateWindowsAclOutput(stdout, owner) {
  const aces = stdout.split(/\r?\n/).map((line) => line.trim()).flatMap((line) => {
    const match = line.match(/^(.*?):\s*((?:\([^)]+\))+\s*)$/);
    if (!match) return [];
    return [{ principal: match[1].trim(), rights: match[2].trim() }];
  });
  const normalizedOwner = owner.name.toLowerCase();
  const isOwner = (principal) => principal.toLowerCase() === normalizedOwner
    || principal.toLowerCase().endsWith(` ${normalizedOwner}`)
    || principal.toUpperCase() === owner.sid.toUpperCase()
    || principal.toUpperCase().endsWith(` ${owner.sid.toUpperCase()}`);
  const isSystem = (principal) => {
    const normalized = principal.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\uFFFD/g, "E").toUpperCase();
    return /(?:^| )(?:S-1-5-18|SYSTEM|SYSTEME|(?:NT AUTHORITY|AUTORITE NT|NT-AUTORITAT|AUTORIDAD NT)\\(?:SYSTEM|SYSTEME))$/.test(normalized);
  };
  const isFullControl = (rights) => /^(?:(?:\(OI\)|\(CI\)){0,2})\(F\)$/.test(rights)
    && (rights.match(/\(OI\)/g)?.length ?? 0) <= 1 && (rights.match(/\(CI\)/g)?.length ?? 0) <= 1;
  if (aces.length !== 2 || aces.some(({ rights }) => !isFullControl(rights))
      || stdout.toLowerCase().includes("deny") || aces.filter(({ principal }) => isOwner(principal)).length !== 1
      || aces.filter(({ principal }) => isSystem(principal)).length !== 1) {
    throw new Error("P05 E2E Windows ACL verification failed");
  }
}

export async function secureLocalPaths(directory, files, dependencies = {}) {
  const platform = dependencies.platform ?? process.platform;
  const resolveWindowsIdentity = dependencies.windowsIdentity ?? windowsIdentity;
  const applyWindowsAcl = dependencies.setWindowsAcl ?? setWindowsAcl;
  const chmodPath = dependencies.chmod ?? chmod;
  const statPath = dependencies.stat ?? stat;
  if (platform === "win32") {
    const owner = await resolveWindowsIdentity();
    await applyWindowsAcl(directory, owner, true);
    for (const file of files) await applyWindowsAcl(file, owner, false);
    return;
  }
  await chmodPath(directory, 0o700);
  for (const file of files) await chmodPath(file, 0o600);
  const modes = await Promise.all([statPath(directory), ...files.map((file) => statPath(file))]);
  if ((modes[0].mode & 0o777) !== 0o700 || modes.slice(1).some((value) => (value.mode & 0o777) !== 0o600)) {
    throw new Error("P05 E2E POSIX permissions verification failed");
  }
}
