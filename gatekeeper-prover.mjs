import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {groth16} from 'snarkjs';
const field=21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const inputs=['registeredVkHash','proofVkHash','minimum','publicBalance','expiryBlock','currentBlock','recipient','conditionRecipient','amount','maxTransfer','decision','taskId','salt'];
export async function proveGatekeeper(witness){
 if(!witness||typeof witness!=='object'||Object.keys(witness).length!==inputs.length)throw Error('Exact circuit witness required');
 for(const key of inputs){const value=witness[key];if(typeof value!=='string'||!/^(0|[1-9][0-9]*)$/.test(value)||value.length>78||BigInt(value)>=field)throw Error('Invalid field: '+key)}
 if(!['0','1'].includes(witness.decision))throw Error('Invalid decision');
 const path=n=>fileURLToPath(new URL('./artifacts/'+n,import.meta.url));
 const {proof,publicSignals}=await groth16.fullProve(witness,path('gatekeeper.wasm'),path('gatekeeper_final.zkey'));
 const key=JSON.parse(fs.readFileSync(path('gatekeeper.vkey.json'),'utf8'));
 if(!await groth16.verify(key,publicSignals,proof))throw Error('Local verification failed');
 return {proof,public_signals:publicSignals};
}
