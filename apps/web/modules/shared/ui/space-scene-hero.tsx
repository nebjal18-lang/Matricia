import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

const DEFAULT_MOTIF_TL = "/admin/scene/pattern-tl.png";
const DEFAULT_MOTIF_BR = "/admin/scene/pattern-br.png";

export type SpaceSceneHeroProps = {
  sceneSrc: string;
  sceneAlt?: string;
  sceneSizes?: string;
  motifTlSrc?: string;
  motifBrSrc?: string;
  title: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
  priority?: boolean;
};

export function SpaceSceneHero({
  sceneSrc,
  sceneAlt = "",
  sceneSizes = "(max-width: 960px) 100vw, 960px",
  motifTlSrc = DEFAULT_MOTIF_TL,
  motifBrSrc = DEFAULT_MOTIF_BR,
  title,
  meta,
  badge,
  actions,
  className,
  priority = false,
}: SpaceSceneHeroProps) {
  const rootClass = ["mat-scene-hero", className].filter(Boolean).join(" ");
  const motifTlStyle = { backgroundImage: `url("${motifTlSrc}")` } satisfies CSSProperties;
  const motifBrStyle = { backgroundImage: `url("${motifBrSrc}")` } satisfies CSSProperties;

  return (
    <header className={rootClass}>
      <div className="mat-scene-hero-media" aria-hidden>
        <Image
          src={sceneSrc}
          alt={sceneAlt}
          fill
          sizes={sceneSizes}
          className="mat-scene-hero-photo"
          priority={priority}
        />
      </div>
      <div className="mat-scene-hero-scrim" aria-hidden />
      <div className="mat-scene-hero-motif" aria-hidden>
        <span className="mat-scene-hero-motif-tl" style={motifTlStyle} />
        <span className="mat-scene-hero-motif-br" style={motifBrStyle} />
      </div>
      <div className="mat-scene-hero-body">
        <div className="mat-scene-hero-copy">
          <div className="mat-scene-hero-title-row">
            <h1 className="mat-scene-hero-title">{title}</h1>
            {badge}
          </div>
          {meta != null && meta !== "" ? <p className="mat-scene-hero-meta">{meta}</p> : null}
        </div>
        {actions != null ? <div className="mat-scene-hero-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
