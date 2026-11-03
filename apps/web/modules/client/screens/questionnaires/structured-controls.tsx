"use client";

import { useId, useState } from "react";
import { formatMoneyInput, parseMoneyInput } from "@/modules/shared/lib/money-input";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { parseQuestionValidation, parseStructuredFields, type DocumentOption, type Question, type QuestionValidation, type StructuredField } from "@/modules/shared/lib/questionnaire-sessions/model";
import type { QuestionnaireMessages } from "./messages";

type Props = { question: Question; documents: DocumentOption[]; messages: QuestionnaireMessages; describedBy?: string };
type SimpleField = readonly [string, string, string];
const asRecord = (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asList = (value: unknown) => Array.isArray(value) ? value : [];
const asText = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "";
const constraints = (validation: QuestionValidation) => ({ minLength: validation.minLength, maxLength: validation.maxLength, min: validation.minimum, max: validation.maximum, pattern: validation.pattern });

export function StructuredQuestionControl(props: Props) {
  const { question } = props;
  if (question.type === "FILE" || question.type === "IMAGE") return <DocumentPicker {...props} imageOnly={question.type === "IMAGE"} />;
  if (question.type === "MULTI_FILE") return <MultiDocumentPicker {...props} />;
  if (question.type === "TABLE" || question.type === "REPEATER") return <SchemaRows {...props} />;
  if (question.type === "CONTACT") return <ObjectEditor {...props} fields={[["name", props.messages.personName, "text"], ["email", props.messages.email, "email"], ["phone", props.messages.phone, "tel"]]} />;
  if (question.type === "ORGANIZATION") return <ObjectEditor {...props} fields={[["name", props.messages.organizationName, "text"], ["identifier", props.messages.organizationIdentifier, "text"]]} />;
  if (question.type === "PRODUCT_LIST") return <RecordList {...props} fields={[["name", props.messages.productName, "text"], ["quantity", props.messages.quantity, "number"]]} />;
  if (question.type === "SITE_LIST") return <RecordList {...props} fields={[["name", props.messages.siteName, "text"], ["address", props.messages.address, "text"]]} />;
  if (question.type === "MILESTONE_LIST") return <RecordList {...props} fields={[["title", props.messages.milestoneTitle, "text"], ["dueDate", props.messages.milestoneDate, "date"]]} />;
  if (question.type === "BUDGET_BREAKDOWN") return <BudgetEditor {...props} />;
  return null;
}

function DocumentPicker({ question, documents, messages, describedBy, imageOnly = false }: Props & { imageOnly?: boolean }) {
  const id = useId();
  const available = imageOnly ? documents.filter((document) => document.mimeType.startsWith("image/")) : documents;
  return <div className="grid gap-2"><Label htmlFor={id}>{messages.chooseDocument}</Label><select id={id} name="answerValue" defaultValue={asText(question.answer?.value)} required={question.required} aria-describedby={describedBy} className="min-h-11 w-full rounded-md border bg-background px-3"><option value="">{messages.chooseDocumentPlaceholder}</option>{available.map((document) => <option key={document.id} value={document.id}>{document.name} · {messages.documentStatuses[document.status]}</option>)}</select>{!available.length ? <p className="text-sm text-muted-foreground">{messages.noPrivateDocuments}</p> : null}</div>;
}

function MultiDocumentPicker({ question, documents, messages, describedBy }: Props) {
  const initial = asList(question.answer?.value).filter((value): value is string => typeof value === "string");
  const [selected, setSelected] = useState(initial);
  const validation = parseQuestionValidation(question.validation);
  return <div className="grid gap-2" role="group" aria-label={messages.chooseDocuments} aria-describedby={describedBy}><input type="hidden" name="answerValue" value={JSON.stringify(selected)} />{documents.map((document) => <label key={document.id} className="flex min-h-11 items-center gap-3 rounded-lg border px-3"><input type="checkbox" checked={selected.includes(document.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, document.id] : current.filter((id) => id !== document.id))} disabled={!selected.includes(document.id) && selected.length >= (validation.maxItems ?? 1000)} className="size-5 accent-primary" /><span>{document.name} · {messages.documentStatuses[document.status]}</span></label>)}{!documents.length ? <p className="text-sm text-muted-foreground">{messages.noPrivateDocuments}</p> : null}<p className="text-sm text-muted-foreground">{messages.itemCount.replace("{count}", String(selected.length))}</p></div>;
}

