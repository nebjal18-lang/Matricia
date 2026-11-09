import { validFixtureProject } from "./helpers/fixture-project.mjs";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { openMatFuncSession } from "./helpers/mat-func-session";

const copy = {
  fr: {
    title: "Documents",
    link: "Lier un document",
    submit: "Créer la liaison",
    success: "Opération enregistrée.",
    purpose: "Réutilisation contrôlée MAT-FUNC-028 depuis le coffre Client",
  },
  ar: {
    title: "الوثائق",
    link: "ربط مستند",
    submit: "إنشاء الوصلة",
    success: "تم تسجيل العملية.",
    purpose: "إعادة استخدام خاضعة للرقابة MAT-FUNC-028",
  },
} as const;

type Manifest = {
  schemaVersion: number;
  environment?: string;
  projectRef: string;
  runId: string;
  createdAt: string;
  expiresAt: string;
  states: { clientA: { path: string }; clientB: { path: string } };
  fixtures: {
    organizationA: { id: string; name: string };
    organizationB: { id: string; name: string };
    document: { id: string; status: string };
  };
  proof: Record<string, unknown>;
};

function loadReuseManifest(): Manifest | null {
  const path = process.env.E2E_P05_MANIFEST;
  if (!path) return null;
  try {
    const manifest = JSON.parse(readFileSync(path, "utf8")) as Manifest;
    const now = Date.now();
    if (
      manifest.schemaVersion !== 1 ||
      !validFixtureProject(manifest) ||
      now - Date.parse(manifest.createdAt) > 120_000 ||
      Date.parse(manifest.expiresAt) <= now
    ) {
      return null;
    }
    return manifest;
  } catch {
    return null;
  }
}

function storageForClientA(manifest: Manifest | null) {
  const fromManifest = manifest?.states.clientA.path;
  const configured = process.env.E2E_CLIENT_STORAGE_STATE;
  if (fromManifest && configured && fromManifest !== configured) return null;
  return configured ?? fromManifest ?? null;
}

function storageForClientB(manifest: Manifest | null) {
  const fromManifest = manifest?.states.clientB.path;
  const configured = process.env.E2E_CLIENT_B_STORAGE_STATE;
  if (fromManifest && configured && fromManifest !== configured) return null;
  return configured ?? fromManifest ?? null;
}

test("FR links a verified compliance document to another authorized context", async ({ browser }, testInfo) => {
  const manifest = loadReuseManifest();
  const clientState = storageForClientA(manifest);
  test.skip(
    !clientState || !existsSync(clientState),
    "E2E_CLIENT_STORAGE_STATE or fresh E2E_P05_MANIFEST clientA state is required",
  );
  const mobile = testInfo.project.name.includes("mobile");
  const client = await openMatFuncSession(browser, clientState!, "fr", mobile);
  try {
    await client.page.goto("/fr/client/documents");
    await expect(client.page.getByRole("heading", { level: 1, name: copy.fr.title })).toBeVisible();
    const form = client.page.locator("form").filter({ has: client.page.locator('select[name="documentId"]') }).first();
    if (await form.count()) {
      const documentSelect = form.locator('select[name="documentId"]');
      const targetSelect = form.locator("select").filter({ hasNot: documentSelect }).first();
      const documentOptions = await documentSelect.locator("option").count();
      const targetOptions = await targetSelect.locator("option").count();
      test.skip(documentOptions < 2 || targetOptions < 2, "vault must contain a reusable VERIFIED document and at least one link target");
      await documentSelect.selectOption({ index: 1 });
      await targetSelect.selectOption({ index: 1 });
      await form.locator('[name="purpose"]').fill(copy.fr.purpose);
      await form.getByRole("button", { name: copy.fr.submit }).click();
      await expect(form.getByRole("status")).toContainText(copy.fr.success);
    } else {
      await expect(client.page.getByText(copy.fr.link)).toBeVisible();
    }
    if (manifest) {
      await expect(client.page.getByText(manifest.fixtures.organizationA.name, { exact: true }).first()).toBeVisible();
      await expect(client.page.getByText(manifest.fixtures.organizationB.name, { exact: true })).toHaveCount(0);
    }
  } finally {
    await client.context.close();
  }
});

test("AR outsider cannot read another organization vault content", async ({ browser }) => {
  const manifest = loadReuseManifest();
  const foreignState = storageForClientB(manifest);
  test.skip(!foreignState || !existsSync(foreignState), "E2E_CLIENT_B_STORAGE_STATE is required");
  const foreign = await openMatFuncSession(browser, foreignState!, "ar", true);
  try {
    await foreign.page.goto("/ar/client/documents");
    await expect(foreign.page.locator("html")).toHaveAttribute("dir", "rtl");
    if (manifest) {
      await expect(foreign.page.getByText(manifest.fixtures.organizationA.name, { exact: true })).toHaveCount(0);
    }
    await expect(foreign.page.getByRole("heading", { level: 1, name: copy.ar.title })).toBeVisible();
  } finally {
    await foreign.context.close();
  }
});
