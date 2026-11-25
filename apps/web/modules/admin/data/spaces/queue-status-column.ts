/** Columns that should render a status chip — not dates, risks, or conformity labels. */
export function columnLooksLikeStatus(column: string): boolean {
  const normalized = column
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
  if (/(expiration|echeance|risque|conformite|preuve|activation)/u.test(normalized)) return false;
  return /(^|[^a-z])(etat|statut|state|status|qualification|حالة)([^a-z]|$)/u.test(normalized);
}