function SchemaRows({ question, documents, messages, describedBy }: Props) {
  const schema = parseStructuredFields(question);
  const initial = asList(question.answer?.value).map(asRecord);
  const empty = () => Object.fromEntries((schema?.fields ?? []).map((field) => [field.key, null]));
  const [rows, setRows] = useState<Record<string, unknown>[]>(initial.length ? initial : Array.from({ length: schema?.min ?? 0 }, empty));
  const update = (index: number, key: string, value: unknown) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  if (!schema) return <p role="alert" className="text-sm text-destructive">{messages.invalidPublishedStructure}</p>;
  return <div className="space-y-3" aria-describedby={describedBy}><input type="hidden" name="answerValue" value={JSON.stringify(rows)} />{rows.map((row, index) => <fieldset key={index} className="rounded-lg border p-3"><legend className="px-1 font-medium">{messages.itemNumber.replace("{number}", String(index + 1))}</legend><div className="grid gap-3 md:grid-cols-2">{schema.fields.map((field) => <SchemaField key={field.key} field={field} value={row[field.key]} onChange={(value) => update(index, field.key, value)} documents={documents} messages={messages} />)}</div><Button type="button" variant="outline" className="mt-3 min-h-11" disabled={rows.length <= schema.min} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>{messages.removeItem}</Button></fieldset>)}<Button type="button" variant="outline" className="min-h-11" disabled={rows.length >= schema.max} onClick={() => setRows((current) => [...current, empty()])}>{messages.addItem}</Button><p className="text-sm text-muted-foreground">{messages.itemBounds.replace("{min}", String(schema.min)).replace("{max}", String(schema.max))}</p></div>;
}

