export function MissingFranchiseReferenceContext({locale,organizationId}:{locale:"fr"|"ar";organizationId?:string}) {
  const ar=locale==="ar";
  const query=new URLSearchParams(organizationId?{organizationId}:{});
  return <main className="client-page" data-workspace-failure="FRANCHISE_CONTEXT_REQUIRED" dir={ar?"rtl":"ltr"}><h1>{ar?"اختيار الامتياز مطلوب":"Sélection de la franchise requise"}</h1><p role="alert">{ar?"افتح هذا المرجع من وثائق الامتياز المحدد للحفاظ على سياق الوصول الآمن.":"Ouvrez cette référence depuis les documents de la franchise sélectionnée pour conserver le contexte d’accès sécurisé."}</p><a className="franchise-tool" href={`/${locale}/franchise/documents${query.size?`?${query}`:""}`}>{ar?"اختيار الامتياز والعودة إلى الوثائق":"Sélectionner la franchise et revenir aux documents"}</a></main>;
}
