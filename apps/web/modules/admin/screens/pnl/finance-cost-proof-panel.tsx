"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { Textarea } from "@/modules/shared/ui/textarea";
import { NativeSelect } from "@/modules/shared/ui/native-select";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { getSupabaseBrowserClient } from "@/modules/shared/lib/supabase/client";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { readFinanceCostUpload, retryFinanceCostScan, uploadFinanceCostProof, type FinanceCostScanRetryResult, type FinanceCostProofFailure, type FinanceCostUploadContext, type FinanceCostUploadPhase } from "@/modules/shared/lib/finance-cost-proofs/browser-upload";
import { createLatestFinanceCostProofPageReader, decideFinanceZeroCost, downloadFinanceCostEvidence, proposeFinanceZeroCost, readFinanceCostProofPage, type FinanceCostCommandResult, type FinanceCostEvidence, type FinanceCostProofDocument, type FinanceCostProofPage, type FinanceCostProofWorkspace, type FinanceCostReviewFailure, type FinanceCostReviewProposal, type FinanceCostTarget } from "@/modules/shared/lib/finance-cost-proofs/review-commands";
import { financeCostProofCopy } from "./finance-cost-proof-copy";

export type { FinanceCostProofWorkspace, FinanceCostTarget, FinanceCostReviewProposal };
type Failure = FinanceCostProofFailure | FinanceCostReviewFailure;
const targetKey = (target: FinanceCostTarget) => `${target.component}:${target.id}`;

function FailureMessage({code,locale,returnPath}:{code:Failure;locale:Locale;returnPath:string}) {
  const c=financeCostProofCopy[locale];
  return <div role="alert" className="space-y-2 text-sm text-destructive">
    <p>{c.errors[code]}</p>
    {code==="MFA_REQUIRED"?<Link className="inline-flex min-h-11 items-center underline" href={`/${locale}/securite/compte?${new URLSearchParams({next:returnPath})}`}>{c.security}</Link>:null}
    {code==="UNAUTHENTICATED"?<Link className="inline-flex min-h-11 items-center underline" href={connexionHref(locale,{next:returnPath})}>{c.login}</Link>:null}
  </div>;
}

function EvidenceDownload({evidence,locale,returnPath}:{evidence:FinanceCostEvidence;locale:Locale;returnPath:string}) {
  const c=financeCostProofCopy[locale], [busy,setBusy]=useState(false),[state,setState]=useState<"idle"|"downloaded"|Failure>("idle");
  async function download() {
    if(busy)return;setBusy(true);setState("idle");
    try {
      const result=await downloadFinanceCostEvidence(evidence);
      if(!result.ok){setState(result.code);return;}
      const href=URL.createObjectURL(result.blob),anchor=document.createElement("a");
      anchor.href=href;anchor.download=evidence.fileName;anchor.rel="noopener";document.body.append(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(href),30_000);setState("downloaded");
    } catch {setState("UNAVAILABLE");} finally {setBusy(false);}
  }
  return <div className="space-y-2">
    <Button type="button" variant="outline" disabled={busy} onClick={()=>void download()}>{busy?c.processing:c.download}</Button>
    <p className="break-words text-sm"><bdi>{evidence.fileName}</bdi></p>
    {state==="downloaded"?<p role="status" className="text-sm">{c.downloaded}</p>:state!=="idle"?<FailureMessage code={state} locale={locale} returnPath={returnPath}/>:null}
  </div>;
}

