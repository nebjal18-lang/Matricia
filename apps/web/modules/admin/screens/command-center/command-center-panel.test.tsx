import{renderToStaticMarkup}from"react-dom/server";import type{ComponentPropsWithoutRef}from"react";import{describe,expect,it,vi}from"vitest";vi.mock("@/modules/shared/ui/button",()=>({Button:({children,variant,...props}:ComponentPropsWithoutRef<"button">&{variant?:string})=><button data-variant={variant}{...props}>{children}</button>}));vi.mock("@/modules/shared/ui/input",()=>({Input:(p:ComponentPropsWithoutRef<"input">)=><input{...p}/> }));vi.mock("@/modules/shared/ui/label",()=>({Label:({children,...p}:ComponentPropsWithoutRef<"label">)=><label{...p}>{children}</label>}));vi.mock("@/modules/shared/ui/textarea",()=>({Textarea:(p:ComponentPropsWithoutRef<"textarea">)=><textarea{...p}/> }));vi.mock("./actions",()=>({claimAdminWork:async()=>({status:"idle"}),resolveAdminWork:async()=>({status:"idle"}),requestActionFromCenter:async()=>({status:"idle"}),decideAdminAction:async()=>({status:"idle"}),sweepExceptionsFromCenter:async()=>({status:"idle"})}));import{CommandCenterPanel}from"./command-center-panel";import{getCommandCenterMessages}from"./messages";const id="11111111-1111-4111-8111-111111111111";const dashboard={workItems:[{id,queueKey:"EXCEPTIONS",queueLabelFr:"Exceptions",queueLabelAr:"الاستثناءات",organizationId:null,sourceKind:"EXCEPTION",resourceType:"case",resourceId:"C-1",titleFr:"Décision requise",titleAr:"قرار مطلوب",priority:"CRITICAL"as const,status:"OPEN",dueAt:"2026-09-12T10:00:00.000Z",assignedTo:null,rowVersion:1}],actions:[{id,workItemId:null,organizationId:null,actionType:"SUSPEND_ENTITY",targetEnvironment:"STAGING",resourceType:"provider",resourceId:"P-1",reason:"Contrôle humain requis",approvalsRequired:2,status:"PENDING_APPROVAL",requestedAt:"2026-09-12T09:00:00.000Z",rowVersion:1}]};const keys=Array.from({length:4},(_,i)=>`${i+1}`.padStart(8,"0")+"-0000-4000-8000-000000000000");describe("CommandCenterPanel",()=>{it("associe chaque champ à un libellé et expose des retours live",()=>{const html=renderToStaticMarkup(<CommandCenterPanel dashboard={dashboard}locale="fr"m={getCommandCenterMessages("fr")}keys={keys}currentTime="2026-09-12T12:00:00.000Z"/>);const controls=[...html.matchAll(/<(?:input|select|textarea)[^>]*\sid="([^"]+)"/g)].map(x=>x[1]),labels=[...html.matchAll(/<label[^>]+for="([^"]+)"/g)].map(x=>x[1]);expect(labels.filter(x=>!controls.includes(x))).toEqual([]);expect((html.match(/aria-live="polite"/g)??[]).length).toBeGreaterThanOrEqual(4);expect(html).toContain("Dossier concerné");expect(html).not.toMatch(/UUID|JSON|SHA-256/);expect(html).toContain('name="workItemId"');expect(html).toContain("Balayer les exceptions métier")});it("rend l’arabe RTL dans un conteneur mobile sans largeur fixe",()=>{const html=renderToStaticMarkup(<div dir="rtl"lang="ar"><CommandCenterPanel dashboard={dashboard}locale="ar"m={getCommandCenterMessages("ar")}keys={keys}currentTime="2026-09-12T12:00:00.000Z"/></div>);expect(html).toContain('dir="rtl"');expect(html).toContain("مهام اليوم");expect(html).toContain("w-full sm:w-auto");expect(html).not.toMatch(/(?:min-w|max-w|w)-\[(?:[4-9]\d\d|\d{4,})px\]/)})});

it.each(["fr", "ar"] as const)("keeps organization and search when changing the approval status in %s", locale => {
  const html = renderToStaticMarkup(<CommandCenterPanel dashboard={{ ...dashboard, workItems: [{ ...dashboard.workItems[0]!, resourceType: "QUOTE", resourceId: "quote-123" }], actionPage: 3, actionStatus: "FAILED" }} query="?organizationId=org-1&q=review&actionPage=3&actionStatus=FAILED" locale={locale} m={getCommandCenterMessages(locale)} keys={keys} currentTime="2026-09-12T12:00:00.000Z" />);
  const filterForm = html.match(/<form\b(?=[^>]*method="get")[\s\S]*?<\/form>/)?.[0];
  expect(filterForm).toBeDefined();
  expect(filterForm).toContain('name="organizationId" value="org-1"');
  expect(filterForm).toContain('name="q" value="review"');
  expect(filterForm).not.toContain('name="actionPage"');
  expect(html).toContain(`/${locale}/administration/devis/quote-123?organizationId=org-1`);
});

it("surfaces SLA breach and keeps claim collapsed until opened", () => {
  const html = renderToStaticMarkup(
    <CommandCenterPanel
      dashboard={dashboard}
      locale="fr"
      m={getCommandCenterMessages("fr")}
      keys={keys}
      currentTime="2026-11-13T12:00:00.000Z"
    />,
  );
  expect(html).toContain("SLA dépassé");
  expect(html).toContain('data-overdue="true"');
  expect(html).toContain("<summary>Prendre en charge</summary>");
  expect(html).toMatch(/<details class="admin-work-action-form">\s*<summary>Prendre en charge<\/summary>/);
  expect(html).not.toMatch(/<details class="admin-work-action-form" open>\s*<summary>Prendre en charge<\/summary>/);
  expect(html.indexOf("<summary>Prendre en charge</summary>")).toBeLessThan(html.indexOf('name="reason"'));
});

it("humanizes executed sensitive actions without dumping raw technical payloads", () => {
  const resourceId = "5a4a029f-1234-4abc-8def-abcdef012345";
  const resultHash = "ea42a6c0123456789abcdef0123456789abcdef0123456789abcdef012345678";
  const html = renderToStaticMarkup(
    <CommandCenterPanel
      dashboard={{
        ...dashboard,
        actions: [{
          ...dashboard.actions[0]!,
          actionType: "MANUAL_EXCEPTION",
          targetEnvironment: "DEVELOPMENT",
          resourceType: "ORGANIZATION",
          resourceId,
          status: "EXECUTED",
          executedAt: "2026-11-08T01:10:27.679938+00:00",
          resultHash,
          reason: "Révision canonique de l’identité prestataire pour le parcours de développement",
        }],
      }}
      locale="fr"
      m={getCommandCenterMessages("fr")}
      keys={keys}
      currentTime="2026-11-08T12:00:00.000Z"
    />,
  );
  expect(html).toContain("Entreprise");
  expect(html).toContain("Preuve d’exécution");
  expect(html).toContain('data-tone="ok"');
  expect(html).toContain(`title="${resourceId}"`);
  expect(html).toContain(`title="${resultHash}"`);
  expect(html).not.toContain(`ORGANIZATION/${resourceId}`);
  expect(html).not.toMatch(new RegExp(`>${resultHash}<`));
  expect(html).not.toMatch(/>2026-11-08T01:10:27/);
});
