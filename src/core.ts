import {createHmac,timingSafeEqual} from 'node:crypto';
export function sign(raw:Buffer|string,secret:string){return createHmac('sha256',secret).update(raw).digest('hex')}
export function authenticate(raw:Buffer,header:unknown,secret:string){if(typeof header!=='string'||! /^[a-f0-9]{64}$/i.test(header))return false;return timingSafeEqual(Buffer.from(sign(raw,secret),'hex'),Buffer.from(header,'hex'))}
export function fresh(value:unknown,now=Date.now()){if(typeof value!=='string')return false;const t=Date.parse(value);return Number.isFinite(t)&&t<=now+30000&&now-t<=300000}
const integer=(x:unknown)=>{if(typeof x==='number'&&Number.isSafeInteger(x)&&x>=0)return BigInt(x);if(typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&x.length<=78)return BigInt(x);throw Error('INVALID_INTEGER')};
export function inspectPayment(input:Record<string,unknown>){
 for(const key of ['registered_vk','proof_vk','recipient','condition_recipient','proof_tx'])if(typeof input[key]!=='string'||!/^0x[0-9a-f]+$/i.test(input[key] as string))throw Error('INVALID_FIELD');
 const minimum=integer(input.minimum),balance=integer(input.public_balance),amount=integer(input.amount),cap=integer(input.max_transfer),expiry=integer(input.expiry_block),current=integer(input.current_block);
 if((input.registered_vk as string).toLowerCase()!==(input.proof_vk as string).toLowerCase())return 'VK_SUBSTITUTION';
 if(balance<minimum)return 'THRESHOLD_MISMATCH';if(current>expiry)return 'EXPIRED_CONDITION';
 if((input.recipient as string).toLowerCase()!==(input.condition_recipient as string).toLowerCase())return 'RECIPIENT_MISMATCH';
 if(amount>cap)return 'AMOUNT_OVERFLOW';
 return 'REQUIRES_PROOF_VERIFICATION'; // Never APPROVE on field checks alone.
}
