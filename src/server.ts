import Fastify from 'fastify';import {authenticate,fresh,inspectPayment,sign} from './core.js';
export function createApp(secret:string){
 if(!secret)throw Error('AGENT_GAMES_HMAC_SECRET is required');
 const app=Fastify({bodyLimit:262144,logger:false});
 app.removeContentTypeParser('application/json');app.addContentTypeParser('application/json',{parseAs:'buffer'},(_r,b,done)=>done(null,b));
 app.get('/health',()=>({ok:true,competitionReady:false,tracks:['proof-gatekeeper','steal-the-vfy'],blockers:['Circuit witness schema unavailable','HMAC encoding not platform-verified','Incoming proof finality verifier not integrated','Strategy commitment not configured']}));
 app.post('/agent',async(req,reply)=>{const raw=req.body as Buffer;if(!Buffer.isBuffer(raw)||!authenticate(raw,req.headers['x-agent-games-signature'],secret))return reply.code(401).send({error:'Unauthorized'});
 let task:any;try{task=JSON.parse(raw.toString('utf8'))}catch{return reply.code(400).send({error:'Invalid JSON'})}
 if(!task||typeof task!=='object'||!fresh(task.issued_at??task.issuedAt))return reply.code(400).send({error:'Invalid timestamp'});
 // Do not advertise a passing preflight while proof handling is incomplete.
 if(task.type==='agent-games.preflight.v1')return reply.code(503).send({error:'NOT_COMPETITION_READY'});
 const deadline=Date.parse(task.deadline_at??task.deadlineAt);if(!Number.isFinite(deadline)||deadline<=Date.now())return reply.code(400).send({error:'Expired task'});
 if(task.type==='agent-games.proof-gatekeeper.v1'){let reason;try{reason=inspectPayment(task.input)}catch{return reply.code(400).send({error:'Invalid payment fields'})}const body=JSON.stringify({decision:'REJECT',reason_code:reason==='REQUIRES_PROOF_VERIFICATION'?'VERIFICATION_UNAVAILABLE':reason});return reply.code(503).header('content-type','application/json').header('x-agent-games-signature',sign(body,secret)).send(body)}
 if(task.eventId==='steal-the-vfy'){return reply.code(503).send({error:'POLICY_PROOF_NOT_CONFIGURED'})}return reply.code(400).send({error:'Unsupported task'});
 });return app;
}
if(import.meta.url===new URL(process.argv[1],'file:').href){await createApp(process.env.AGENT_GAMES_HMAC_SECRET||'').listen({host:'127.0.0.1',port:Number(process.env.PORT||5180)})}
