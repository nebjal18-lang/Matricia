"use client";

import { useActionState, useId } from "react";
import { Alert, AlertDescription } from "@/modules/shared/ui/alert";
import { Badge } from "@/modules/shared/ui/badge";
import { Button } from "@/modules/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { Label } from "@/modules/shared/ui/label";
import type { RuleValidationWorkspace } from "@/modules/shared/lib/rule-validation/model";
import { simulateRules, validateRules, type RuleValidationActionState } from "./actions";
import type { RuleValidationMessages } from "./messages";

const initialState: RuleValidationActionState = { status: "idle" };
const controlClass = "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const technical = "break-all font-mono text-xs";

function localized(values: Record<string, string>, key: string, fallback: string): string { return values[key] ?? fallback; }

function SimulationField({ question, prefix, locale, messages }: { question: RuleValidationWorkspace["questions"][number]; prefix: "answer:" | "previous:"; locale: "fr" | "ar"; messages: RuleValidationMessages }) {
  const id = `${prefix === "answer:" ? "current" : "previous"}-${question.id}`;
  const label = `${locale === "ar" ? question.labelAr : question.labelFr}${prefix === "previous:" ? ` — ${messages.previousValue}` : ""}`;
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{question.answerType === "YES_NO" ? <select id={id} name={`${prefix}${question.id}`} className={controlClass} defaultValue=""><option value="">{messages.noValue}</option><option value="__TRUE__">{messages.yes}</option><option value="__FALSE__">{messages.no}</option></select> : <input id={id} name={`${prefix}${question.id}`} className={controlClass} dir="auto" maxLength={4000}/>}</div>;
}

function Feedback({ state, messages }: { state: RuleValidationActionState; messages: RuleValidationMessages }) {
  if (state.status === "idle") return null;
  const text = state.status === "success"
    ? state.operation === "VALIDATION" ? (state.report.valid ? messages.successValidation : messages.invalidRules) : messages.successSimulation
    : ({ VALIDATION: messages.validationError, UNAUTHENTICATED: messages.unauthenticated, FORBIDDEN: messages.forbidden, FAILED: messages.failed } as const)[state.reason];
  return <Alert variant={state.status === "error" || (state.status === "success" && state.operation === "VALIDATION" && !state.report.valid) ? "destructive" : "default"} role={state.status === "error" ? "alert" : "status"} aria-live="polite"><AlertDescription>{text}</AlertDescription></Alert>;
}

