"use server";
import{revalidatePath}from'next/cache';
import{z}from'zod';
import{getSupabaseServerClient}from'@/modules/shared/lib/supabase/server';
export type BookmarkState={status:'idle'|'success'|'error'};
export async function saveBookmark(_:BookmarkState,form:FormData):Promise<BookmarkState>{
 const p=z.object({locale:z.enum(['fr','ar']),id:z.string().uuid(),saved:z.enum(['true','false'])}).safeParse(Object.fromEntries(form));if(!p.success)return{status:'error'};
 const r=await(await getSupabaseServerClient()).rpc('set_client_solution_bookmark',{p_solution_set_id:p.data.id,p_saved:p.data.saved==='true'});if(r.error)return{status:'error'};
 revalidatePath(`/${p.data.locale}/client/diagnostics/solutions`);return{status:'success'};
}
