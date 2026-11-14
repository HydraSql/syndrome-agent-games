import {createHash,randomBytes} from 'node:crypto';
import {proveGatekeeper} from './gatekeeper-prover.mjs';
const P=21888242871839275222246405745257275088548364400416034343698204186575808495617n;
// Experimental practice-only application encoding. Must be confirmed by platform feedback.
// Never used to approve a transfer or on competition tasks.
export async function practiceRejection(task,reason){
 if(task.mode!=='practice'||reason==='REQUIRES_PROOF_VERIFICATION')throw Error('Practice rejection only');
 const i=task.input;const fieldHex=x=>(BigInt(x)%P).toString();
 const taskId=(BigInt('0x'+createHash('sha256').update(task.task_id).digest('hex'))%P).toString();
 const witness={registeredVkHash:fieldHex(i.registered_vk),proofVkHash:fieldHex(i.proof_vk),minimum:String(i.minimum),publicBalance:String(i.public_balance),expiryBlock:String(i.expiry_block),currentBlock:String(i.current_block),recipient:fieldHex(i.recipient),conditionRecipient:fieldHex(i.condition_recipient),amount:String(i.amount),maxTransfer:String(i.max_transfer),decision:'0',taskId,salt:(BigInt('0x'+randomBytes(31).toString('hex'))).toString()};
 return {decision:'REJECT',reason_code:reason,...await proveGatekeeper(witness)};
}
