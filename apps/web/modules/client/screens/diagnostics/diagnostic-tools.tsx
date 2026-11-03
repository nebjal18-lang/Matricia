import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/shared/ui/card";
type Messages = {
  tools: string;
  assistance: string;
  assistanceHelp: string;
  openAssistance: string;
  evolution: string;
  evolutionHelp: string;
  openEvolution: string;
};

export function DiagnosticTools({ locale, m,query="" }: { locale: "fr" | "ar"; m: Messages;query?:string }) {
  const tools = [
    { href: `/${locale}/client/diagnostics/assistance${query}`, title: m.assistance, description: m.assistanceHelp, action: m.openAssistance },
    { href: `/${locale}/client/diagnostics/evolution${query}`, title: m.evolution, description: m.evolutionHelp, action: m.openEvolution },
  ];
  return <section aria-labelledby="diagnostic-tools" className="space-y-3">
    <h2 id="diagnostic-tools" className="text-xl font-semibold">{m.tools}</h2>
    <div className="grid gap-4 sm:grid-cols-2">{tools.map((tool) => <Card key={tool.href}>
      <CardHeader><CardTitle>{tool.title}</CardTitle></CardHeader>
      <CardContent className="space-y-4"><p className="text-sm leading-6 text-muted-foreground">{tool.description}</p><Link href={tool.href} className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">{tool.action}</Link></CardContent>
    </Card>)}</div>
  </section>;
}
