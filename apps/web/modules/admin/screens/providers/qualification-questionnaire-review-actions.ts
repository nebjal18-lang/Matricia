"use server";
import { loadQualificationQuestionnaireReview as loadSharedQualificationReview } from "@/modules/shared/lib/provider-qualification-review/actions";
import type { QualificationReviewReadResult } from "@/modules/shared/lib/provider-qualification-review/model";
export async function loadQualificationQuestionnaireReview(input:{qualificationId:string;sessionId?:string;page?:number}):Promise<QualificationReviewReadResult>{return loadSharedQualificationReview(input);}
