import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/admin/data/spaces/context", () => ({
  resolveAdminSpace: async () => ({ status: "success", selectedQuery: "", selectedOrganizationId: null, userEmail: "admin@example.invalid" }),
}));
vi.mock("@/modules/admin/data/command-center/repository", () => ({
  loadAdminCommandCenter: async () => ({ status: "success", dashboard: { workItems: [], actions: [] } }),
}));
vi.mock("@/modules/admin/data/supervision/repository", () => ({
  loadAdminSupervisionDashboard: async () => ({ status: "success", value: { work_enrichment: {} } }),
}));
vi.mock("@/modules/admin/ui/admin-app-shell", () => ({
  AdminAppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("./command-center-panel", () => ({
  CommandCenterPanel: () => <section id="command-work-items"><article id="work-test">Task</article></section>,
}));
import AdminCommandCenterPage from "@/app/[locale]/administration/command-center/page";

describe("command center task visibility", () => {
  it.each(["fr", "ar"] as const)("opens the task queue before the directory without needing a search in %s", async locale => {
    const html = renderToStaticMarkup(await AdminCommandCenterPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }));
    expect(html).toContain('id="command-today"');
    expect(html).toContain("admin-command-surface");
    expect(html.indexOf('id="command-today"')).toBeLessThan(html.indexOf('admin-home-page'));
    expect(html.match(/id="command-today"/g)).toHaveLength(1);
    expect(html).toContain('id="work-test"');
  });
});
