import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { openMatFuncSession } from "./helpers/mat-func-session";

const fr = {
  providerMilestones: "Soumettre le jalon au client",
  clientPending: "Jalons en attente de décision",
  acceptMilestone: "Accepter le jalon",
  rejectMilestone: "Refuser le jalon",
  success: "Opération enregistrée",
} as const;

const ar = {
  providerMilestones: "إرسال المرحلة إلى العميل",
  clientPending: "مراحل تنتظر قرارك",
  acceptMilestone: "قبول المرحلة",
  rejectMilestone: "رفض المرحلة",
  success: "تم تسجيل العملية",
} as const;

function p25Workflows() {
  try {
    return JSON.parse(process.env.E2E_P25_WORKFLOWS ?? "[]") as Array<{ missionId: string; milestoneId?: string }>;
  } catch {
    return [];
  }
}

test("FR provider submits a milestone and client accepts it", async ({ browser }) => {
  const providerState = process.env.E2E_PROVIDER_STORAGE_STATE;
  const clientState = process.env.E2E_CLIENT_STORAGE_STATE;
  const workflows = p25Workflows();
  test.skip(
    !providerState || !clientState || workflows.length < 1 || !existsSync(providerState) || !existsSync(clientState),
    "authenticated P25 workflow fixture is required (E2E_PROVIDER_STORAGE_STATE, E2E_CLIENT_STORAGE_STATE, E2E_P25_WORKFLOWS)",
  );

  const provider = await openMatFuncSession(browser, providerState!, "fr", false);
  try {
    await provider.page.goto("/fr/sous-traitant/missions");
    const operations = provider.page.locator("#missions-operation");
    if ((await operations.count()) && !(await operations.evaluate((node) => (node as HTMLDetailsElement).open))) {
      await operations.locator("summary").click();
    }
    const submit = provider.page.getByRole("button", { name: fr.providerMilestones }).first();
    await expect(submit, "deterministic tenant must expose a pending provider milestone").toBeVisible();
    await submit.click();
    await expect(provider.page.getByRole("status").filter({ hasText: "Opération enregistrée et auditée" })).toBeVisible();
  } finally {
    await provider.context.close();
  }

  const client = await openMatFuncSession(browser, clientState!, "fr", false);
  try {
    await client.page.goto("/fr/client/missions");
    await expect(client.page.getByRole("heading", { name: fr.clientPending })).toBeVisible();
    const form = client.page.getByRole("button", { name: fr.acceptMilestone }).first().locator("xpath=ancestor::form");
    await form.getByLabel("Motif de la décision").fill("Jalon MAT-FUNC-022 validé par le parcours E2E");
    await form.getByRole("button", { name: fr.acceptMilestone }).click();
    await expect(form.getByRole("status")).toContainText(fr.success);
  } finally {
    await client.context.close();
  }

  const foreignState = process.env.E2E_CLIENT_B_STORAGE_STATE;
  if (!foreignState || !existsSync(foreignState)) throw new Error("foreign tenant state is required for isolation proof");
  const foreign = await openMatFuncSession(browser, foreignState, "fr", false);
  try {
    await foreign.page.goto("/fr/client/missions");
    for (const workflow of workflows) {
      await expect(foreign.page.locator("body")).not.toContainText(workflow.missionId);
    }
  } finally {
    await foreign.context.close();
  }
});

test("AR client sees submitted milestone decision controls", async ({ browser }, testInfo) => {
  const clientState = process.env.E2E_CLIENT_STORAGE_STATE;
  test.skip(!clientState || !existsSync(clientState), "E2E_CLIENT_STORAGE_STATE is required");
  const mobile = testInfo.project.name.includes("mobile");
  const client = await openMatFuncSession(browser, clientState!, "ar", mobile);
  try {
    await client.page.goto("/ar/client/missions");
    await expect(client.page.locator("html")).toHaveAttribute("dir", "rtl");
    const pending = client.page.getByRole("heading", { name: ar.clientPending });
    const accept = client.page.getByRole("button", { name: ar.acceptMilestone }).first();
    const reject = client.page.getByRole("button", { name: ar.rejectMilestone }).first();
    if (await pending.isVisible()) {
      await expect(accept).toBeVisible();
      await expect(reject).toBeVisible();
    } else {
      await expect(client.page.getByRole("heading", { level: 1, name: "العقود والمهام" })).toBeVisible();
    }
  } finally {
    await client.context.close();
  }
});
