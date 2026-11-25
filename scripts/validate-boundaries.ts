import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import ts from "typescript";
import { pathToFileURL } from "node:url";
import { dirname, extname, join, relative, resolve } from "node:path";

type PackageManifest = Readonly<{
  name?: string;
  scripts?: Readonly<Record<string, string>>;
}>;

const REQUIRED_SCRIPTS = ["lint", "typecheck", "test", "build"] as const;
const INTERNAL_PREFIX = "@matricia/";
const packagesRoot = "packages";

const allowedInternalDependencies: Readonly<Record<string, ReadonlySet<string>>> = {
  application: new Set(["config", "contracts", "domain", "observability", "workflows"]),
  config: new Set(),
  contracts: new Set(["domain"]),
  domain: new Set(),
  forms: new Set(["config", "contracts", "ui", "workflows"]),
  infrastructure: new Set(["application", "config", "contracts", "domain", "observability", "workflows"]),
  observability: new Set(["config"]),
  testkit: new Set(["application", "config", "contracts", "domain", "forms", "infrastructure", "observability", "ui", "workflows"]),
  ui: new Set(["config", "contracts"]),
  workflows: new Set(["contracts", "domain"]),
};

const frameworkIndependentPackages = new Set(["application", "contracts", "domain", "workflows"]);
const frameworkImports = ["next", "react", "react-dom", "@supabase/"] as const;
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts"]);
const violations: string[] = [];

function parseJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sourceFiles(root: string): string[] {
  if (!existsSync(root) || !statSync(root).isDirectory()) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink() || ["node_modules", ".next", "dist", ".git"].includes(entry.name)) return [];
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

export function validateBoundaries() {
violations.length = 0;
const packageDirectories = readdirSync(packagesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const packageName of packageDirectories) {
  const packageRoot = join(packagesRoot, packageName);
  const manifest = parseJson<PackageManifest>(join(packageRoot, "package.json"));
  if (manifest.name !== `${INTERNAL_PREFIX}${packageName}`) {
    violations.push(`${packageRoot}: nom de package incohérent (${manifest.name ?? "absent"})`);
  }
  for (const script of REQUIRED_SCRIPTS) {
    if (!manifest.scripts?.[script]) violations.push(`${packageRoot}: script ${script} absent`);
  }

  const tsconfigPath = join(packageRoot, "tsconfig.json");
  try {
    const tsconfig = parseJson<{ extends?: string }>(tsconfigPath);
    if (tsconfig.extends !== "../../tsconfig.json") {
      violations.push(`${tsconfigPath}: doit étendre le tsconfig strict racine`);
    }
  } catch {
    violations.push(`${tsconfigPath}: configuration TypeScript absente ou invalide`);
  }

  for (const file of sourceFiles(join(packageRoot, "src"))) {
    const source = readFileSync(file, "utf8");
    for (const imported of importSpecifiers(source, file)) {
      if (imported.startsWith(INTERNAL_PREFIX)) {
        const dependency = imported.slice(INTERNAL_PREFIX.length).split("/")[0];
        if (dependency && dependency !== packageName && !allowedInternalDependencies[packageName]?.has(dependency)) {
          violations.push(`${relative(".", file)}: ${packageName} ne peut pas importer ${dependency}`);
        }
      }
      if (imported.startsWith(".")) {
        const projectDestination = relative(resolve("."), resolve(dirname(file), imported));
        if (projectDestination.replaceAll("\\", "/").startsWith("apps/")) {
          violations.push(`${relative(".", file)}: packages cannot depend on applications`);
        }
        const destination = relative(resolve(packagesRoot), resolve(dirname(file), imported));
        const dependency = destination.split(/[\\/]/)[0];
        if (dependency && dependency !== ".." && dependency !== packageName && packageDirectories.includes(dependency)
          && !allowedInternalDependencies[packageName]?.has(dependency)) {
          violations.push(`${relative(".", file)}: import relatif interdit de ${packageName} vers ${dependency}`);
        }
      }
      if (frameworkIndependentPackages.has(packageName) && frameworkImports.some((name) => (
        imported === name || imported.startsWith(name.endsWith("/") ? name : `${name}/`)
      ))) {
        violations.push(`${relative(".", file)}: ${packageName} doit rester indépendant de ${imported}`);
      }
    }
  }
}

for (const file of sourceFiles("apps")) {
  violations.push(...applicationImportViolations(file, readFileSync(file, "utf8")));
}
if (violations.length > 0) {
  throw new Error(`Frontières de modules invalides:\n- ${violations.join("\n- ")}`);
}

console.log(`Frontières validées pour ${packageDirectories.length} packages et les applications.`);
}

export function importSpecifiers(source: string, file = "source.ts"): string[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      const value = node.arguments[0];
      if (value && ts.isStringLiteralLike(value)) imports.push(value.text);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) imports.push(node.argument.literal.text);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) imports.push(node.moduleReference.expression.text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return imports;
}

export function applicationImportViolations(file: string, source: string): string[] {
  const failures: string[] = [];
  const app = file.replaceAll("\\", "/").split("/")[1];
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const client = tree.statements.some((statement) => ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) && statement.expression.text === "use client");
  for (const imported of importSpecifiers(source, file)) {
    const destination = imported.startsWith(".") ? relative(resolve("."), resolve(dirname(file), imported)).replaceAll("\\", "/") : imported;
    if (destination.startsWith("apps/") && destination.split("/")[1] !== app) failures.push(`${file}: cross-application import ${imported}`);
    if (client && (/^@matricia\/(infrastructure|application)(?:\/|$)/.test(imported) || /^packages\/(infrastructure|application)\//.test(destination))) failures.push(`${file}: client cannot import server orchestration ${imported}`);
  }
  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) validateBoundaries();