function ProposalReview({proposal,locale,returnPath,onChanged}:{proposal:FinanceCostReviewProposal;locale:Locale;returnPath:string;onChanged:()=>void}) {
  const c=financeCostProofCopy[locale],id=useId(),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[state,setState]=useState<FinanceCostCommandResult|null>(null);
  async function decide(approved:boolean) {
    if(busy)return;setBusy(true);setState(null);
    try {
      const result=await decideFinanceZeroCost(getSupabaseBrowserClient(),{proposalId:proposal.id,sourceHash:proposal.sourceHash,approved,reason});
      setState(result);if(result.ok)onChanged();
    } catch {setState({ok:false,code:"UNAVAILABLE"});} finally {setBusy(false);}
  }
  return <article className="rounded-xl border p-4 space-y-4">
    <header><h4 className="font-semibold"><bdi>{proposal.targetLabel}</bdi></h4><p>{c.component[proposal.component]} · {c.statuses[proposal.status]}</p></header>
    <EvidenceDownload evidence={proposal.proof} locale={locale} returnPath={returnPath}/>
    {proposal.status==="PENDING"&&proposal.canDecide&&!state?.ok?<form className="space-y-3" onSubmit={event=>{event.preventDefault();void decide(true);}}>
      <p className="text-sm">{c.reviewHelp}</p>
      <Label htmlFor={`${id}-decision`}>{c.reviewReason}</Label><Textarea id={`${id}-decision`} value={reason} onChange={event=>setReason(event.target.value)} required minLength={10} maxLength={2000} disabled={busy} dir="auto"/>
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy||reason.trim().length<10}>{busy?c.deciding:c.approve}</Button><Button variant="outline" type="button" disabled={busy||reason.trim().length<10} onClick={()=>void decide(false)}>{c.reject}</Button></div>
    </form>:null}
    {state?(state.ok?<p role="status">{state.outcome==="APPROVED"?c.approved:c.rejected}</p>:<FailureMessage code={state.code} locale={locale} returnPath={returnPath}/>):null}
  </article>;
}

function ScanRetry({locale,uploadId,returnPath,onChanged}:{locale:Locale;uploadId:string;returnPath:string;onChanged:()=>void}) {
  const c=financeCostProofCopy[locale],id=useId(),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[result,setResult]=useState<FinanceCostScanRetryResult|null>(null);
  async function retry() {
    if(busy)return;setBusy(true);setResult(null);
    try{const response=await retryFinanceCostScan(getSupabaseBrowserClient(),uploadId,reason);setResult(response);if(response.retryScheduled)onChanged();}
    catch{setResult({ok:false,code:"CONNECTION_INTERRUPTED",uploadId,retryScheduled:false});}finally{setBusy(false);}
  }
  return <form className="space-y-3 rounded-lg border p-3" onSubmit={event=>{event.preventDefault();void retry();}}>
    <Label htmlFor={`${id}-retry-reason`}>{c.retryReason}</Label><Textarea id={`${id}-retry-reason`} value={reason} onChange={event=>setReason(event.target.value)} minLength={10} maxLength={2000} required disabled={busy} dir="auto"/>
    <Button type="submit" variant="outline" disabled={busy||reason.trim().length<10}>{busy?c.processing:c.retryScan}</Button>
    {result?.retryScheduled?<p role="status">{c.retryScheduled}</p>:null}
    {result&&!result.ok?<FailureMessage code={result.code} locale={locale} returnPath={returnPath}/>:null}
  </form>;
}

function EvidenceDocument({document:proof,locale,returnPath,onChanged,canRetry}:{document:FinanceCostProofDocument;locale:Locale;returnPath:string;onChanged:()=>void;canRetry:boolean}) {
  const c=financeCostProofCopy[locale];
  return <li className="rounded-lg border p-3 space-y-2">
    <p>{proof.revoked?c.revoked:c.scan[proof.scanStatus]}</p>
    {proof.scanStatus==="CLEAN"&&!proof.revoked?<EvidenceDownload evidence={proof} locale={locale} returnPath={returnPath}/>:<p className="break-words text-sm"><bdi>{proof.fileName}</bdi></p>}
    {canRetry&&proof.canRetry&&!proof.revoked&&(proof.scanStatus==="ERROR"||proof.scanStatus==="PENDING")?<ScanRetry locale={locale} uploadId={proof.uploadId} returnPath={returnPath} onChanged={onChanged}/>:null}
  </li>;
}

function mergePage<T extends {id:string}>(previous:T[],next:T[]) {return [...new Map([...previous,...next].map(row=>[row.id,row])).values()];}

