import{describe,it,expect}from"vitest";
import{erasureRuleCommand,erasureRuleSchema,erasureFulfilCommand}from"./model";
const id="a2630000-0000-4000-8000-000000000001",source={key:"public.user_profiles",columns:[{name:"display_name"},{name:"id"}],native_action:"ANONYMIZE_DISPLAY_NAME"};
const config={schema_version:2,action:"ANONYMIZE_DISPLAY_NAME",minimum_age_days:365,not_before:"2026-11-01T00:00:00Z",retention_until:"2026-01-01T00:00:00Z",authorization_valid_until:"2030-11-01T00:00:00Z",retained_fields_until:"2031-01-01T00:00:00Z",legal_reference:"TEST_ONLY_APPROVED_POLICY_V1",reason:"TEST source disposition with retained identifiers"};
const report={id,plan_id:id,sha256:"a".repeat(64),scope_version_id:id,complete:true,policy_v2:true,published:true,acknowledged:true,reference:`privacy-erasure:${id}`},request={id,organization_id:id,status:"IN_REVIEW",verified:true,row_version:1,scope:{id,content_hash:"a".repeat(64),version:1},reports:[report]};
describe("governed erasure commands",()=>{
 it("never reinterprets the legacy retain_until field",()=>{expect(erasureRuleSchema.safeParse({...config,retain_until:"2030-01-01T00:00:00Z"}).success).toBe(false);const legacy={...config,schema_version:1};expect(erasureRuleSchema.safeParse(legacy).success).toBe(false);});
 it("separates minimum retention from the authorization window",()=>{expect(erasureRuleSchema.safeParse({...config,retention_until:"2032-01-01T00:00:00Z"}).success).toBe(false);});
 it("requires explicit retained-fields dates for a partial native effect",()=>{expect(erasureRuleSchema.safeParse({...config,retained_fields_until:null}).success).toBe(false);expect(erasureRuleSchema.safeParse({...config,action:"ERASE_PHYSICAL_STORAGE",retained_fields_until:null}).success).toBe(true);});
 it("accepts only the fixed native action for its actual source",()=>{expect(erasureRuleCommand(source,config)).toEqual(config);expect(()=>erasureRuleCommand({...source,native_action:null},config)).toThrow("COMMAND_NOT_ALLOWLISTED");});
 it("keeps retention as a distinct explicit reviewed disposition",()=>{expect(erasureRuleCommand({...source,native_action:null},{...config,action:"RETAIN_LEGAL"}).action).toBe("RETAIN_LEGAL");});
 it("keeps unsupported actions pending without inventing an executor",()=>{expect(erasureRuleCommand({...source,native_action:null},{...config,action:"ACTION_REQUIRED"}).action).toBe("ACTION_REQUIRED");});
 it.each(["DROP_TABLE","DELETE_AUTH_USER","DELETE_FINANCIAL_LEDGER"])("rejects arbitrary destruction command %s",action=>{expect(()=>erasureRuleCommand(source,{...config,action})).toThrow();});
 it.each([{minimum_age_days:1.5},{minimum_age_days:-1},{minimum_age_days:365001},{legal_reference:""},{reason:""},{authorization_valid_until:"2020-01-01T00:00:00Z"}])("refuses missing or invalid explicit policy %j",change=>{expect(erasureRuleSchema.safeParse({...config,...change}).success).toBe(false);});
 it("binds closure to exact scope and reviewed acknowledged complete proof",()=>{expect(erasureFulfilCommand(request,report,true)).toEqual(expect.objectContaining({p_expected_row_version:1,p_export_storage_reference:report.reference}));});
 it.each([{complete:false},{published:false},{acknowledged:false},{scope_version_id:"a2630000-0000-4000-8000-000000000002"}])("refuses incomplete report or delivery %j",change=>{expect(()=>erasureFulfilCommand(request,{...report,...change},true)).toThrow();});
 it("requires explicit human confirmation for the final transition",()=>{expect(()=>erasureFulfilCommand(request,report,false)).toThrow();});
});
