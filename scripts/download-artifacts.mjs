import {mkdir,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {zKey} from 'snarkjs';
await mkdir('artifacts',{recursive:true});
const expected={'gatekeeper.wasm':'be00aefe3c8ba910951a242f50e55937bf82a0375ad4b69c2ef10629ab92764f','gatekeeper_final.zkey':'adfe95a439a7063a82a4967ef026d2dd6857a4d02c63b3caf63dac02e01af80d'};
for(const [name,hash]of Object.entries(expected)){const r=await fetch('https://agentgames.zkverify.io/circuits/'+name);if(!r.ok)throw Error('Download failed '+name);const bytes=Buffer.from(await r.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('Artifact changed; review official update before use: '+name);await writeFile('artifacts/'+name,bytes);console.log('Verified',name)}
const vk=await zKey.exportVerificationKey('artifacts/gatekeeper_final.zkey');await writeFile('artifacts/gatekeeper.vkey.json',JSON.stringify(vk,null,2));console.log('Exported Gatekeeper verification key');process.exit(0);