function SchemaField({ field, value, onChange, documents, messages }: { field: StructuredField; value: unknown; onChange(value: unknown): void; documents: DocumentOption[]; messages: QuestionnaireMessages }) {
  const id = useId(), required = !field.nullable;
  if (field.type === "YES_NO") return <div className="grid gap-2"><Label htmlFor={id}>{field.key}</Label><select id={id} required={required} value={typeof value === "boolean" ? String(value) : ""} onChange={(event) => onChange(event.target.value === "" ? null : event.target.value === "true")} className="min-h-11 rounded-md border bg-background px-3"><option value="">{messages.choose}</option><option value="true">{messages.yes}</option><option value="false">{messages.no}</option></select></div>;
  if (field.type === "SINGLE_CHOICE") return <div className="grid gap-2"><Label htmlFor={id}>{field.key}</Label><select id={id} required={required} value={asText(value)} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-md border bg-background px-3"><option value="">{messages.choose}</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select></div>;
  if (field.type === "MULTIPLE_CHOICE") { const selected = asList(value).map(asText); return <div className="grid gap-2"><Label htmlFor={id}>{field.key}</Label><select id={id} multiple required={required} value={selected} onChange={(event) => onChange([...event.target.selectedOptions].map((option) => option.value))} className="min-h-24 rounded-md border bg-background px-3">{field.options.map((option) => <option key={option}>{option}</option>)}</select></div>; }
  if (field.type === "MONEY") return <fieldset><legend className="font-medium">{field.key}</legend><MoneyFields value={asRecord(value)} required={required} onChange={(money) => onChange({ kind: "MONEY", ...money })} messages={messages} /></fieldset>;
  if (field.type === "DATE_RANGE") { const range = asRecord(value); return <fieldset className="grid gap-2 sm:grid-cols-2"><legend className="font-medium">{field.key}</legend><Input aria-label={messages.startDate} required={required} type="date" value={asText(range.start)} onChange={(event) => onChange({ kind: "DATE_RANGE", start: event.target.value, end: asText(range.end) })} dir="ltr" /><Input aria-label={messages.endDate} required={required} type="date" min={asText(range.start) || undefined} value={asText(range.end)} onChange={(event) => onChange({ kind: "DATE_RANGE", start: asText(range.start), end: event.target.value })} dir="ltr" /></fieldset>; }
  if (field.type === "TIME") { const time = asRecord(value); return <fieldset className="grid gap-2 sm:grid-cols-2"><legend className="font-medium">{field.key}</legend><Input aria-label={messages.localDate} required={required} type="date" value={asText(time.localDate)} onChange={(event) => onChange({ kind: "LOCAL_TIME", localDate: event.target.value, localTime: asText(time.localTime), timeZone: asText(time.timeZone) || "Africa/Casablanca", dstPolicy: asText(time.dstPolicy) || "REJECT" })} dir="ltr" /><Input aria-label={messages.localTime} required={required} type="time" value={asText(time.localTime)} onChange={(event) => onChange({ kind: "LOCAL_TIME", localDate: asText(time.localDate), localTime: event.target.value, timeZone: asText(time.timeZone) || "Africa/Casablanca", dstPolicy: asText(time.dstPolicy) || "REJECT" })} dir="ltr" /><Input aria-label={messages.timeZone} required={required} value={asText(time.timeZone) || "Africa/Casablanca"} onChange={(event) => onChange({ kind: "LOCAL_TIME", localDate: asText(time.localDate), localTime: asText(time.localTime), timeZone: event.target.value, dstPolicy: asText(time.dstPolicy) || "REJECT" })} dir="ltr" /><select aria-label={messages.dstPolicy} value={asText(time.dstPolicy) || "REJECT"} onChange={(event) => onChange({ kind: "LOCAL_TIME", localDate: asText(time.localDate), localTime: asText(time.localTime), timeZone: asText(time.timeZone) || "Africa/Casablanca", dstPolicy: event.target.value })} className="min-h-11 rounded-md border bg-background px-3"><option value="EARLIER">{messages.earlier}</option><option value="LATER">{messages.later}</option><option value="REJECT">{messages.reject}</option></select></fieldset>; }
  if (field.type === "CURRENCY") return <div className="grid gap-2"><Label htmlFor={id}>{field.key}</Label><Input id={id} required={required} minLength={3} maxLength={3} pattern="[A-Z]{3}" value={asText(value)} onChange={(event) => onChange(event.target.value.toUpperCase())} dir="ltr" /></div>;
  if (field.type === "MULTI_FILE") { const selected = asList(value).map(asText); return <fieldset className="grid gap-2"><legend className="font-medium">{field.key}</legend>{documents.map((document) => <label key={document.id} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={selected.includes(document.id)} onChange={(event) => onChange(event.target.checked ? [...selected, document.id] : selected.filter((item) => item !== document.id))} className="size-5 accent-primary" />{document.name}</label>)}</fieldset>; }
  if (field.type === "CONTACT") return <NestedObject label={field.key} value={value} required={required} fields={[["name", messages.personName, "text"], ["email", messages.email, "email"], ["phone", messages.phone, "tel"]]} onChange={onChange} />;
  if (field.type === "ORGANIZATION") return <NestedObject label={field.key} value={value} required={required} fields={[["name", messages.organizationName, "text"], ["identifier", messages.organizationIdentifier, "text"]]} onChange={onChange} />;
  if (field.type === "PRODUCT_LIST") return <NestedList label={field.key} value={value} required={required} fields={[["name", messages.productName, "text"], ["quantity", messages.quantity, "number"]]} onChange={onChange} messages={messages} />;
  if (field.type === "SITE_LIST") return <NestedList label={field.key} value={value} required={required} fields={[["name", messages.siteName, "text"], ["address", messages.address, "text"]]} onChange={onChange} messages={messages} />;
  if (field.type === "MILESTONE_LIST") return <NestedList label={field.key} value={value} required={required} fields={[["title", messages.milestoneTitle, "text"], ["dueDate", messages.milestoneDate, "date"]]} onChange={onChange} messages={messages} />;
  if (field.type === "BUDGET_BREAKDOWN") return <fieldset><legend>{field.key}</legend><BudgetLines lines={asList(asRecord(value).lines).map(asRecord)} onChange={(lines) => onChange({ lines })} messages={messages} /></fieldset>;
  if (field.type === "FILE" || field.type === "IMAGE") { const available = field.type === "IMAGE" ? documents.filter((document) => document.mimeType.startsWith("image/")) : documents; return <div className="grid gap-2"><Label htmlFor={id}>{field.key}</Label><select id={id} required={required} value={asText(value)} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-md border bg-background px-3"><option value="">{messages.chooseDocumentPlaceholder}</option>{available.map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}</select></div>; }
  const exactInteger = ["INTEGER", "RATING_5", "RATING_10"].includes(field.type), exactDecimal = ["DECIMAL", "PERCENTAGE", "QUANTITY", "UNIT_VALUE"].includes(field.type);
  const shown = exactInteger || exactDecimal ? asText(asRecord(value).value) : asText(value);
  const inputType = field.type === "EMAIL" ? "email" : field.type === "URL" ? "url" : field.type === "PHONE" ? "tel" : field.type === "DATE" ? "date" : "text";
  return <div className="grid gap-2"><Label htmlFor={id}>{field.key}</Label><Input id={id} type={inputType} inputMode={exactInteger ? "numeric" : exactDecimal ? "decimal" : undefined} required={required} value={shown} onChange={(event) => onChange(exactInteger ? { kind: "INTEGER", value: event.target.value } : exactDecimal ? { kind: "DECIMAL", value: event.target.value } : event.target.value)} {...constraints(field.validation)} /></div>;
}

function NestedObject({ label, value, required, fields, onChange }: { label: string; value: unknown; required: boolean; fields: SimpleField[]; onChange(value: unknown): void }) {
  const current = asRecord(value);
  return <fieldset className="grid gap-2 sm:grid-cols-2"><legend className="font-medium">{label}</legend>{fields.map(([key, fieldLabel, type], index) => <Input key={key} aria-label={fieldLabel} type={type} required={required && index === 0} value={asText(current[key])} onChange={(event) => onChange({ ...current, [key]: event.target.value })} />)}</fieldset>;
}

function NestedList({ label, value, required, fields, onChange, messages }: { label: string; value: unknown; required: boolean; fields: SimpleField[]; onChange(value: unknown): void; messages: QuestionnaireMessages }) {
  const items = asList(value).map(asRecord);
  const actual = items.length ? items : required ? [{}] : [];
  return <fieldset className="space-y-2"><legend className="font-medium">{label}</legend>{actual.map((item, index) => <div key={index} className="grid gap-2 rounded-lg border p-2">{fields.map(([key, fieldLabel, type], fieldIndex) => <Input key={key} aria-label={fieldLabel} type={type} required={required && fieldIndex === 0} value={asText(item[key])} onChange={(event) => onChange(actual.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: event.target.value } : row))} />)}<Button type="button" variant="outline" disabled={required && actual.length === 1} onClick={() => onChange(actual.filter((_, rowIndex) => rowIndex !== index))}>{messages.removeItem}</Button></div>)}<Button type="button" variant="outline" onClick={() => onChange([...actual, {}])}>{messages.addItem}</Button></fieldset>;
}

