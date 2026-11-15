import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {createApp} from './server.js';
import {sign} from './core.js';
test('practice rejection returns a real proof and stable response on retry',async()=>{
 const secret=randomBytes(32).toString('hex');const app=createApp(secret);
 const task={type:'agent-games.proof-gatekeeper.v1',mode:'practice',task_id:'local-integration-'+randomUUID(),issued_at:new Date().toISOString(),deadline_at:new Date(Date.now()+60000).toISOString(),input:{registered_vk:'0x0b',proof_vk:'0x0b',minimum:'1000',public_balance:'1460',expiry_block:100,current_block:99,recipient:'0x7c',condition_recipient:'0x7b',amount:'500',max_transfer:'1000',proof_tx:'0x01'}};
 const raw=JSON.stringify(task);const request={method:'POST' as const,url:'/agent',headers:{'content-type':'application/json','x-agent-games-signature':sign(raw,secret)},payload:raw};
 try{const first=await app.inject(request);assert.equal(first.statusCode,200);const body=first.json();assert.equal(body.decision,'REJECT');assert.equal(body.reason_code,'RECIPIENT_MISMATCH');assert.equal(body.proof.protocol,'groth16');assert.equal(body.public_signals.length,13);assert.equal(first.headers['x-agent-games-signature'],sign(first.body,secret));const retry=await app.inject(request);assert.equal(retry.body,first.body);}finally{await app.close()}
});
