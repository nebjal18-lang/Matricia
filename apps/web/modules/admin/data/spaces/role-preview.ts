// Preview of established command gates. Database policies remain authoritative.
export function organizationRoleGates(role: string): string[] {
 const gates=["TENANT_MEMBERSHIP_READ"];
 if(["CLIENT_OWNER","CLIENT_ADMIN","CLIENT_BUYER"].includes(role))gates.push("CLIENT_REQUEST_MANAGE");
 if(["PROVIDER_OWNER","PROVIDER_MANAGER","PROVIDER_SALES"].includes(role))gates.push("PROVIDER_RFQ_RESPOND");
 if(["CLIENT_OWNER","CLIENT_ADMIN","PROVIDER_OWNER","PROVIDER_MANAGER","FRANCHISE_OWNER","FRANCHISE_MANAGER"].includes(role))gates.push("ORGANIZATION_INVITE");
 if(["CLIENT_OWNER","CLIENT_ADMIN"].includes(role))gates.push("CLIENT_DOCUMENT_REUSE_AAL2");
 return gates;
}
export const requestedCapabilityCodes = ["seeUsers","createUsers","editUsers","manageRoles","sendInvites","seeOrgs","editOrgs","manageMandates","manageTerritories","accessDocs","readData","exportData","sensitiveData","financeData","complianceData","settings","security","auditLogs","integrations","catalog","rules","validateJourneys","providers","api","webhooks","readOnly","support"] as const;
