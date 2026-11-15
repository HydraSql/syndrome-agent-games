import {reviewBatch} from './batch-review.js';
import type {FastifyInstance} from 'fastify';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const address=(v:unknown)=>{if(typeof v!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(v))throw Error('Expected a full EVM address');return v.toLowerCase()};
const amount=(v:unknown)=>{if(typeof v!=='string'||! /^(0|[1-9][0-9]{0,77})$/.test(v))throw Error('Amounts must be decimal strings in base units');const n=BigInt(v);if(n>=2n**256n)throw Error('Amount exceeds uint256');return n};
export function reviewPayment(data:any,now=Date.now()){
 if(!data||typeof data!=='object'||!data.request||!data.policy)throw Error('request and policy required');
 const r=data.request,p=data.policy;
 const recipient=address(r.recipient),allowedRecipient=address(p.recipient),asset=address(r.asset),allowedAsset=address(p.asset);
 const requested=amount(r.amount),cap=amount(p.maxAmount);
 if(!Number.isSafeInteger(r.chainId)||r.chainId<=0||!Number.isSafeInteger(p.chainId)||p.chainId<=0)throw Error('Positive integer chainId required');
 if(typeof p.expiresAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(p.expiresAt)||!Number.isFinite(Date.parse(p.expiresAt)))throw Error('UTC expiresAt required');
 const checks=[{rule:'RECIPIENT',pass:recipient===allowedRecipient},{rule:'ASSET',pass:asset===allowedAsset},{rule:'CHAIN',pass:r.chainId===p.chainId},{rule:'AMOUNT_CAP',pass:requested<=cap},{rule:'POSITIVE_AMOUNT',pass:requested>0n},{rule:'NOT_EXPIRED',pass:now<=Date.parse(p.expiresAt)}];
 const canonical={request:{recipient,asset,chainId:r.chainId,amount:requested.toString()},policy:{recipient:allowedRecipient,asset:allowedAsset,chainId:p.chainId,maxAmount:cap.toString(),expiresAt:p.expiresAt}};
 return {agent:'syndrome',version:'wildcard-v1',decision:checks.every(c=>c.pass)?'REQUIRES_HUMAN_APPROVAL':'REJECT',checks,failedRules:checks.filter(c=>!c.pass).map(c=>c.rule),evaluatedAt:new Date(now).toISOString(),inputDigest:createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),proofStatus:'NOT_GENERATED',scope:'Deterministic comparison of caller-supplied data. No chain lookup, balance verification, simulation, signing, or transfer. A digest is not a ZK proof.'};
}
export function addWildcard(app:FastifyInstance){
 app.get('/batch',async(_q,r)=>r.type('text/html').send(readFileSync(new URL('../public/batch.html',import.meta.url),'utf8')));
 app.post('/api/wildcard/batch',async(req,reply)=>{try{return reviewBatch(Buffer.isBuffer(req.body)?JSON.parse(req.body.toString('utf8')):req.body)}catch(e){return reply.code(400).send({error:e instanceof Error?e.message:'Invalid request'})}});
 app.get('/',async(_q,r)=>r.type('text/html').send(readFileSync(new URL('../public/wildcard.html',import.meta.url),'utf8')));
 app.get('/api/wildcard',()=>({agent:'syndrome',method:'POST',endpoint:'/api/wildcard/review',capability:'Read-only deterministic payment policy review',proofs:'No ZK proof claimed for this endpoint'}));
 app.post('/api/wildcard/review',async(req,reply)=>{try{const data=Buffer.isBuffer(req.body)?JSON.parse(req.body.toString('utf8')):req.body;return reviewPayment(data)}catch(e){return reply.code(400).send({error:e instanceof Error?e.message:'Invalid request'})}});
}
