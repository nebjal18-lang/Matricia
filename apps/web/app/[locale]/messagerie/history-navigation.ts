import { messageCursorSchema,type MessageCursor } from "@/modules/shared/lib/internal-messaging/model";
type Query={fil?:string;organizationId?:string;q?:string;page?:string;before?:string;beforeId?:string};
export function parseMessageCursor(query:Query):{valid:true;cursor?:MessageCursor}|{valid:false}{
 if(query.before===undefined&&query.beforeId===undefined)return{valid:true};
 const parsed=messageCursorSchema.safeParse({createdAt:query.before,id:query.beforeId});
 return parsed.success?{valid:true,cursor:parsed.data}:{valid:false};
}
export function messageHistoryHref(locale:"fr"|"ar",query:Query,cursor?:MessageCursor){
 const params=new URLSearchParams();
 for(const key of["fil","organizationId","q","page"]as const)if(query[key])params.set(key,query[key]);
 if(cursor){params.set("before",cursor.createdAt);params.set("beforeId",cursor.id);}
 return`/${locale}/messagerie${params.size?`?${params}`:""}`;
}