function ObjectEditor({ question, describedBy, fields }: Props & { fields: SimpleField[] }) {
  const [value, setValue] = useState<Record<string, unknown>>(asRecord(question.answer?.value));
  return <div className="grid gap-3 sm:grid-cols-2" aria-describedby={describedBy}><input type="hidden" name="answerValue" value={JSON.stringify(value)} />{fields.map(([key, label, type], index) => <div key={key} className="grid gap-2"><Label htmlFor={question.id + "-" + key}>{label}</Label><Input id={question.id + "-" + key} type={type} required={question.required && index === 0} value={asText(value[key])} onChange={(event) => setValue((current) => ({ ...current, [key]: event.target.value }))} /></div>)}</div>;
}

function RecordList({ question, messages, describedBy, fields }: Props & { fields: SimpleField[] }) {
  const validation = parseQuestionValidation(question.validation), initial = asList(question.answer?.value).map(asRecord);
  const min = validation.minItems ?? (question.required ? 1 : 0), max = validation.maxItems ?? 100;
  const [items, setItems] = useState<Record<string, unknown>[]>(initial.length ? initial : Array.from({ length: min }, () => ({})));
  return <div className="space-y-3" aria-describedby={describedBy}><input type="hidden" name="answerValue" value={JSON.stringify(items)} />{items.map((item, index) => <fieldset key={index} className="rounded-lg border p-3"><legend className="px-1 font-medium">{messages.itemNumber.replace("{number}", String(index + 1))}</legend><div className="grid gap-3 sm:grid-cols-2">{fields.map(([key, label, type], fieldIndex) => <div key={key} className="grid gap-2"><Label htmlFor={question.id + "-" + index + "-" + key}>{label}</Label><Input id={question.id + "-" + index + "-" + key} type={type} required={question.required && fieldIndex === 0} value={asText(item[key])} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: event.target.value } : row))} /></div>)}</div><Button type="button" variant="outline" className="mt-3 min-h-11" disabled={items.length <= min} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>{messages.removeItem}</Button></fieldset>)}<Button type="button" variant="outline" className="min-h-11" disabled={items.length >= max} onClick={() => setItems((current) => [...current, {}])}>{messages.addItem}</Button><p className="text-sm text-muted-foreground">{messages.itemBounds.replace("{min}", String(min)).replace("{max}", String(max))}</p></div>;
}

