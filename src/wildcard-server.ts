import Fastify from 'fastify';
import {addWildcard} from './wildcard.js';
const app=Fastify({bodyLimit:32768,logger:false});addWildcard(app);
app.get('/health',()=>({ok:true,service:'syndrome-wildcard',readOnly:true}));
await app.listen({host:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT||5180)});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
