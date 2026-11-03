#!/usr/bin/env node

/**
 * Static inventory of Next.js routes, server actions and JSX interactions.
 * The scan is deliberately dependency-free so it remains runnable before install.
 * It reports evidence from source text; it does not claim runtime behaviour.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { inventoryRows, validateInteractionProof } from "./release/interaction-proof.mjs";
import { validateBrowserReport } from "./release/browser-report.mjs";

const root = process.cwd();
const appRoot = path.join(root, "apps", "web", "app");
const webRoot = path.join(root, "apps", "web");
const testRoots = [path.join(root, "apps", "web"), path.join(root, "tests")];
const routeOutput = path.join(root, "docs", "ROUTE_ACTION_MATRIX.md");
const interactionOutput = path.join(root, "docs", "BUTTON_FORM_MATRIX.md");
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const checkOnly = process.argv.includes("--check");
const UNCLASSIFIED = "NON CLASSÉE";
const EXCLUDED = "EXCLUE AVEC RAISON";
const ALLOWED_CLASSIFICATIONS = new Set(["TESTÉE DIRECTEMENT", "COUVERTE PAR TEST PARENT", "DÉCORATIVE JUSTIFIÉE", EXCLUDED]);

const slash = (value) => value.split(path.sep).join("/");
const relative = (value) => slash(path.relative(root, value));
const escapeCell = (value) => String(value ?? "—").replaceAll("|", "\\|").replace(/\r?\n/g, " ").trim() || "—";

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (["node_modules", ".next", "coverage", "test-results", "playwright-report"].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

function routeFromFile(file) {
  const rel = slash(path.relative(appRoot, path.dirname(file)));
  const segments = rel === "" ? [] : rel.split("/");
  const visible = segments.filter((part) => !(part.startsWith("(") && part.endsWith(")")));
  return `/${visible.join("/")}`.replace(/\/$/, "") || "/";
}

function lineAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function inferContext(file, source, route) {
  const normalized = slash(file);
  if (normalized.includes("/(public)/")) return "public";
  if (route.startsWith("/api/workers") || route.startsWith("/api/internal")) return "secret serveur";
  if (route.startsWith("/api/")) return /require(?:Auth|User|Organization)|getUser\s*\(/.test(source) ? "session" : "à vérifier";
  if (/requirePlatformRole|platform_admin|PLATFORM_ADMIN/.test(source) || route.includes("/administration")) return "administration plateforme";
  if (/require(?:Organization|Membership)|organizationId|activeOrganization/.test(source)) return "session + organisation";
  if (/require(?:Auth|User)|getUser\s*\(|auth\.getUser/.test(source)) return "session";
  if (route.startsWith("/[locale]/auth")) return "public/auth";
  return "non déduit";
}

function inferTests(file, route, tests) {
  const stem = path.basename(file).replace(/\.(?:tsx?|jsx?)$/, "");
  const sibling = tests.filter((test) => path.dirname(test.file) === path.dirname(file) && test.file !== file && test.name.startsWith(stem));
  if (sibling.length) return { status: "TESTÉE DIRECTEMENT", evidence: sibling.map((item) => relative(item.file)).join(", ") };
  const literalCandidates = ["fr", "ar"].map((locale) => route
    .replaceAll("[locale]", locale)
    .replace(/\[\.\.\.[^\]]+\]/g, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\/{2,}/g, "/"));
  const parent = tests.filter((test) => literalCandidates.some((literal) => literal.length > 3 && test.source.includes(literal)));
  if (parent.length) return { status: "COUVERTE PAR TEST PARENT", evidence: parent.slice(0, 4).map((item) => relative(item.file)).join(", ") };
  return {
    status: EXCLUDED,
    evidence: "Aucune référence statique de test détectée ; validation runtime ciblée requise avant release.",
    debt: true,
  };
}

function extractExports(source, serverOnly) {
  const rows = [];
  const pattern = /export\s+(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(|async\s+function\s+([A-Za-z_$][\w$]*)\s*\(|function\s+([A-Za-z_$][\w$]*)\s*\()/g;
  for (const match of source.matchAll(pattern)) {
    const name = match[1] || match[2] || match[3];
    if (!name) continue;
    if (serverOnly && !source.slice(0, 300).includes("use server")) continue;
    rows.push({ name, line: lineAt(source, match.index) });
  }
  return rows;
}

function extractInteractions(file, source, route, tests) {
  const rows = [];
  const context = inferContext(file, source, route);
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const supported = new Set(["button", "Button", "Link", "a", "form"]);

  function attribute(opening, name) {
    const property = opening.attributes.properties.find((item) => ts.isJsxAttribute(item) && item.name.text === name);
    if (!property || !ts.isJsxAttribute(property)) return "—";
    if (!property.initializer) return "true";
    if (ts.isStringLiteral(property.initializer)) return property.initializer.text;
    if (ts.isJsxExpression(property.initializer)) {
      return property.initializer.expression ? `{${property.initializer.expression.getText(sourceFile).replace(/\s+/g, " ")}}` : "{}";
    }
    return property.initializer.getText(sourceFile).replace(/\s+/g, " ");
  }

  function staticText(node) {
    if (ts.isJsxText(node)) return node.getText(sourceFile).replace(/\s+/g, " ").trim();
    if (ts.isJsxElement(node)) return node.children.map(staticText).filter(Boolean).join(" ");
    if (ts.isJsxExpression(node) && node.expression && (ts.isStringLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression))) return node.expression.text;
    return "";
  }

  function visit(node) {
    let opening;
    let children = [];
    if (ts.isJsxElement(node)) {
      opening = node.openingElement;
      children = node.children;
    } else if (ts.isJsxSelfClosingElement(node)) {
      opening = node;
    }
    if (opening) {
      const kind = opening.tagName.getText(sourceFile);
      if (supported.has(kind)) {
        const plain = children.map(staticText).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
        const aria = attribute(opening, "aria-label");
        const label = plain || (aria !== "—" ? aria : "dynamique/non statique");
        const href = attribute(opening, "href");
        const action = attribute(opening, "action");
        const onClick = attribute(opening, "onClick");
        const submit = kind === "form" ? action : attribute(opening, "formAction");
        const target = href !== "—" ? href : submit !== "—" ? submit : onClick !== "—" ? onClick : kind === "button" || kind === "Button" ? `type=${attribute(opening, "type")}` : "—";
        const disabled = attribute(opening, "disabled") !== "—" ? "oui" : "non détecté";
        const test = inferTests(file, route, tests);
        rows.push({ route, file: relative(file), line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1, kind, label, target, disabled, context, test });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return rows;
}

const allWebFiles = await walk(webRoot);
const productionWebFiles = allWebFiles.filter((file) => !/\.(?:test|spec)\.[jt]sx?$/.test(file));
const testFiles = [];
for (const testRoot of testRoots) {
  try {
    for (const file of await walk(testRoot)) {
      if (/\.(?:test|spec)\.[jt]sx?$/.test(file) || relative(file).startsWith("tests/e2e/")) {
        testFiles.push({ file, name: path.basename(file), source: await fs.readFile(file, "utf8") });
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const routes = [];
const actions = [];
const interactions = [];
for (const file of productionWebFiles.sort()) {
  const source = await fs.readFile(file, "utf8");
  const name = path.basename(file);
  const inApp = file.startsWith(appRoot);
  let route = inApp ? routeFromFile(file) : `[partagé]/${slash(path.relative(webRoot, path.dirname(file)))}`;
  if (inApp && name === "sitemap.ts") route = "/sitemap.xml";
  if (inApp && name === "robots.ts") route = "/robots.txt";
  if (inApp && name === "manifest.ts") route = "/manifest.webmanifest";
  if (inApp && ["page.tsx", "page.ts", "route.ts", "route.js", "error.tsx", "loading.tsx", "not-found.tsx", "sitemap.ts", "robots.ts", "manifest.ts"].includes(name)) {
    const kind = name.startsWith("page") ? "page" : name.startsWith("route") ? "handler" : ["sitemap.ts", "robots.ts", "manifest.ts"].includes(name) ? "metadata" : name.replace(/\.(?:tsx?|jsx?)$/, "");
    const methods = kind === "handler" ? [...source.matchAll(/export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map((match) => match[1]).join(", ") || "non détecté" : "GET/rendu";
    const test = inferTests(file, route, testFiles);
    routes.push({ route, kind, methods, file: relative(file), context: inferContext(file, source, route), test });
  }
  if (name === "actions.ts" || name.endsWith("-actions.ts") || source.slice(0, 300).includes("use server")) {
    for (const exported of extractExports(source, true)) {
      const test = inferTests(file, route, testFiles);
      actions.push({ route, name: exported.name, file: relative(file), line: exported.line, context: inferContext(file, source, route), test });
    }
  }
  if (/\.[jt]sx$/.test(file)) interactions.push(...extractInteractions(file, source, route, testFiles));
}

const generatedAt = new Date().toISOString();
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const groups = { routes, actions, interactions };
const digestCache = new Map();
for (const row of [...routes, ...actions, ...interactions]) {
  if (!digestCache.has(row.file)) digestCache.set(row.file, createHash("sha256").update(await fs.readFile(path.join(root, row.file))).digest("hex"));
  row.sourceSha256 = digestCache.get(row.file);
}
const inventory = inventoryRows(groups, commit);
const inventoryIndex = process.argv.indexOf("--inventory-json");
if (inventoryIndex >= 0) {
  const output = process.argv[inventoryIndex + 1];
  if (!output) throw new Error("INTERACTION_INVENTORY_OUTPUT_REQUIRED");
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await fs.writeFile(output, JSON.stringify(inventory, null, 2) + "\n", { mode: 0o600 });
}
const proofIndex = process.argv.indexOf("--runtime-proof");
if (proofIndex >= 0) {
  const proofPath = process.argv[proofIndex + 1];
  if (!proofPath) throw new Error("INTERACTION_RUNTIME_PROOF_REQUIRED");
  const proof = JSON.parse(await fs.readFile(proofPath, "utf8"));
  const failures = validateInteractionProof(proof, inventory);
  for (const entry of proof.entries ?? []) {
    try {
      const test = await fs.realpath(path.resolve(root, entry.testSource));
      const artifact = await fs.realpath(path.resolve(root, entry.artifact.path));
      for (const target of [test, artifact]) if (path.relative(root, target).startsWith("..") || path.isAbsolute(path.relative(root, target))) throw new Error("PATH");
      const bytes = await fs.readFile(artifact);
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (actual !== entry.artifact.sha256) throw new Error("DIGEST");
      const report = JSON.parse(bytes.toString("utf8"));
      validateBrowserReport(report);
      let scenarioFound = false;
      const visit = (suite) => {
        for (const spec of suite.specs ?? []) {
          const file = path.isAbsolute(spec.file ?? "") ? path.relative(root, spec.file) : spec.file;
          if (slash(file ?? "") === slash(entry.testSource) && spec.title === entry.scenario) scenarioFound = true;
        }
        for (const child of suite.suites ?? []) visit(child);
      };
      for (const suite of report.suites ?? []) visit(suite);
      if (!scenarioFound) throw new Error("SCENARIO_NOT_EXECUTED");
    } catch { failures.push("INTERACTION_ARTIFACT_INVALID:" + entry.id); }
  }
  if (failures.length) {
    console.error(JSON.stringify({ status: "failed", failures }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ status: "passed", commit, runtimeVerified: inventory.entries.length }));
}
const routeUnclassified = routes.filter((row) => row.test.status === UNCLASSIFIED).length;
const actionUnclassified = actions.filter((row) => row.test.status === UNCLASSIFIED).length;
const interactionUnclassified = interactions.filter((row) => row.test.status === UNCLASSIFIED).length;
const routeExcluded = routes.filter((row) => row.test.status === EXCLUDED).length;
const actionExcluded = actions.filter((row) => row.test.status === EXCLUDED).length;
const interactionExcluded = interactions.filter((row) => row.test.status === EXCLUDED).length;
const countBy = (rows, key) => rows.reduce((counts, row) => ({ ...counts, [row[key]]: (counts[row[key]] || 0) + 1 }), {});
const routeKinds = countBy(routes, "kind");
const interactionKinds = countBy(interactions, "kind");

const routeDocument = `# Matrice routes et actions\n\n` +
`> Générée automatiquement par \`node scripts/audit-interactions.mjs\` le ${generatedAt}. Inventaire statique : une référence de test ne prouve pas que tous les états runtime sont validés.\n\n` +
`## Synthèse\n\n` +
`- Routes/pages/handlers : **${routes.length}** ; **${routeExcluded} exclusions motivées** constituent une dette de validation runtime.\n` +
`- Détail : **${routeKinds.page || 0} pages**, **${routeKinds.handler || 0} handlers**, **${routeKinds.metadata || 0} sorties metadata**, **${routeKinds.error || 0} erreurs**, **${routeKinds.loading || 0} chargements**, **${routeKinds["not-found"] || 0} pages introuvables**.\n` +
`- Actions serveur exportées : **${actions.length}** ; **${actionExcluded} exclusions motivées** constituent une dette de validation runtime.\n` +
`- Les groupes Next.js entre parenthèses sont retirés de l'URL. Les segments dynamiques restent entre crochets.\n\n` +
`## Lecture du classement\n\n` +
`- **TESTÉE DIRECTEMENT** : un test colocalisé portant le même nom de module a été détecté.\n` +
`- **COUVERTE PAR TEST PARENT** : une route localisée correspond à une référence dans un test plus large ; chaque état n'est pas implicitement prouvé.\n` +
`- **DÉCORATIVE JUSTIFIÉE** : réservé aux éléments explicitement non actionnables ; aucun élément n'est classé ainsi par simple heuristique.\n` +
`- **EXCLUE AVEC RAISON** : aucune preuve statique ; dette de validation runtime, jamais comptée comme test réussi.\n\n` +
`## Routes\n\n| Route | Type | Méthodes | Contexte déduit | Fichier | Couverture statique | Preuve ou raison |\n|---|---|---|---|---|---|---|\n` +
routes.map((row) => `| ${escapeCell(row.route)} | ${row.kind} | ${row.methods} | ${row.context} | ${escapeCell(row.file)} | ${row.test.status} | ${escapeCell(row.test.evidence)} |`).join("\n") +
`\n\n## Actions serveur\n\n| Route associée | Action exportée | Contexte déduit | Source | Couverture statique | Preuve ou raison |\n|---|---|---|---|---|---|\n` +
actions.map((row) => `| ${escapeCell(row.route)} | \`${row.name}\` | ${row.context} | ${escapeCell(row.file)}:${row.line} | ${row.test.status} | ${escapeCell(row.test.evidence)} |`).join("\n") +
`\n\n## Limites et vérifications runtime requises\n\n` +
`- Le contexte est une heuristique fondée sur les gardes visibles dans le fichier ; les repositories, RPC et RLS doivent être audités séparément.\n` +
`- Les routes dynamiques nécessitent des fixtures valides pour vérifier succès, interdit, introuvable et isolation inter-organisation.\n` +
`- Les ${routeExcluded + actionExcluded} exclusions motivées ne sont pas déclarées testées et doivent recevoir une preuve runtime avant release.\n`;

const interactionDocument = `# Matrice boutons, liens et formulaires\n\n` +
`> Générée automatiquement par \`node scripts/audit-interactions.mjs\` le ${generatedAt}. Le scan couvre \`button\`, \`Button\`, \`Link\`, \`a\` et \`form\` dans le code produit sous \`apps/web\` (tests exclus).\n\n` +
`## Synthèse\n\n` +
`- Interactions JSX détectées : **${interactions.length}**.\n` +
`- Détail : **${interactionKinds.button || 0} button**, **${interactionKinds.Button || 0} Button**, **${interactionKinds.Link || 0} Link**, **${interactionKinds.a || 0} liens natifs**, **${interactionKinds.form || 0} formulaires**.\n` +
`- Référencées par un test direct ou parent : **${interactions.length - interactionExcluded}**.\n` +
`- Exclusions motivées : **${interactionExcluded}**. Elles constituent une dette de validation runtime ; aucune n'est présentée comme couverte.\n` +
`- Un libellé « dynamique/non statique » exige une inspection runtime FR/AR et accessibilité.\n\n` +
`## Lecture du classement\n\n` +
`Les quatre valeurs admises sont **TESTÉE DIRECTEMENT**, **COUVERTE PAR TEST PARENT**, **DÉCORATIVE JUSTIFIÉE** et **EXCLUE AVEC RAISON**. Le scanner n'attribue jamais automatiquement le statut décoratif. Une exclusion est une dette runtime explicite, pas une preuve de réussite.\n\n` +
`## Inventaire\n\n| Route source | Élément | Libellé statique | Destination/action détectée | Auth/contexte déduit | Disabled détecté | Source | Classement test | Preuve ou raison |\n|---|---|---|---|---|---|---|---|---|\n` +
interactions.map((row) => `| ${escapeCell(row.route)} | ${row.kind} | ${escapeCell(row.label)} | ${escapeCell(row.target)} | ${row.context} | ${row.disabled} | ${escapeCell(row.file)}:${row.line} | ${row.test.status} | ${escapeCell(row.test.evidence)} |`).join("\n") +
`\n\n## États à valider dans les tests runtime\n\n` +
`Pour chaque action métier : préconditions, validation serveur, chargement, désactivation, succès réel, erreur métier/réseau/serveur, retry, double clic/idempotence, retour arrière, expiration de session, rôle et organisation incorrects, clavier/focus, FR, AR/RTL et mobile. Le présent scan ne déduit pas ces états et ne les marque donc pas implicitement PASS.\n\n` +
`## Limites du scan\n\n` +
`- Les composants qui rendent indirectement une interaction et les éléments créés par une fonction factory peuvent nécessiter une revue AST/runtime complémentaire.\n` +
`- La présence d'un chemin dans un test parent établit une référence, pas une assertion sur chaque bouton.\n` +
`- Les handlers attachés par propagation de props peuvent apparaître comme expressions dynamiques ; leur action doit être rapprochée du composant parent.\n`;

const allRows = [...routes, ...actions, ...interactions];
const invalidExclusions = allRows.filter((row) => row.test.status === EXCLUDED && (!row.test.evidence || row.test.evidence.trim().length < 20));
const invalidClassifications = allRows.filter((row) => !ALLOWED_CLASSIFICATIONS.has(row.test.status));
if (routeUnclassified + actionUnclassified + interactionUnclassified > 0 || invalidExclusions.length > 0 || invalidClassifications.length > 0) {
  console.error(JSON.stringify({ routeUnclassified, actionUnclassified, interactionUnclassified, invalidExclusions: invalidExclusions.length, invalidClassifications: invalidClassifications.length }, null, 2));
  process.exitCode = 1;
} else if (checkOnly) {
  console.log(JSON.stringify({ check: "PASS", claim: "STATIC_INVENTORY_ONLY", routes: routes.length, actions: actions.length, interactions: interactions.length, runtimeValidationDebt: routeExcluded + actionExcluded + interactionExcluded }, null, 2));
} else {
  await fs.mkdir(path.dirname(routeOutput), { recursive: true });
  await fs.writeFile(routeOutput, routeDocument, "utf8");
  await fs.writeFile(interactionOutput, interactionDocument, "utf8");
  console.log(JSON.stringify({ routes: routes.length, actions: actions.length, interactions: interactions.length, routeExcluded, actionExcluded, interactionExcluded }, null, 2));
}
