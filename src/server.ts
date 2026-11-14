import {mkdirSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {addWildcard} from './wildcard.js';
import {TaskStore} from './task-store.js';
import Fastify from 'fastify';import {authenticate,fresh,inspectPayment,sign} from './core.js';
export function createApp(secret:string){
 if(!secret)throw Error('AGENT_GAMES_HMAC_SECRET is required');
 const app=Fastify({bodyLimit:262144,logger:false});
 const store=new TaskStore('data/tasks');
 app.removeContentTypeParser('application/json');app.addContentTypeParser('application/json',{parseAs:'buffer'},(_r,b,done)=>done(null,b));
 app.get('/health',()=>({ok:true,competitionReady:false,tracks:['proof-gatekeeper','steal-the-vfy'],blockers:['Platform-to-circuit field encoding not verified','HMAC encoding not platform-verified','Incoming proof finality verifier not integrated','Strategy commitment not configured']}));
 app.post('/agent',async(req,reply)=>{const raw=req.body as Buffer;if(!Buffer.isBuffer(raw)||!authenticate(raw,req.headers['x-agent-games-signature'],secret))return reply.code(401).send({error:'Unauthorized'});
 let task:any;try{task=JSON.parse(raw.toString('utf8'))}catch{return reply.code(400).send({error:'Invalid JSON'})}
 if(!task||typeof task!=='object'||!fresh(task.issued_at??task.issuedAt))return reply.code(400).send({error:'Invalid timestamp'});
 // Transport handshake only; health still explicitly reports competitionReady=false.
 if(task.type==='agent-games.preflight.v1'){if(typeof task.agent_id!=='string'||typeof task.nonce!=='string'||!task.nonce)return reply.code(400).send({error:'Invalid preflight'});const body=JSON.stringify({ok:true,protocolVersion:'v1'});return reply.header('content-type','application/json').header('x-agent-games-signature',sign(body,secret)).send(body);}
 if(task.mode==='practice'&&task.type==='agent-games.proof-gatekeeper.v1'){mkdirSync('data/practice',{recursive:true,mode:0o700});const id=createHash('sha256').update(String(task.task_id)).digest('hex');const safe={type:task.type,mode:task.mode,task_id:task.task_id,issued_at:task.issued_at,deadline_at:task.deadline_at,input:task.input};writeFileSync('data/practice/'+id+'.json',JSON.stringify(safe,null,2),{mode:0o600});}
 const deadline=Date.parse(task.deadline_at??task.deadlineAt);if(!Number.isFinite(deadline)||deadline<=Date.now())return reply.code(400).send({error:'Expired task'});
 if(task.type==='agent-games.proof-gatekeeper.v1'){let reason;try{reason=inspectPayment(task.input)}catch{return reply.code(400).send({error:'Invalid payment fields'})}let result:any={decision:'REJECT',reason_code:reason==='REQUIRES_PROOF_VERIFICATION'?'VERIFICATION_UNAVAILABLE':reason};if(task.mode==='practice'&&reason!=='REQUIRES_PROOF_VERIFICATION'){try{const {practiceRejection}=await import('../practice-prover.mjs');const stored=await store.run('practice:'+task.task_id,raw,async()=>{const generated=await practiceRejection(task,reason);return {statusCode:200,headers:{},body:JSON.stringify(generated)}});result=JSON.parse(stored.body);}catch{result={decision:'REJECT',reason_code:'PROOF_GENERATION_FAILED'}}}const body=JSON.stringify(result);return reply.code(reason==='REQUIRES_PROOF_VERIFICATION'?503:200).header('content-type','application/json').header('x-agent-games-signature',sign(body,secret)).send(body)}
 if(task.eventId==='steal-the-vfy'){return reply.code(503).send({error:'POLICY_PROOF_NOT_CONFIGURED'})}return reply.code(400).send({error:'Unsupported task'});
 });addWildcard(app);return app;
}
if(import.meta.url===new URL(process.argv[1],'file:').href){await createApp(process.env.AGENT_GAMES_HMAC_SECRET||'').listen({host:'127.0.0.1',port:Number(process.env.PORT||5180)})}
