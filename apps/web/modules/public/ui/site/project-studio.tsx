'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Sparkles, Users, BriefcaseBusiness } from 'lucide-react';
import type { Locale } from '@/modules/shared/lib/i18n/locale';
import { getStaticPublicCatalogue } from '@/modules/public/data/catalogue/static-projection';
import { getExperienceCopy } from './experience-copy';
const combinations = [['LEGAL', 'ACC', 'COM', 'IT'], ['COM', 'SALES', 'IT', 'LEGAL'], ['IT', 'HR', 'QHSE', 'ACC']] as const;
export function ProjectStudio({ locale }: { locale: Locale }) {
  const [active, setActive] = useState(0);
  const c = getExperienceCopy(locale);
  const libraries = getStaticPublicCatalogue(locale).libraries;
  return <section id="studio" className="mx-section mx-studio">
    <div className="mx-section-head"><span className="mx-eyebrow">{c.studioEyebrow}</span><h2>{c.studioTitle}</h2><p>{c.studioIntro}</p></div>
    <div className="mx-studio-layout">
      <div className="mx-scenarios" role="group" aria-label={c.studioTitle}>
        {c.scenarios.map((label, i) => <button key={label} aria-pressed={active === i} onClick={() => setActive(i)} className={active === i ? 'is-active' : ''}><span className="mx-number">0{i + 1}</span><span>{label}</span><ArrowUpRight size={21} aria-hidden="true" /></button>)}
        <p>{c.scenarioDescriptions[active]}</p>
      </div>
      <div className="mx-project-board" aria-live="polite" aria-atomic="true">
        <div className="mx-board-heading"><span className="mx-status-dot" /><span>{c.plan}</span><Sparkles size={18} aria-hidden="true" /></div>
        <div className="mx-board-client"><Users aria-hidden="true" /><div><small>{c.client}</small><h3>{c.scenarios[active]}</h3></div></div>
        <div className="mx-board-services" key={active}>{(combinations[active] ?? combinations[0]).map((code, i) => <Link className="mx-board-service" href={`/${locale}/services?library=${code}`} key={code}><span className="mx-number">0{i + 1}</span><span>{libraries.find(l => l.code === code)?.name}</span><ArrowUpRight size={18} aria-hidden="true" /></Link>)}</div>
        <div className="mx-board-bottom"><BriefcaseBusiness size={18} aria-hidden="true" /><span>{c.experts}</span><Check size={18} aria-hidden="true" /><span>{c.shared}</span></div>
      </div>
    </div>
  </section>;
}
