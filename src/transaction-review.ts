import type {FastifyInstance} from 'fastify';
import {readFileSync} from 'node:fs';
const CHAINS:Record<number,string>={1:'https://ethereum-rpc.publicnode.com',8453:'https://base-rpc.publicnode.com'};
type Rpc=(method:string,params:unknown[])=>Promise<any>;
const address=(x:unknown)=>{if(typeof x!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(x))throw Error('Full EVM address required');return x.toLowerCase()};
const uint=(x:unknown)=>{if(typeof x!=='string'||!/^(0|[1-9][0-9]{0,77})$/.test(x)||BigInt(x)>=2n**256n)throw Error('uint256 decimal string required');return BigInt(x)};
const word=(a:string)=>a.slice(2).padStart(64,'0');
export async function reviewTransaction(input:any,override?:Rpc){
 const t=input?.transaction,i=input?.intent;if(!t||!i)throw Error('transaction and intent required');
 if(!CHAINS[t.chainId]||!Number.isSafeInteger(t.chainId)||!Number.isSafeInteger(i.chainId))throw Error('Supported chains: Ethereum 1, Base 8453');
 const from=address(t.from),token=address(t.to),expectedToken=address(i.token),expectedTarget=address(i.target),expectedAmount=uint(i.amount);
 if(!['transfer','approve'].includes(i.action))throw Error('intent.action must be transfer or approve');
 const value=uint(t.value);if(typeof t.data!=='string'||!/^0x[0-9a-fA-F]{136}$/.test(t.data))throw Error('Expected canonical ERC20 transfer/approve calldata: 68 bytes');
 const data=t.data.toLowerCase(),selector=data.slice(0,10),action=selector==='0xa9059cbb'?'transfer':selector==='0x095ea7b3'?'approve':null;
 if(!action)throw Error('Unsupported selector');if(!/^0{24}$/.test(data.slice(10,34)))throw Error('Noncanonical address word');
 const target=address('0x'+data.slice(34,74)),amount=BigInt('0x'+data.slice(74));
 const reasons:string[]=[];const warnings:string[]=[];const steps:any[]=[{step:'decode',status:'complete',action,target,amount:amount.toString(),token,from}];
 if(t.chainId!==i.chainId)reasons.push('CHAIN_MISMATCH');if(token!==expectedToken)reasons.push('TOKEN_MISMATCH');if(target!==expectedTarget)reasons.push('TARGET_MISMATCH');if(action!==i.action)reasons.push('ACTION_MISMATCH');if(amount!==expectedAmount)reasons.push('AMOUNT_MISMATCH');if(value!==0n)reasons.push('UNEXPECTED_NATIVE_VALUE');if(target==='0x'+'0'.repeat(40))reasons.push('ZERO_TARGET');if(action==='transfer'&&amount===0n)reasons.push('ZERO_TRANSFER');if(action==='approve'&&amount===2n**256n-1n)reasons.push('UNLIMITED_APPROVAL');
 const rpcUrl=CHAINS[t.chainId];let id=0;const abort=AbortSignal.timeout(12000);
 const rpc:Rpc=override??(async(method,params)=>{const response=await fetch(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:abort});if(!response.ok)throw Error('RPC HTTP failure');const body=await response.json() as any;if(body.error||!('result'in body))throw Error('RPC returned error');return body.result});
 let evidence:any=null;
 if(reasons.length){steps.push({step:'policy',status:'blocked',reasons});return finish()}
 try{
 const chain=await rpc('eth_chainId',[]);if(BigInt(chain)!==BigInt(t.chainId))throw Error('RPC chain mismatch');
 const block=await rpc('eth_getBlockByNumber',['latest',false]);if(!block||!/^0x[0-9a-f]+$/i.test(block.number)||!/^0x[0-9a-f]{64}$/i.test(block.hash))throw Error('Invalid block');
 evidence={source:rpcUrl,blockNumber:BigInt(block.number).toString(),blockHash:block.hash,finality:'latest, not guaranteed finalized'};steps.push({step:'pin-block',status:'complete',...evidence});
 const tag=block.number,code=await rpc('eth_getCode',[token,tag]);if(typeof code!=='string'||!/^0x[0-9a-f]+$/i.test(code)||code==='0x0')throw Error('No token code');
 const call=async(payload:string)=>{const r=await rpc('eth_call',[{to:token,data:payload},tag]);if(typeof r!=='string'||!/^0x[0-9a-f]{64}$/i.test(r))throw Error('Invalid ERC20 response');return BigInt(r)};
 const balance=await call('0x70a08231'+word(from));evidence.balance=balance.toString();
 if(action==='transfer'&&balance<amount)reasons.push('INSUFFICIENT_TOKEN_BALANCE');
 if(action==='approve'){const allowance=await call('0xdd62ed3e'+word(from)+word(target));evidence.allowance=allowance.toString();if(allowance>0n&&amount>0n){reasons.push('NONZERO_ALLOWANCE_REPLACEMENT');warnings.push('Existing allowance is nonzero. Consider a separate revocation and review again.')}if(amount>balance)warnings.push('Approval exceeds current balance and could apply to future deposits.')}
 const finalBlock=await rpc('eth_getBlockByNumber',[tag,false]);if(finalBlock?.hash!==block.hash)throw Error('Block changed during review');
 steps.push({step:'read-token-state',status:'complete',balance:evidence.balance,allowance:evidence.allowance??null});
 }catch{reasons.push('RPC_EVIDENCE_UNAVAILABLE');steps.push({step:'read-token-state',status:'failed',message:'Could not obtain consistent RPC evidence. No approval.'})}
 return finish();
 function finish(){return {agent:'syndrome',version:'transaction-review-v1',decision:reasons.length?'BLOCK':'NEEDS_HUMAN_APPROVAL',reasons,warnings,decoded:{action,from,token,target,amount:amount.toString()},evidence,steps,evaluatedAt:new Date().toISOString(),limitations:['RPC responses are trusted observations, not cryptographic proofs.','Policy intent is user supplied and not authenticated.','No transaction simulation, proxy implementation audit, token legitimacy check, gas estimate, signing or broadcast.','Only canonical ERC20 transfer/approve calls on Ethereum and Base are supported.','Snapshot can change after review. Human approval remains mandatory.']}}
}
export function addTransactionReview(app:FastifyInstance){let busy=0;
 app.get('/transaction',async(_q,r)=>r.type('text/html').send(readFileSync(new URL('../public/transaction.html',import.meta.url),'utf8')));
 app.post('/api/wildcard/transaction',async(req,reply)=>{if(busy>=3)return reply.code(429).send({error:'Review capacity reached; retry later'});busy++;try{return await reviewTransaction(Buffer.isBuffer(req.body)?JSON.parse(req.body.toString()):req.body)}catch(e){return reply.code(400).send({error:e instanceof Error?e.message:'Invalid request'})}finally{busy--}});
}
