/** A denied or missing page must never certify a seeded business scenario. */
export function surfaceDestinationMatches(actual,expected) {
  try {
    const a=new URL(actual),e=new URL(expected);
    return a.origin===e.origin&&a.pathname.replace(/\/$/,'')===e.pathname.replace(/\/$/,'')&&['organizationId','franchiseId'].every(key=>!e.searchParams.has(key)||a.searchParams.get(key)===e.searchParams.get(key));
  }catch{return false;}
}
export function surfaceOutcome({status,heading,workspaceFailure,accessGate,bodyFailure,consoleErrors=[],pageErrors=[],expectedGate=false,destinationMatches=true}) {
  const clean=consoleErrors.length===0&&pageErrors.length===0&&!bodyFailure;
  const businessCovered=destinationMatches&&status===200&&Boolean(heading?.trim())&&!workspaceFailure&&!accessGate&&clean;
  const expectedGateCovered=destinationMatches&&expectedGate&&[200,403].includes(status)&&accessGate==='FORBIDDEN'&&clean;
  return {businessCovered,expectedGateCovered,covered:businessCovered||expectedGateCovered,hasIssue:!(businessCovered||expectedGateCovered)};
}
