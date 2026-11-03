import{describe,it,expect}from"vitest";
import{catalogPageArguments,referencedQuestionVersions}from"./server-page";
const uuid="f1990000-0000-4000-8000-000000000001";
describe("server catalogue paging",()=>{
 it("bounds page and trims search without treating it as query syntax",()=>{expect(catalogPageArguments(uuid,{page:"-2",search:"  a,b%(x)  ",objectId:"unsafe"})).toMatchObject({p_page:1,p_search:"a,b%(x)",p_object_id:null});expect(catalogPageArguments(uuid,{page:"3",objectId:uuid})).toMatchObject({p_page:3,p_object_id:uuid});});
 it("collects target-only and dependency-only references without treating service targets as questions",()=>{
  const other="f1990000-0000-4000-8000-000000000002",third="f1990000-0000-4000-8000-000000000003";
  expect(new Set(referencedQuestionVersions({condition_ast:{question_version_id:uuid},actions:[{type:"HIDE",target:other},{type:"SUGGEST_SERVICE",target:"f1990000-0000-4000-8000-000000000099"}],dependency_graph:{[third]:[uuid]}}))).toEqual(new Set([uuid,other,third]));
 });
 it("rejects hostile nesting before an unbounded recursive walk",()=>{
  let value:unknown={question_version_id:uuid};for(let i=0;i<10000;i++)value={child:value};
  expect(()=>referencedQuestionVersions(value)).toThrow("INVALID_CATALOG_RULE_REFERENCES");
 });
 it("preserves pinned version references in nested conditions and action dependencies",()=>{expect(referencedQuestionVersions({condition_ast:{group:"AND",conditions:[{question_version_id:uuid},{group:"OR",conditions:[{question_version_id:uuid},{question_version_id:"unsafe"}]}]},other:[{question_version_id:uuid}]})).toEqual([uuid]);});
});
