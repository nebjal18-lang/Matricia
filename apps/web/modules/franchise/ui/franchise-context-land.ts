/** Section hash after franchise org/mandate unlock, matching forms-first anchors. */
export function franchiseContextLandHash(returnPath: string): string {
  const path = returnPath.split("?")[0] ?? returnPath;
  if (path.includes("/finance/volume")) return "#volume-propose";
  if (path.includes("/perimetre/utilisateurs")) return "#invite";
  if (/\/qualite\/(definitions|risques|recommandations|incidents)/u.test(path)) return "#definition-form";
  if (/\/validations\/(approuves|publications)/u.test(path)) return "#publish";
  if (/\/(fournisseurs|reseau)\//u.test(path)) return "#dossier-actions";
  return "";
}
