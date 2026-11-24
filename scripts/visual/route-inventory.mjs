import { readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const pageRoot = resolve(import.meta.dirname, "../../apps/web/app/[locale]");

function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collect(path);
    return entry.isFile() && entry.name === "page.tsx" ? [path] : [];
  });
}

export function visualRouteInventory() {
  return collect(pageRoot).map((file) => {
    const segments = relative(pageRoot, file).split(sep).slice(0, -1)
      .filter((segment) => !/^\(.+\)$/.test(segment));
    const route = segments.join("/");
    const dynamic = segments.some((segment) => /^\[.+\]$/.test(segment));
    const space = route.startsWith("administration/") ? "admin"
      : route.startsWith("client/") ? "client"
      : route.startsWith("sous-traitant/") ? "provider"
      : route.startsWith("franchise/") ? "franchise"
      : file.includes(`${sep}(public)${sep}`) || ["connexion", "indisponible", "rejoindre-reseau"].includes(route) ? "public" : "shared";
    return { route, space, dynamic, file: relative(resolve(pageRoot, "../../../.."), file).split(sep).join("/") };
  }).sort((left, right) => left.route.localeCompare(right.route));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const routes = visualRouteInventory();
  const duplicates = routes.map(({ route }) => route).filter((route, index, all) => all.indexOf(route) !== index);
  console.log(JSON.stringify({ total: routes.length, static: routes.filter((row) => !row.dynamic).length,
    dynamic: routes.filter((row) => row.dynamic).length, duplicates,
    bySpace: Object.fromEntries(["public", "shared", "client", "provider", "franchise", "admin"]
      .map((space) => [space, routes.filter((row) => row.space === space).length])) }, null, 2));
}
