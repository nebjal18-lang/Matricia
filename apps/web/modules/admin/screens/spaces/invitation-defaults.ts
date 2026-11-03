import "server-only";
import {randomUUID}from"node:crypto";
export function createAdminInvitationFormDefaults(){return{idempotencyKey:randomUUID(),invitationExpiresAt:new Date(Date.now()+7*86400000).toISOString()};}
