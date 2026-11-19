import type { ReactNode } from "react";

/** En-tête de section Administration (standard Version A). */
export function AdminSectionHead({
  title,
  lead,
  titleId,
  actions,
}: {
  title: string;
  lead?: string;
  titleId?: string;
  actions?: ReactNode;
}): ReactNode {
  return (
    <div className="admin-section-head">
      <div>
        <h2 id={titleId}>{title}</h2>
        {lead ? <p>{lead}</p> : null}
      </div>
      {actions ? <div className="client-offer-actions">{actions}</div> : null}
    </div>
  );
}

export function AdminNotice({
  children,
  tone = "ok",
  role = "status",
}: {
  children: ReactNode;
  tone?: "ok" | "warn" | "danger" | "sky";
  role?: "status" | "alert";
}): ReactNode {
  return (
    <p role={role} className="admin-notice" data-tone={tone === "ok" ? undefined : tone}>
      {children}
    </p>
  );
}