function ValidationEvidence({ state, messages, locale }: { state: RuleValidationActionState; messages: RuleValidationMessages; locale: "fr" | "ar" }) {
  if (state.status !== "success" || state.operation !== "VALIDATION") return null;
  const report = state.report;
  return <section aria-labelledby="validation-result" className="space-y-3 rounded-lg border bg-background p-4">
    <h3 id="validation-result" className="font-semibold">{messages.resultTitle}</h3>
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div><dt className="text-muted-foreground">{messages.status}</dt><dd><Badge variant={report.valid ? "default" : "destructive"}>{report.valid ? messages.valid : messages.invalid}</Badge></dd></div>
      <div><dt className="text-muted-foreground">{messages.questionCount}</dt><dd>{new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA").format(report.question_count)}</dd></div>
      <div><dt className="text-muted-foreground">{messages.ruleCount}</dt><dd>{new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA").format(report.rule_count)}</dd></div>
      <div><dt className="text-muted-foreground">{messages.engine}</dt><dd className={technical} dir="ltr">{report.engine_version}</dd></div>
      <div><dt className="text-muted-foreground">{messages.policy}</dt><dd className={technical} dir="ltr">{report.policy_version}</dd></div>
    </dl>
    <h4 className="font-medium">{messages.errors}</h4>
    {report.errors.length === 0 ? <p className="text-sm text-muted-foreground">{messages.noErrors}</p> : <ul className="space-y-2">{report.errors.map((error) => <li key={`${error.rule_version_id}-${error.code}`} className="rounded-md border border-destructive/40 p-3 text-sm"><span className="font-medium">{localized(messages.validationCodes, error.code, messages.failed)}</span><details className="mt-1"><summary className="cursor-pointer text-xs text-muted-foreground">{locale === "ar" ? "مرجع تقني" : "Référence technique"}</summary><bdi className={`mt-1 block ${technical}`}>{error.rule_version_id}</bdi></details></li>)}</ul>}
  </section>;
}

function SimulationEvidence({ state, messages, locale }: { state: RuleValidationActionState; messages: RuleValidationMessages; locale: "fr" | "ar" }) {
  if (state.status !== "success" || state.operation !== "SIMULATION") return null;
  const simulation = state.simulation;
  return <section aria-labelledby="simulation-result" className="space-y-3 rounded-lg border bg-background p-4">
    <h3 id="simulation-result" className="font-semibold">{messages.resultTitle}</h3>
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div><dt className="text-muted-foreground">{messages.score}</dt><dd><bdi>{new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA").format(simulation.score_basis_points)}</bdi> {messages.basisPoints}</dd></div>
      <div><dt className="text-muted-foreground">{messages.engine}</dt><dd className={technical} dir="ltr">{simulation.engine_version}</dd></div>
      <div><dt className="text-muted-foreground">{messages.policy}</dt><dd className={technical} dir="ltr">{simulation.policy_version}</dd></div>
      <div><dt className="text-muted-foreground">{messages.reproducibility}</dt><dd className={technical} dir="ltr">{simulation.reproducibility_hash}</dd></div>
    </dl>
    <h4 className="font-medium">{messages.actionsTriggered}</h4>
    {simulation.triggered_actions.length === 0 ? <p className="text-sm text-muted-foreground">{messages.noActions}</p> : <ol className="space-y-2">{simulation.triggered_actions.map((action, index) => <li key={`${action.rule_version_id}-${action.evaluation_order}-${index}`} className="rounded-md border p-3 text-sm"><span className="font-medium">{localized(messages.actions, action.type, messages.unknown)}</span><span className="mt-1 block text-xs text-muted-foreground">{locale === "ar" ? `الترتيب ${action.evaluation_order}` : `Ordre ${action.evaluation_order}`}</span><details className="mt-1"><summary className="cursor-pointer text-xs text-muted-foreground">{locale === "ar" ? "مرجع تقني" : "Référence technique"}</summary><bdi className={`mt-1 block ${technical}`}>{action.rule_version_id}</bdi></details></li>)}</ol>}
  </section>;
}

export function RuleValidationPanel({ workspace, locale, messages }: { workspace: RuleValidationWorkspace; locale: "fr" | "ar"; messages: RuleValidationMessages }) {
  const prefix = useId();
  const [validationState, validationAction, validationPending] = useActionState(validateRules, initialState);
  const [simulationState, simulationAction, simulationPending] = useActionState(simulateRules, initialState);
  const selected = workspace.versions.find((version) => version.id === workspace.selectedVersionId) ?? null;

  if (workspace.versions.length === 0) return <Alert><AlertDescription>{messages.emptyVersions}</AlertDescription></Alert>;

  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>{messages.selector}</CardTitle></CardHeader><CardContent>
      <form method="get" className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-2"><Label htmlFor={`${prefix}-version`}>{messages.chooseVersion}</Label><select id={`${prefix}-version`} name="questionnaire" defaultValue={workspace.selectedVersionId ?? ""} className={controlClass} dir={locale === "ar" ? "rtl" : "ltr"} required>{workspace.versions.map((version) => <option key={version.id} value={version.id}>{version.libraryCode} · {locale === "ar" ? version.titleAr : version.titleFr} · {messages.version} {version.version}</option>)}</select></div>
        <Button variant="outline">{messages.chooseVersion}</Button>
      </form>
      {selected ? <dl className="mt-4 grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-muted-foreground">{messages.library}</dt><dd>{selected.libraryCode}</dd></div>
        <div><dt className="text-muted-foreground">{messages.status}</dt><dd>{localized(messages.statuses, selected.status, messages.unknown)}</dd></div>
        <div><dt className="text-muted-foreground">{messages.audience}</dt><dd>{localized(messages.audiences, selected.audience, messages.unknown)}</dd></div>
        <div><dt className="text-muted-foreground">{messages.engine} / {messages.policy}</dt><dd className={technical} dir="ltr">{selected.engineVersion} / {selected.policyVersion}</dd></div>
      </dl> : null}
    </CardContent></Card>

    {selected ? <section className="grid gap-5 xl:grid-cols-2">
      <Card id="regles" className="scroll-mt-24"><CardHeader><CardTitle>{messages.validationTitle}</CardTitle><CardDescription>{messages.validationDescription}</CardDescription></CardHeader><CardContent className="space-y-4">
        <form action={validationAction}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="questionnaireVersionId" value={selected.id}/><Button className="w-full" disabled={validationPending}>{validationPending ? messages.processing : messages.validate}</Button></form>
        <div aria-live="polite"><Feedback state={validationState} messages={messages}/><ValidationEvidence state={validationState} messages={messages} locale={locale}/></div>
      </CardContent></Card>

      <Card id="simulation" className="scroll-mt-24"><CardHeader><CardTitle>{messages.simulationTitle}</CardTitle><CardDescription>{messages.simulationDescription}</CardDescription></CardHeader><CardContent className="space-y-4">
        <form action={simulationAction} className="space-y-4"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="questionnaireVersionId" value={selected.id}/>
          <fieldset className="space-y-3"><legend className="font-semibold">{messages.answers}</legend>{workspace.questions.map((question) => <SimulationField key={`answer:${question.id}`} question={question} prefix="answer:" locale={locale} messages={messages}/>)}</fieldset>
          <details className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer py-2 font-medium">{messages.previousAnswers}</summary><div className="mt-3 space-y-3">{workspace.questions.map((question) => <SimulationField key={`previous:${question.id}`} question={question} prefix="previous:" locale={locale} messages={messages}/>)}</div></details>
          <p className="text-sm text-muted-foreground">{messages.jsonHelp}</p><Button className="w-full" disabled={simulationPending}>{simulationPending ? messages.processing : messages.simulate}</Button>
        </form>
        <div aria-live="polite"><Feedback state={simulationState} messages={messages}/><SimulationEvidence state={simulationState} messages={messages} locale={locale}/></div><Alert><AlertDescription>{messages.pureSimulation}</AlertDescription></Alert>
      </CardContent></Card>
    </section> : null}

    <Card id="revue" className="scroll-mt-24"><CardHeader><CardTitle>{messages.questionsTitle}</CardTitle></CardHeader><CardContent>{workspace.questions.length === 0 ? <p className="text-sm text-muted-foreground">{messages.emptyQuestions}</p> : <ol className="grid gap-3 lg:grid-cols-2">{workspace.questions.map((question) => <li key={question.id} className="min-w-0 rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><span className="font-medium">{locale === "ar" ? question.labelAr : question.labelFr}</span><Badge variant={question.required ? "default" : "secondary"}>{question.required ? messages.required : messages.optional}</Badge></div><dl className="mt-3 space-y-2 text-sm"><div><dt className="text-muted-foreground">{messages.answerType}</dt><dd>{localized(messages.answerTypes, question.answerType, messages.unknown)}</dd></div></dl></li>)}</ol>}</CardContent></Card>

    <Card><CardHeader><CardTitle>{messages.referenceTitle}</CardTitle><CardDescription>{messages.referenceDescription}</CardDescription></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><section><h3 className="font-semibold">{messages.operatorsTitle}</h3><ul className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(messages.operators).map(([code, label]) => <li key={code} className="rounded-md border p-3 text-sm"><span>{label}</span><bdi className={`mt-1 block ${technical}`}>{code}</bdi></li>)}</ul></section><section><h3 className="font-semibold">{messages.actionsTitle}</h3><ul className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(messages.actions).map(([code, label]) => <li key={code} className="rounded-md border p-3 text-sm"><span>{label}</span><bdi className={`mt-1 block ${technical}`}>{code}</bdi></li>)}</ul></section></CardContent></Card>
  </div>;
}
