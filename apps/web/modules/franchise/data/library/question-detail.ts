import{z}from"zod";
export const questionDetail=z.object({id:z.string().uuid(),libraryId:z.string().uuid(),key:z.string(),scope:z.string(),identityStatus:z.string(),identityRowVersion:z.number().int().positive(),versionId:z.string().uuid(),version:z.number().int().positive(),versionStatus:z.string(),versionRowVersion:z.number().int().positive(),payload:z.record(z.string(),z.unknown())});
export type FranchiseQuestionDetail=z.infer<typeof questionDetail>;
