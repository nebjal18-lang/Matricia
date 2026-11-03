import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const requireFromRoot = createRequire(resolve(root, "package.json"));
const { chromium } = requireFromRoot("@playwright/test");

const outDir = resolve(root, ".tmp/pixel-connected");
mkdirSync(outDir, { recursive: true });
const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";
const persona = process.argv[2] || "franchise";
const route = process.argv[3] || "franchise/accueil";
const outName = process.argv[4] || `${persona}-accueil.png`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: "fr-MA" });
const page = await context.newPage();
await page.goto(`${base}/fr/connexion`, { waitUntil: "networkidle", timeout: 90_000 });
// Prefer explicit demo persona button
const demoBtn = page.getByRole("button", { name: /franchis|client|prestataire|admin|démo|demo/i }).filter({ hasText: new RegExp(persona === "franchise" ? "franchis" : persona === "provider" ? "prestataire|sous-trait" : persona, "i") }).first();
if (await demoBtn.count()) {
  await Promise.all([
    page.waitForURL(new RegExp(`/${persona === "admin" ? "administration" : persona === "provider" ? "tableau|fournisseur|prestataire" : persona}`), { timeout: 60_000 }).catch(() => null),
    demoBtn.click(),
  ]);
} else {
  // Fallback: submit form with persona field
  await page.locator(`input[name="persona"][value="${persona}"], button[value="${persona}"]`).first().click({ timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(2000);
}
await page.goto(`${base}/fr/${route}`, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: resolve(outDir, outName), fullPage: false });
console.log("wrote", resolve(outDir, outName), "url=", page.url());
await browser.close();
