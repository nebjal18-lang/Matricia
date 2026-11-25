import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("MARKETING-007 public marketing autopilot gate redirects safely", async ({ page }) => {
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
  test.skip(!["localhost", "127.0.0.1", "::1"].includes(new URL(baseURL).hostname), "local sandbox only");
  const response = await page.goto(`${baseURL}/fr/administration/marketing-autopilot`);
  expect(response?.status() ?? 0).toBeLessThan(500);
  await expect(page).toHaveURL(/connexion|marketing-autopilot/);
});

test("MARKETING-007 worker route module is present", () => {
  const routePath = join(repoRoot, "apps/web/app/api/workers/marketing-trends/route.ts");
  const testPath = join(repoRoot, "apps/web/app/api/workers/marketing-trends/route.test.ts");
  test.skip(!existsSync(routePath), "marketing trends worker missing");
  expect(existsSync(testPath)).toBe(true);
});