function MoneyFields({ value, required, messages, onChange }: { value: Record<string, unknown>; required: boolean; messages: QuestionnaireMessages; onChange(value: Record<string, unknown>): void }) {
  const id = useId();
  const [amount, setAmount] = useState(() => formatMoneyInput(asText(value.amountMinor), asText(value.currency) || "MAD"));
  const currency = asText(value.currency) || "MAD";
  const update = (raw: string, nextCurrency: string) => onChange({ amountMinor: parseMoneyInput(raw, nextCurrency) ?? "", currency: nextCurrency });
  return <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`${id}-amount`}>{messages.amountMinor}</Label><Input id={`${id}-amount`} inputMode="decimal" required={required} value={amount} onChange={(event) => { setAmount(event.target.value); update(event.target.value, currency); }} aria-describedby={`${id}-help`} dir="ltr" /><p id={`${id}-help`} className="text-sm text-muted-foreground">{messages.amountHelp}</p></div><div className="grid gap-2"><Label htmlFor={`${id}-currency`}>{messages.currency}</Label><Input id={`${id}-currency`} required={required} minLength={3} maxLength={3} pattern="[A-Z]{3}" value={currency} onChange={(event) => update(amount, event.target.value.toUpperCase())} dir="ltr" /></div></div>;
}

function BudgetLines({ lines, onChange, messages }: { lines: Record<string, unknown>[]; onChange(lines: Record<string, unknown>[]): void; messages: QuestionnaireMessages }) {
  const actual = lines.length ? lines : [{ label: "", amountMinor: "", currency: "MAD" }];
  const update = (index: number, value: Record<string, unknown>) => onChange(actual.map((line, lineIndex) => lineIndex === index ? { ...line, ...value } : line));
  return <div className="space-y-3">{actual.map((line, index) => <fieldset key={index} className="rounded-lg border p-3"><legend className="px-1 font-medium">{messages.budgetLine.replace("{number}", String(index + 1))}</legend><label className="grid gap-2">{messages.budgetLabel}<Input required value={asText(line.label)} onChange={(event) => update(index, { label: event.target.value })} /></label><MoneyFields required value={line} messages={messages} onChange={(money) => update(index, money)} /><Button type="button" variant="outline" className="mt-3 min-h-11" disabled={actual.length === 1} onClick={() => onChange(actual.filter((_, lineIndex) => lineIndex !== index))}>{messages.removeItem}</Button></fieldset>)}<Button type="button" variant="outline" className="min-h-11" onClick={() => onChange([...actual, { label: "", amountMinor: "", currency: "MAD" }])}>{messages.addBudgetLine}</Button></div>;
}

function BudgetEditor({ question, messages, describedBy }: Props) {
  const initial = asList(asRecord(question.answer?.value).lines).map(asRecord);
  const [lines, setLines] = useState(initial.length ? initial : [{ label: "", amountMinor: "", currency: "MAD" }]);
  return <div className="space-y-3" aria-describedby={describedBy}><input type="hidden" name="answerValue" value={JSON.stringify({ lines })} /><BudgetLines lines={lines} onChange={setLines} messages={messages} /></div>;
}
