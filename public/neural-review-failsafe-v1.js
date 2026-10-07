(()=>{
 const CARD_ID="neural-review-failsafe";
 const qs=s=>document.querySelector(s);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
 async function json(url,options={}){
  const r=await fetch(url,{credentials:"include",headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data?.error||`HTTP ${r.status}`);
  return data;
 }
 function resultOf(task){return task?.result?.result||task?.result||{}}
 function prUrlOf(result){return result?.pullRequest?.url||result?.pullRequest?.html_url||result?.pullRequest?.result?.url||null}
 function render(task){
  if(!task?.id)return;
  if(qs('[data-neural-review-card="1"]')){qs("#"+CARD_ID)?.remove();return}
  const result=resultOf(task),preview=result?.preview||{},prUrl=prUrlOf(result);
  let card=qs("#"+CARD_ID);
  if(!card){card=document.createElement("div");card.id=CARD_ID;document.body.appendChild(card)}
  card.style.cssText="position:fixed;right:18px;bottom:18px;z-index:2147483646;width:min(430px,calc(100vw - 36px));background:#fffdf8;border:2px solid #315f43;border-radius:18px;box-shadow:0 18px 55px rgba(0,0,0,.22);padding:16px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#173827";
  const previewReady=preview?.url&&preview?.state==="success";
  const previewFailed=preview?.state==="failure";
  card.innerHTML=`<div style="font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#315f43">HERENCIA Neural · revisión pendiente</div>
   <div style="margin-top:5px;font-size:16px;font-weight:900;line-height:1.25">${esc(task.title||"Cambio programado")}</div>
   <div style="margin-top:6px;font-size:12px;color:#52675b">El cambio ya está programado. Producción no cambia hasta que pulses <b>Aceptar cambio</b>.</div>
   ${previewFailed?'<div style="margin-top:10px;padding:9px;border-radius:10px;background:#fff4d8;font-size:12px"><b>Preview externa no disponible.</b> Puedes revisar el PR y aceptar o descartar igualmente.</div>':""}
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
    ${previewReady?`<a href="${esc(preview.url)}" target="_blank" rel="noreferrer" style="text-decoration:none;text-align:center;padding:10px;border-radius:10px;background:#315f43;color:white;font-weight:800">ABRIR PREVIEW</a>`:`<button data-nr-refresh style="padding:10px;border-radius:10px;border:1px solid #b9c7be;background:white;font-weight:800;cursor:pointer">COMPROBAR PREVIEW</button>`}
    ${prUrl?`<a href="${esc(prUrl)}" target="_blank" rel="noreferrer" style="text-decoration:none;text-align:center;padding:10px;border-radius:10px;border:1px solid #b9c7be;color:#173827;font-weight:800">VER PR</a>`:'<div></div>'}
   </div>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
    <button data-nr-discard style="padding:11px;border-radius:10px;border:1px solid #efb4b4;background:#fff;color:#a22;font-weight:900;cursor:pointer">DESCARTAR</button>
    <button data-nr-accept style="padding:11px;border-radius:10px;border:0;background:#178247;color:white;font-weight:900;cursor:pointer">ACEPTAR CAMBIO</button>
   </div>`;
  card.querySelector("[data-nr-refresh]")?.addEventListener("click",async()=>{try{await json(`/api/neural/code/${encodeURIComponent(task.id)}/preview`);await check()}catch(e){alert("No se pudo comprobar la preview: "+e.message)}});
  card.querySelector("[data-nr-accept]")?.addEventListener("click",async()=>{if(!confirm("¿Aceptar este cambio y publicarlo en main?"))return;try{await json(`/api/neural/code/${encodeURIComponent(task.id)}/accept`,{method:"POST",body:JSON.stringify({approvedBy:"admin"})});card.remove();location.reload()}catch(e){alert("No se pudo aceptar el cambio: "+e.message)}});
  card.querySelector("[data-nr-discard]")?.addEventListener("click",async()=>{if(!confirm("¿Descartar este cambio? Producción quedará intacta."))return;try{await json(`/api/neural/code/${encodeURIComponent(task.id)}/discard`,{method:"POST",body:JSON.stringify({rejectedBy:"admin"})});card.remove()}catch(e){alert("No se pudo descartar el cambio: "+e.message)}});
 }
 async function check(){
  try{
   const data=await json("/api/neural/code/reviews");
   const task=Array.isArray(data?.reviews)?data.reviews[0]:null;
   if(task)render(task);else qs("#"+CARD_ID)?.remove();
  }catch(e){if(e.message!=="HTTP 401"&&e.message!=="HTTP 403")console.debug("[neural-review-failsafe]",e.message)}
 }
 window.addEventListener("load",()=>{setTimeout(check,800);setInterval(check,15000)});
})();