async function requestProofPage(reader:ReturnType<typeof createLatestFinanceCostProofPageReader>,target:FinanceCostTarget,page:number):Promise<Awaited<ReturnType<typeof readFinanceCostProofPage>>|null> {
  try{return await reader.read(getSupabaseBrowserClient(),target,page);}catch{reader.invalidate();return{ok:false,code:"UNAVAILABLE"};}
}

function FinanceCostProofWorkspacePanel({locale,workspace,returnPath}:{locale:Locale;workspace:Extract<FinanceCostProofWorkspace,{status:"success"}>;returnPath:string}) {
  const c=financeCostProofCopy[locale],id=useId(),router=useRouter();
  const [selected,setSelected]=useState(()=>workspace.targets.length===1?targetKey(workspace.targets[0]!):"");
  const selectedTarget=workspace.targets.find(target=>targetKey(target)===selected)??null;
  const selectedRef=useRef(selected);
  useEffect(()=>{selectedRef.current=selected;},[selected]);
  const [file,setFile]=useState<File|null>(null),[reason,setReason]=useState(""),[upload,setUpload]=useState<{targetKey:string;value:FinanceCostUploadContext}|null>(null);
  const uploadRef=useRef(upload);
  useEffect(()=>{uploadRef.current=upload;},[upload]);
  const uploadId=upload?.value.upload_id,scanStatus=upload?.value.scan_status;
  const [uploadFailure,setUploadFailure]=useState<Failure|null>(null),[phase,setPhase]=useState<FinanceCostUploadPhase|null>(null),[busy,setBusy]=useState(false),[readingUpload,setReadingUpload]=useState(false);
  const [proposal,setProposal]=useState<FinanceCostCommandResult|null>(null),[proposing,setProposing]=useState(false);
  const [rows,setRows]=useState<FinanceCostProofPage|null>(null),[listFailure,setListFailure]=useState<FinanceCostReviewFailure|null>(null),[loading,setLoading]=useState(Boolean(selected));
  const [pageReader]=useState(createLatestFinanceCostProofPageReader);
  const uploadReadSequence=useRef(0),uploadReadRunning=useRef(false);

  const acceptRows=useCallback((response:Awaited<ReturnType<typeof readFinanceCostProofPage>>,target:FinanceCostTarget,page:number)=>{
    if(selectedRef.current!==targetKey(target))return;
    if(response.ok){setListFailure(null);setRows(previous=>page===1?response.value:{...response.value,documents:[...new Map([...(previous?.documents??[]),...response.value.documents].map(row=>[row.uploadId,row])).values()],proposals:mergePage(previous?.proposals??[],response.value.proposals)});}
    else setListFailure(response.code);
    setLoading(false);
  },[]);
  const loadRows=useCallback(async(target:FinanceCostTarget,page=1)=>{
    setLoading(true);setListFailure(null);
    const response=await requestProofPage(pageReader,target,page);if(response)acceptRows(response,target,page);
  },[acceptRows,pageReader]);
  useEffect(()=>{
    if(!selectedTarget)return;
    let active=true;
    void requestProofPage(pageReader,selectedTarget,1).then(response=>{if(active&&response)acceptRows(response,selectedTarget,1);});
    return()=>{active=false;pageReader.invalidate();};
  },[selectedTarget,acceptRows,pageReader]);

  const refreshUpload=useCallback(async(current:{targetKey:string;value:FinanceCostUploadContext})=>{
    if(uploadReadRunning.current)return;
    uploadReadRunning.current=true;setReadingUpload(true);const sequence=++uploadReadSequence.current;
    try {
      const response=await readFinanceCostUpload(getSupabaseBrowserClient(),current.value.upload_id);
      if(sequence!==uploadReadSequence.current||selectedRef.current!==current.targetKey)return;
      if(response.ok&&response.upload.sha256===current.value.sha256&&response.upload.mime_type===current.value.mime_type&&response.upload.size_bytes===current.value.size_bytes){setUpload({targetKey:current.targetKey,value:response.upload});setUploadFailure(null);}
      else setUploadFailure(response.ok?"INVALID_RESPONSE":response.code);
    } catch { if(sequence===uploadReadSequence.current&&selectedRef.current===current.targetKey)setUploadFailure("CONNECTION_INTERRUPTED"); } finally {uploadReadRunning.current=false;setReadingUpload(false);}
  },[]);

  useEffect(()=>{
    if(!uploadId||scanStatus!=="PENDING")return;
    let attempts=0;const timer=setInterval(()=>{if(++attempts>6){clearInterval(timer);return;}const current=uploadRef.current;if(current?.value.upload_id===uploadId)void refreshUpload(current);},2000);
    return()=>clearInterval(timer);
  },[uploadId,scanStatus,refreshUpload]);

  function changeTarget(value:string) {
    selectedRef.current=value;pageReader.invalidate();++uploadReadSequence.current;setSelected(value);setFile(null);setUpload(null);setUploadFailure(null);setProposal(null);setReason("");setRows(null);setLoading(Boolean(value));
  }
  async function deposit() {
    if(!selectedTarget||!file||busy)return;setBusy(true);setUploadFailure(null);setProposal(null);const key=selected;
    try {
      const client=getSupabaseBrowserClient(),auth=await client.auth.getUser(),failure=classifyAuthReadFailure(auth.error);
      if(failure||!auth.data.user){setUploadFailure(failure==="UNAVAILABLE"?"CONNECTION_INTERRUPTED":"UNAUTHENTICATED");return;}
      const response=await uploadFinanceCostProof(client,{actorId:auth.data.user.id,component:selectedTarget.component,targetId:selectedTarget.id,file,onPhase:setPhase});
      if(selectedRef.current!==key)return;
      if(response.ok){setUpload({targetKey:key,value:response.upload});void loadRows(selectedTarget);}
      else setUploadFailure(response.code);
    } catch {setUploadFailure("CONNECTION_INTERRUPTED");} finally {setPhase(null);setBusy(false);}
  }
  async function propose() {
    if(!selectedTarget||!upload||upload.targetKey!==selected||upload.value.scan_status!=="CLEAN"||uploadFailure||proposing)return;
    setProposing(true);setProposal(null);
    try {
      const response=await proposeFinanceZeroCost(getSupabaseBrowserClient(),{component:selectedTarget.component,targetId:selectedTarget.id,uploadId:upload.value.upload_id,reason,idempotencyKey:`finance-zero-cost:${upload.value.upload_id}`});
      if(selectedRef.current!==upload.targetKey)return;
      setProposal(response);if(response.ok){void loadRows(selectedTarget);router.refresh();}
    } catch {setProposal({ok:false,code:"UNAVAILABLE"});} finally {setProposing(false);}
  }
  const canPropose=Boolean(workspace.canUpload&&upload&&upload.targetKey===selected&&upload.value.scan_status==="CLEAN"&&!uploadFailure&&!readingUpload);
  return <section className="space-y-5" aria-label={c.title} dir={locale==="ar"?"rtl":"ltr"}>
    <header><h2 className="text-xl font-semibold">{c.title}</h2><p className="mt-2 text-sm leading-7">{c.lead}</p></header>
    {!workspace.targets.length?<p role="status">{c.noTargets}</p>:<>
      <div className="grid gap-2"><Label htmlFor={`${id}-target`}>{c.target}</Label><NativeSelect id={`${id}-target`} value={selected} onChange={event=>changeTarget(event.target.value)} disabled={busy||proposing} required><option value="" disabled>{c.choose}</option>{workspace.targets.map(target=><option key={targetKey(target)} value={targetKey(target)}>{target.label} · {c.component[target.component]}</option>)}</NativeSelect></div>
      {selectedTarget&&workspace.canUpload?<form onSubmit={event=>{event.preventDefault();void deposit();}} className="space-y-3 rounded-xl border p-4">
        <Label htmlFor={`${id}-file`}>{c.file}</Label><Input key={selected} id={`${id}-file`} type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy||proposing} onChange={event=>{setFile(event.target.files?.[0]??null);setUpload(null);setUploadFailure(null);setProposal(null);}} aria-describedby={`${id}-file-help`} required/>
        <p id={`${id}-file-help`} className="text-sm text-muted-foreground">{c.fileHelp}</p>
        <Button type="submit" disabled={!file||busy||proposing}>{phase?c.phases[phase]:c.upload}</Button>
        {uploadFailure?<FailureMessage code={uploadFailure} locale={locale} returnPath={returnPath}/>:null}
      </form>:selectedTarget?<p className="text-sm">{c.readOnly}</p>:null}
      {upload&&upload.targetKey===selected?<div className="space-y-3 rounded-xl border p-4">
        <p role="status">{c.scan[upload.value.scan_status]}</p>
        <Button type="button" variant="outline" disabled={readingUpload||busy} onClick={()=>void refreshUpload(upload)}>{readingUpload?c.processing:c.refresh}</Button>
        {workspace.canUpload&&upload.value.status==="UPLOADED"&&upload.value.scan_status==="ERROR"?<ScanRetry locale={locale} uploadId={upload.value.upload_id} returnPath={returnPath} onChanged={()=>{void refreshUpload(upload);if(selectedTarget)void loadRows(selectedTarget);}}/>:null}
        {canPropose&&!proposal?.ok?<form onSubmit={event=>{event.preventDefault();void propose();}} className="space-y-3"><Label htmlFor={`${id}-reason`}>{c.reason}</Label><Textarea id={`${id}-reason`} value={reason} onChange={event=>setReason(event.target.value)} required minLength={10} maxLength={2000} disabled={proposing} dir="auto"/><Button type="submit" disabled={proposing||reason.trim().length<10}>{proposing?c.processing:c.propose}</Button></form>:null}
        {proposal?(proposal.ok?<p role="status">{c.proposed}</p>:<FailureMessage code={proposal.code} locale={locale} returnPath={returnPath}/>):null}
      </div>:null}
      {selectedTarget?<div className="space-y-4" aria-busy={loading}>
        <h3 className="text-lg font-semibold">{c.reviews}</h3>
        {loading?<p role="status">{c.loading}</p>:null}
        {listFailure?<FailureMessage code={listFailure} locale={locale} returnPath={returnPath}/>:rows?<>
          {!rows.proposals.length?<p>{c.noReviews}</p>:rows.proposals.map(item=><ProposalReview key={item.id} proposal={{...item,canDecide:workspace.canUpload&&item.canDecide}} locale={locale} returnPath={returnPath} onChanged={()=>{void loadRows(selectedTarget);router.refresh();}}/>)}
          {rows.documents.length?<div className="space-y-3"><h3 className="font-semibold">{c.documents}</h3><ul className="space-y-3">{rows.documents.map(document=><EvidenceDocument key={document.uploadId} document={document} canRetry={workspace.canUpload} locale={locale} returnPath={returnPath} onChanged={()=>{void loadRows(selectedTarget);}}/>)}</ul></div>:null}
          {rows.hasMore?<Button type="button" variant="outline" disabled={loading} onClick={()=>void loadRows(selectedTarget,rows.page+1)}>{c.more}</Button>:null}
        </>:null}
        {listFailure?<Button type="button" variant="outline" disabled={loading} onClick={()=>void loadRows(selectedTarget)}>{c.retry}</Button>:null}
      </div>:null}
    </>}
  </section>;
}

export function FinanceCostProofPanel({locale,workspace,returnPath}:{locale:Locale;workspace:FinanceCostProofWorkspace;returnPath:string}) {
  const c=financeCostProofCopy[locale],path=safeReturnPath(returnPath,locale)??`/${locale}/administration/finance`;
  if(workspace.status==="error")return <section className="space-y-3 rounded-xl border p-4" dir={locale==="ar"?"rtl":"ltr"}><h2 className="font-semibold">{c.title}</h2><FailureMessage code={workspace.reason==="QUERY_FAILED"?"UNAVAILABLE":workspace.reason} locale={locale} returnPath={path}/><Link href={path} className="inline-flex min-h-11 items-center underline">{c.retry}</Link></section>;
  return <FinanceCostProofWorkspacePanel locale={locale} workspace={workspace} returnPath={path}/>;
}
