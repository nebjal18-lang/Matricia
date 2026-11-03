import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ts=createRequire(new URL('../../package.json',import.meta.url))('typescript');

/** Find definite runtime violations without rejecting function bindings whose type is unknown. */
export function invalidServerActionExports(text,path='source.ts'){
 const source=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);
 if(!source.statements.some(statement=>ts.isExpressionStatement(statement)&&ts.isStringLiteral(statement.expression)&&statement.expression.text==='use server'))return[];
 const locals=new Map(),failures=[];
 const has=(node,kind)=>node.modifiers?.some(modifier=>modifier.kind===kind);
 for(const statement of source.statements){
  if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)if(ts.isIdentifier(declaration.name)&&declaration.initializer)locals.set(declaration.name.text,declaration.initializer);
  if(ts.isFunctionDeclaration(statement)&&statement.name)locals.set(statement.name.text,statement);
 }
 function kind(node,seen=new Set()){
  if(!node)return'non-function';
  if(ts.isAsExpression(node)||ts.isTypeAssertionExpression(node)||ts.isSatisfiesExpression(node)||ts.isParenthesizedExpression(node)||ts.isNonNullExpression(node))return kind(node.expression,seen);
  if(ts.isIdentifier(node)){if(seen.has(node.text)||!locals.has(node.text))return'unknown';seen.add(node.text);return kind(locals.get(node.text),seen);}
  if(ts.isArrowFunction(node)||ts.isFunctionExpression(node)||ts.isFunctionDeclaration(node))return has(node,ts.SyntaxKind.AsyncKeyword)?'async-function':'synchronous-function';
  if([ts.SyntaxKind.ObjectLiteralExpression,ts.SyntaxKind.ArrayLiteralExpression,ts.SyntaxKind.StringLiteral,ts.SyntaxKind.NoSubstitutionTemplateLiteral,ts.SyntaxKind.NumericLiteral,ts.SyntaxKind.BigIntLiteral,ts.SyntaxKind.NullKeyword,ts.SyntaxKind.TrueKeyword,ts.SyntaxKind.FalseKeyword].includes(node.kind))return'non-function';
  return'unknown';
 }
 function check(name,node,location=node){const result=kind(node);if(result==='non-function'||result==='synchronous-function')failures.push({path,line:source.getLineAndCharacterOfPosition(location.getStart(source)).line+1,name,reason:result});}
 for(const statement of source.statements){
  if(ts.isExportAssignment(statement)){check('default',statement.expression);continue;}
  if(ts.isExportDeclaration(statement)&&!statement.isTypeOnly&&!statement.moduleSpecifier&&statement.exportClause&&ts.isNamedExports(statement.exportClause))for(const element of statement.exportClause.elements)if(!element.isTypeOnly)check(element.name.text,element.propertyName??element.name,element);
  if(!has(statement,ts.SyntaxKind.ExportKeyword)||has(statement,ts.SyntaxKind.DeclareKeyword))continue;
  if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)check(declaration.name.getText(source),declaration.initializer,declaration);
  else if(ts.isFunctionDeclaration(statement))check(statement.name?.text??'default',statement);
  else if(ts.isClassDeclaration(statement)||ts.isEnumDeclaration(statement)||ts.isModuleDeclaration(statement))failures.push({path,line:source.getLineAndCharacterOfPosition(statement.getStart(source)).line+1,name:statement.name?.getText(source)??'default',reason:'non-function'});
 }
 return failures;
}

export async function validateServerActionExports(root){
 const paths=[...new Set(execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard','--','apps/web'],{cwd:root,encoding:'utf8'}).split('\0'))].filter(path=>/\.tsx?$/u.test(path)&&!path.endsWith('.d.ts'));
 const failures=[];
 for(const path of paths){let source;try{source=await readFile(resolve(root,path),'utf8');}catch(error){if(error.code==='ENOENT')continue;throw error;}failures.push(...invalidServerActionExports(source,path));}
 return{files:paths.length,failures};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await validateServerActionExports(process.cwd());
 for(const failure of result.failures)console.error(`${failure.path}:${failure.line} ${failure.name}: a use-server runtime export must be an async function (${failure.reason})`);
 if(result.failures.length){console.error(`FAIL ${result.failures.length} forbidden server-action exports`);process.exitCode=1;}
 else console.log(`PASS server-action exports (${result.files} source files checked)`);
}
