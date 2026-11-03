import test from 'node:test';
import assert from 'node:assert/strict';
import { invalidServerActionExports } from './server-action-exports.mjs';

test('Next server-action guard catches initial states, typed wrappers and local re-exports',()=>{
 const source=`'use server';
 export type State={status:string};
 const initial={status:'idle'};
 export {initial as idle};
 export const another=({status:'idle'} as State) satisfies State;
 export const choices=['one','two'] as const;
 export function wrong(){return Promise.resolve();}
 export async function submit(){}
 export const valid=async()=>{};
 export const binding=thirdParty.bind(null,'scope');`;
 assert.deepEqual(invalidServerActionExports(source).map(row=>row.name),['idle','another','choices','wrong']);
 assert.equal(invalidServerActionExports(`'use client';export const idle={status:'idle'};`).length,0);
 assert.equal(invalidServerActionExports(`'use server';export default async function submit(){};export type {State} from './types';`).length,0);
 assert.equal(invalidServerActionExports(`'use server';export default {status:'idle'};`)[0].name,'default');
});
