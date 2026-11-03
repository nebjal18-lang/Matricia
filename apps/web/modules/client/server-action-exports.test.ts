import{readFile,readdir}from"node:fs/promises";
import{join}from"node:path";
import ts from"typescript";
import{describe,expect,it}from"vitest";
/** Next validates every runtime export when a Server Action is invoked, not only the action selected. */
describe("Client Server Action entrypoints",()=>{
 it("exports only async runtime functions so a valid POST cannot fail on an exported state object",async()=>{
  const root=join(process.cwd(),"modules/client"),files=await readdir(root,{recursive:true}),violations:string[]=[];
  for(const file of files.filter(name=>/\.[jt]sx?$/u.test(name))){const text=await readFile(join(root,file),"utf8"),source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith("x")?ts.ScriptKind.TSX:ts.ScriptKind.TS);if(!source.statements.some(statement=>ts.isExpressionStatement(statement)&&ts.isStringLiteral(statement.expression)&&statement.expression.text==="use server"))continue;
   for(const statement of source.statements){const modifiers=ts.canHaveModifiers(statement)?ts.getModifiers(statement):undefined;if(!modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.ExportKeyword))continue;if(ts.isTypeAliasDeclaration(statement)||ts.isInterfaceDeclaration(statement))continue;
    if(ts.isFunctionDeclaration(statement)&&modifiers.some(modifier=>modifier.kind===ts.SyntaxKind.AsyncKeyword))continue;
    if(ts.isVariableStatement(statement)){for(const declaration of statement.declarationList.declarations){const initializer=declaration.initializer;if(initializer&&(ts.isArrowFunction(initializer)||ts.isFunctionExpression(initializer))&&initializer.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.AsyncKeyword))continue;violations.push(`${file}:${declaration.name.getText(source)}`);}continue;}
    violations.push(`${file}:${ts.SyntaxKind[statement.kind]}`);
   }
  }
  expect(violations).toEqual([]);
 });
});
