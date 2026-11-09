import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { openMatFuncSession } from "./helpers/mat-func-session";

type SnapshotFixture = {
  missionId: string;
  templateVersion: number;
  templateHashPrefix: string;
  publishedTemplateVersion?: number;
};

function parseSnapshotFixture(): SnapshotFixture | null {
  const raw = process.env.E2E_MAT_FUNC_024_SNAPSHOT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SnapshotFixture;
    if (
      !parsed.missionId ||
      typeof parsed.templateVersion !== "number" ||
      typeof parsed.templateHashPrefix !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

test("FR provider mission exposes frozen checklist template version and hash", async ({ browser }, testInfo) => {
  const providerState = process.env.E2E_PROVIDER_STORAGE_STATE;
  test.skip(!providerState || !existsSync(providerState), "E2E_PROVIDER_STORAGE_STATE is required");
  const mobile = testInfo.project.name.includes("mobile");
  const provider = await openMatFuncSession(browser, providerState!, "fr", mobile);
  try {
    await provider.page.goto("/fr/sous-traitant/missions");
    await expect(provider.page.getByRole("heading", { level: 1, name: "Missions & livrables" })).toBeVisible();
    const operations = provider.page.locator("#missions-operation");
    if ((await operations.count()) && !(await operations.evaluate((node) => (node as HTMLDetailsElement).open))) {
      await operations.locator("summary").click();
    }
    const checklistHeading = provider.page.getByRole("heading", { name: "Checklist contractuelle" }).first();
    await expect(checklistHeading).toBeVisible();
    const empty = provider.page.getByText("Aucune obligation de checklist.");
    test.skip(await empty.isVisible(), "provider missions need seeded checklist snapshot items (extend P25 fixture)");
    const frozenLine = provider.page.getByText(/Modèle publié\s+\d+\s+·\s+[a-f0-9]{12}/i).first();
    await expect(frozenLine).toBeVisible();
    const text = await frozenLine.innerText();
    expect(text).toMatch(/Modèle publié\s+\d+\s+·\s+[a-f0-9]{12}/i);
  } finally {
    await provider.context.close();
  }
});

test("AR provider checklist snapshot line is visible at 360 px", async ({ browser }) => {
  const providerState = process.env.E2E_PROVIDER_STORAGE_STATE;
  test.skip(!providerState || !existsSync(providerState), "E2E_PROVIDER_STORAGE_STATE is required");
  const provider = await openMatFuncSession(browser, providerState!, "ar", true);
  try {
    await provider.page.goto("/ar/sous-traitant/missions");
    await expect(provider.page.locator("html")).toHaveAttribute("dir", "rtl");
    const operations = provider.page.locator("#missions-operation");
    if ((await operations.count()) && !(await operations.evaluate((node) => (node as HTMLDetailsElement).open))) {
      await operations.locator("summary").click();
    }
    test.skip(await provider.page.getByText("لا توجد التزامات في قائمة التحقق.").isVisible(), "provider missions need seeded checklist snapshot items (extend P25 fixture)");
    await expect(provider.page.getByText(/النموذج المنشور\s+\d+\s+·\s+[a-f0-9]{12}/i).first()).toBeVisible();
  } finally {
    await provider.context.close();
  }
});

test("frozen mission checklist stays on historical template after publish bump", async ({ browser }) => {
  const fixture = parseSnapshotFixture();
  test.skip(
    !fixture,
    "E2E_MAT_FUNC_024_SNAPSHOT must reference a mission pinned before a newer template publish ({ missionId, templateVersion, templateHashPrefix, publishedTemplateVersion? })",
  );
  const providerState = process.env.E2E_PROVIDER_STORAGE_STATE;
  test.skip(!providerState || !existsSync(providerState), "E2E_PROVIDER_STORAGE_STATE is required");

  const provider = await openMatFuncSession(browser, providerState!, "fr", false);
  try {
    await provider.page.goto(`/fr/sous-traitant/missions/${fixture!.missionId}`);
    const line = provider.page.getByText(new RegExp(`Modèle publié\\s+${fixture!.templateVersion}\\s+·\\s+${fixture!.templateHashPrefix}`, "i"));
    await expect(line).toBeVisible();
    if (fixture!.publishedTemplateVersion && fixture!.publishedTemplateVersion !== fixture!.templateVersion) {
      await expect(provider.page.locator("body")).not.toContainText(
        `Modèle publié ${fixture!.publishedTemplateVersion}`,
      );
    }
  } finally {
    await provider.context.close();
  }
});
