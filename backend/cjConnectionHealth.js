/**
 * Production CJ account health check: two idempotent GET requests.
 * No order creation, balance debit, account PII, tokens, response bodies or card data persist.
 * A successful check means GET access works, NOT that fulfilment or payment is authorized.
 */
export const CJ_ACCOUNT_HEALTH_KEY="cjAccountConnectionHealth:v1";
const safeCode=value=>String(value??"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,35)||"UNAVAILABLE";
export async function runCjAccountHealthProbe({request,write,now=()=>new Date().toISOString()}={}){
  if(typeof request!=="function"||typeof write!=="function")throw new Error("CJ probe requires dependencies");
  const endpoints=["/setting/get","/shopping/pay/getBalance"];
  const replies=await Promise.allSettled(endpoints.map(endpoint=>request(endpoint)));
  const accountRead=replies[0].status==="fulfilled"&&replies[0].value?.result!==false;
  const balanceRead=replies[1].status==="fulfilled"&&replies[1].value?.result!==false;
  const status=accountRead&&balanceRead?"verified":accountRead||balanceRead?"partial":"failed";
  const diagnostic={
    provider:"cj",checkedAt:now(),status,
    apiKeyAccepted:accountRead||balanceRead,
    accountRead,balanceRead,
    checkType:"GET_ONLY",createsOrders:false,paysOrders:false,
    canAutomatePurchases:false,
    failureCodes:replies.map((reply,i)=>reply.status==="rejected"?
      {check:i===0?"account":"balance",code:safeCode(reply.reason?.providerCode||reply.reason?.code||"REQUEST_FAILED")}:
      null).filter(Boolean),
  };
  await write(CJ_ACCOUNT_HEALTH_KEY,JSON.stringify(diagnostic));
  return diagnostic;
}
export function parseCjAccountHealth(raw){
  try{
    const value=typeof raw==="string"?JSON.parse(raw):raw;
    if(!value||value.provider!=="cj"||!["verified","partial","failed"].includes(value.status)||
      !Number.isFinite(Date.parse(String(value.checkedAt||""))))return null;
    const age=Date.now()-Date.parse(value.checkedAt);
    return {
      provider:"cj",status:age<0||age>8*3600000?"stale":value.status,
      checkedAt:value.checkedAt,accountRead:value.accountRead===true,
      balanceRead:value.balanceRead===true,createsOrders:false,paysOrders:false,
      canAutomatePurchases:false,
      failureCodes:Array.isArray(value.failureCodes)?value.failureCodes.filter(x=>
        x&&["account","balance"].includes(x.check)&&/^[A-Za-z0-9_-]{1,35}$/.test(x.code)).slice(0,2):[],
    };
  }catch{return null;}
}
