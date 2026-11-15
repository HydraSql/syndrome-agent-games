import {createHash} from 'node:crypto';
export function reviewBatch(input:any,now=Date.now()){
 const uint=(v:unknown)=>{if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,77})$/.test(v)||BigInt(v)>=2n**256n)throw Error('Expected uint256 decimal string');return BigInt(v)};
 const addr=(v:unknown)=>{if(typeof v!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(v))throw Error('Invalid EVM address');return v.toLowerCase()};
 const id=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v!==v.trim()||v.length>128)throw Error('Invoice IDs must be nonempty trimmed strings, max 128 chars');return v};
 if(!input||!Array.isArray(input.payments)||input.payments.length<1||input.payments.length>100||!input.policy)throw Error('Expected 1-100 payments and policy');
 const p=input.policy;if(!Number.isSafeInteger(p.chainId)||p.chainId<1)throw Error('Invalid policy chainId');
 const asset=addr(p.asset),budget=uint(p.totalBudget),cap=uint(p.perTransferCap);
 if(!Array.isArray(p.allowedRecipients)||!p.allowedRecipients.length||p.allowedRecipients.length>100)throw Error('Expected 1-100 allowed recipients');
 const allowed=new Set<string>(p.allowedRecipients.map(addr));
 const paid=input.previouslyPaidInvoiceIds??[];if(!Array.isArray(paid)||paid.length>1000)throw Error('Invalid payment history');const history=new Set(paid.map(id));
 if(typeof p.expiresAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(p.expiresAt)||!Number.isFinite(Date.parse(p.expiresAt)))throw Error('UTC expiry required');
 const rows=input.payments.map((r:any)=>{if(!r||!Number.isSafeInteger(r.chainId)||r.chainId<1)throw Error('Invalid payment');return {invoiceId:id(r.invoiceId),recipient:addr(r.recipient),asset:addr(r.asset),chainId:r.chainId,amount:uint(r.amount).toString()}});
 const counts=new Map<string,number>(),totals=new Map<string,bigint>();let total=0n;
 for(const r of rows){counts.set(r.invoiceId,(counts.get(r.invoiceId)||0)+1);if(r.asset===asset&&r.chainId===p.chainId){total+=BigInt(r.amount);totals.set(r.recipient,(totals.get(r.recipient)||0n)+BigInt(r.amount))}}
 const results=rows.map((r:typeof rows[number])=>{const reasons:string[]=[];if(counts.get(r.invoiceId)!>1)reasons.push('DUPLICATE_INVOICE');if(history.has(r.invoiceId))reasons.push('PREVIOUSLY_PAID');if(!allowed.has(r.recipient))reasons.push('RECIPIENT_NOT_ALLOWED');if(r.asset!==asset)reasons.push('ASSET_MISMATCH');if(r.chainId!==p.chainId)reasons.push('CHAIN_MISMATCH');if(BigInt(r.amount)===0n)reasons.push('ZERO_AMOUNT');if(BigInt(r.amount)>cap)reasons.push('TRANSFER_CAP');if(now>Date.parse(p.expiresAt))reasons.push('POLICY_EXPIRED');return {...r,reasons,decision:reasons.length?'REJECT':'REQUIRES_HUMAN_APPROVAL'}});
 const budgetExceeded=total>budget;
 const normalized={payments:rows,policy:{chainId:p.chainId,asset,totalBudget:budget.toString(),perTransferCap:cap.toString(),allowedRecipients:[...allowed].sort(),expiresAt:p.expiresAt},previouslyPaidInvoiceIds:[...history].sort()};
 return {agent:'syndrome',version:'batch-v1',decision:budgetExceeded||results.some((r:typeof results[number])=>r.reasons.length)?'REJECT_BATCH':'REQUIRES_HUMAN_APPROVAL',batchReasons:budgetExceeded?['TOTAL_BUDGET_EXCEEDED']:[],summary:{paymentCount:rows.length,policyAssetTotal:total.toString(),budget:budget.toString(),rejectedPayments:results.filter((r:typeof results[number])=>r.reasons.length).length},recipientTotals:[...totals].map(([recipient,value])=>({recipient,amount:value.toString()})),payments:results,evaluatedAt:new Date(now).toISOString(),inputDigest:createHash('sha256').update(JSON.stringify(normalized)).digest('hex'),proofStatus:'NOT_GENERATED',scope:'Caller-supplied policy and payment history only. Totals include all matching-chain/asset rows, including duplicates and rejected rows. Other assets are never summed together. No chain lookup, transfer, or persistent payment execution. Per-row results do not override a batch rejection.'};
}
