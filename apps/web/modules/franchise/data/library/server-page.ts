import{z}from"zod";
export type CatalogPageInput={kind?:"SERVICE"|"QUESTIONNAIRE"|"RULE"|"QUESTION"|"ALL";search?:string;page?:string;objectId?:string;status?:string;categoryId?:string;language?:string;completeness?:string;validation?:string};
const group=z.object({total:z.number().int().nonnegative(),ids:z.array(z.string().uuid()),versionIds:z.array(z.string().uuid())});
export const catalogPageSchema=z.object({page:z.number().int().positive(),pageSize:z.literal(25),kind:z.enum(["SERVICE","QUESTIONNAIRE","RULE","QUESTION","ALL"]),search:z.string(),status:z.string(),categoryId:z.string().uuid().nullable(),language:z.string(),completeness:z.string(),validation:z.string(),bucketCounts:z.record(z.string(),z.number().int().nonnegative()).optional(),counts:z.object({drafts:z.number().int(),inReview:z.number().int(),published:z.number().int(),returns:z.number().int()}),groups:z.object({SERVICE:group,QUESTIONNAIRE:group,RULE:group,QUESTION:group})});
export type CatalogServerPage=z.infer<typeof catalogPageSchema>;
export function catalogPageArguments(franchiseId:string,input:CatalogPageInput={}){const page=Number(input.page??1);return{p_franchise_id:franchiseId,p_kind:input.kind??"SERVICE",p_search:(input.search??"").trim().slice(0,120),p_page:Number.isSafeInteger(page)&&page>0&&page<=100000?page:1,p_object_id:z.string().uuid().safeParse(input.objectId).success?input.objectId:null,p_status:input.status??"ALL",p_category_id:z.string().uuid().safeParse(input.categoryId).success?input.categoryId:null,p_language:input.language??"ALL",p_completeness:input.completeness??"ALL",p_validation:input.validation??"ALL"};}
export const scopedIds=(ids:string[])=>ids.length?ids:["00000000-0000-0000-0000-000000000000"];
/** Collect all question references before applying the per-library RLS query. */
export function referencedQuestionVersions(raw: unknown): string[] {
  const result = new Set<string>();
  const stack = [{ value: raw, depth: 0 }];
  let visited = 0;
  const add = (value: unknown) => { if (z.string().uuid().safeParse(value).success) result.add(value as string); };
  while (stack.length) {
    const { value, depth } = stack.pop()!;
    if (depth > 24 || ++visited > 100000) throw new Error("INVALID_CATALOG_RULE_REFERENCES");
    if (Array.isArray(value)) {
      for (const item of value) stack.push({ value: item, depth: depth + 1 });
    } else if (value && typeof value === "object") {
      const row = value as Record<string, unknown>;
      add(row.question_version_id);
      if (["SHOW", "HIDE", "REQUIRED", "OPTIONAL"].includes(String(row.type))) add(row.target);
      if (row.dependency_graph && typeof row.dependency_graph === "object" && !Array.isArray(row.dependency_graph)) {
        for (const [key, targets] of Object.entries(row.dependency_graph)) {
          add(key);
          if (Array.isArray(targets)) targets.forEach(add);
        }
      }
      for (const item of Object.values(row)) stack.push({ value: item, depth: depth + 1 });
    }
  }
  return [...result];
}
