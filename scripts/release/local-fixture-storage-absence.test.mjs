import assert from 'node:assert/strict';
import {test} from 'node:test';
import {missingLocalFixtureBucket} from '../../tests/e2e/helpers/linked-commercial-commands.mjs';
test('recognizes native Storage NoSuchBucket400 and missing-bucket404',()=>{
 assert.equal(missingLocalFixtureBucket({status:400,code:'NoSuchBucket',message:'Bucket not found'}),true);
 assert.equal(missingLocalFixtureBucket({statusCode:'404',message:'Bucket not found'}),true);
});
test('never treats an authorization, transport, server or successful lookup as proven absence',()=>{
 for(const error of [null,{}, {status:400,code:'InvalidJWT',message:'Invalid token'}, {status:401,code:'NoSuchBucket',message:'Bucket not found'}, {status:500,code:'NoSuchBucket',message:'Bucket not found'}, {status:404,message:'Gateway unavailable'}])assert.equal(missingLocalFixtureBucket(error),false);
});
