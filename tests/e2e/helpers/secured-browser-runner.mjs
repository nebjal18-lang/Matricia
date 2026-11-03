import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { summarizeBrowserReport, validateBrowserReport } from '../../../scripts/release/browser-report.mjs';

export async function runSecuredBrowserSuite({root,config,environment,specifications,output,expectedTests,projects=[]}) {
  await mkdir(output,{recursive:true,mode:0o700});
  const reportPath=resolve(output,'private-browser-report.json');
  await rm(reportPath,{force:true});
  const startedAt=new Date().toISOString();
  const child=spawn(process.execPath,[resolve(root,'node_modules/@playwright/test/cli.js'),'test',...specifications,...projects.map(project=>`--project=${project}`),'--workers=1','--retries=0','--reporter=line,json','--output',resolve(output,'results')],{
    cwd:root,shell:false,stdio:['ignore','pipe','pipe'],env:{...environment,E2E_LOCAL_ISOLATED:config.runtimeMode==='isolated-local-docker'?'1':'0',PLAYWRIGHT_JSON_OUTPUT_FILE:reportPath},
  });
  // Output may contain authenticated page snapshots. Never print or persist it.
  child.stdout.resume();child.stderr.resume();
  const code=await new Promise((done,reject)=>{child.once('error',reject);child.once('exit',(value,signal)=>signal?reject(new Error('BROWSER_INTERRUPTED')):done(value??1));});
  let report;
  try{report=JSON.parse(await readFile(reportPath,'utf8'));}catch{throw Object.assign(new Error('BROWSER_REPORT_MISSING'),{code:'BROWSER_REPORT_MISSING'});}
  const summary={...summarizeBrowserReport(report),startedAt,finishedAt:new Date().toISOString()};
  try{if(code!==0||validateBrowserReport(report)!==expectedTests||summary.executed!==expectedTests)throw new Error('BROWSER_SUITE_FAILED');}
  catch{throw Object.assign(new Error('BROWSER_SUITE_FAILED'),{code:'BROWSER_SUITE_FAILED',browserSummary:summary});}
  return summary;
}
export async function writeLocalSuiteEvidence({root,suite,config,summary,failure,cleanupVerified,proof={}}){
 const path=resolve(root,'artifacts/test-results/local-acceptance',`${suite}.json`);
 await mkdir(resolve(root,'artifacts/test-results/local-acceptance'),{recursive:true,mode:0o700});
 const safeCode=value=>typeof value==='string'&&/^[A-Z0-9_.:-]{1,160}$/u.test(value)?value:null;
 await writeFile(path,JSON.stringify({schemaVersion:1,suite,environment:config?.runtimeMode==='isolated-local-docker'?'development-local-docker':config?.environment??'unknown',runtimeMode:config?.runtimeMode??'hosted-nonproduction',completedAt:new Date().toISOString(),status:failure?'FAILED':'PASSED',failure:failure?{label:safeCode(failure.message)??'BROWSER_OR_FIXTURE_FAILED',code:safeCode(failure.code)??'UNAVAILABLE'}:null,browser:summary??failure?.browserSummary??null,cleanupVerified,proof},null,2)+'\n',{mode:0o600});
 return path;
}
