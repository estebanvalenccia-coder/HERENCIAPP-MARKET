/**
 * chat_unificado_compatible.js — HERENC(IA) Frontend Controller (FINAL v1.6)
 * Mantiene el HTML visual intacto. Solo añade lógica + DevMenu extendido.
 */

const WATERMARK_TEXT_MARKER = "Created: HERENC(IA)";
const WATERMARK_TEXT = "Created: HERENC(IA) – HERENCIA.  •  BY: VALENCIA BRAVO D.E  •  Slogan: HERENCIA DE NUESTRAS RAÍCES";
const API_BASE = ""; // mismo origen (servido por backend)

// UI state
let diagMode = "general";
let lang = localStorage.getItem("herencia_lang") || "es";

// Voice + mic settings
let speaking = false;
let recognition = null;
let selectedVoiceName = localStorage.getItem("herencia_voice") || "";
let micPulse = (localStorage.getItem("herencia_mic_pulse") || "0") === "1";
let micMode = localStorage.getItem("herencia_mic_mode") || "hold"; // hold | toggle

// Scanner settings
let autoScan = (localStorage.getItem("herencia_auto_scan") || "1") === "1";
let scanIntervalSec = parseInt(localStorage.getItem("herencia_scan_interval") || "3", 10);
let camStream = null;
let autoScanTimer = null;
let scanInFlight = false;

function $(id){ return document.getElementById(id); }

function stripSignatureText(text){
  if(!text) return "";
  // remove our signature block if it exists
  const lines = String(text).split("\n");
  const out = [];
  for(const ln of lines){
    if(ln.includes("Created: HERENC(IA)")) break;
    out.push(ln);
  }
  return out.join("\n").trim();
}

function addMsg(role, text, imgDataUrl=null){
  const box = $("messages");
  if(!box) return;

  const div = document.createElement("div");
  div.className = `msg ${role}`;
  const clean = (role === "bot") ? stripSignatureText(text) : text;
  div.textContent = clean;

  if(imgDataUrl){
    const img = document.createElement("img");
    img.src = imgDataUrl;
    img.style.maxWidth = "220px";
    img.style.display = "block";
    img.style.marginTop = "8px";
    img.style.borderRadius = "10px";
    div.appendChild(img);
  }

  box.appendChild(div);
  box.parentElement.scrollTop = box.parentElement.scrollHeight;
}

function showTyping(on){
  const t = $("typingIndicator");
  if(t) t.style.display = on ? "flex" : "none";
}

function lastBotText(){
  const box = $("messages");
  if(!box) return "";
  const msgs = [...box.querySelectorAll(".msg.bot")];
  const last = msgs[msgs.length-1];
  return last ? (last.innerText || "") : "";
}

function getSessionUser(){
  let u = localStorage.getItem("herencia_user");
  if(!u){
    u = "user_" + Math.random().toString(16).slice(2);
    localStorage.setItem("herencia_user", u);
  }
  return u;
}

async function apiFetch(urlPath, body, pin=null){
  const headers = { "Content-Type": "application/json" };
  if(pin) headers["x-dev-pin"] = pin;
  const r = await fetch(API_BASE + urlPath, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {})
  });
  return r.json();
}

// ================= CHAT =================
function herenciaUsageState(){
  const vip = localStorage.getItem("herencia-ia-vip") === "1";
  const identity = localStorage.getItem("herencia-ia-active-identity") || "visitor";
  const limit = Math.max(1, Number(localStorage.getItem("herencia-ia-daily-limit") || 2));
  const day = new Date().toISOString().slice(0, 10);
  const key = `herencia-ia-usage:${day}:${identity}`;
  const used = Math.max(0, Number(localStorage.getItem(key) || 0));
  return { vip, identity, limit, key, used };
}

function applyHerenciaUsageState(){
  const input = $("userInput");
  const send = $("sendBtn");
  if(!input || !send) return;

  const state = herenciaUsageState();
  const exhausted = !state.vip && state.used >= state.limit;
  input.disabled = exhausted;
  send.disabled = exhausted;
  send.style.opacity = exhausted ? "0.5" : "1";
  send.style.cursor = exhausted ? "not-allowed" : "pointer";
  input.placeholder = exhausted
    ? "Has alcanzado tu límite diario de Herenc(IA)"
    : "Escribe tu pregunta aquí...";
}

function consumeHerenciaUsage(){
  const state = herenciaUsageState();
  if(state.vip){
    try{ window.parent?.postMessage({ type:"HERENCIA_IA_USAGE_CHANGED", used:state.used, vip:true }, window.location.origin); }catch(_){}
    return;
  }

  const next = state.used + 1;
  localStorage.setItem(state.key, String(next));
  applyHerenciaUsageState();
  try{
    window.parent?.postMessage({ type:"HERENCIA_IA_USAGE_CHANGED", used:next, limit:state.limit, vip:false }, window.location.origin);
  }catch(_){}
}

async function sendChat(){
  const input = $("userInput");
  if(!input) return;

  const access = herenciaUsageState();
  if(!access.vip && access.used >= access.limit){
    applyHerenciaUsageState();
    addMsg("bot", "Has alcanzado tu límite de mensajes de hoy. Vuelve mañana o supera 50 € en compras pagadas de plantas para seguir usando Herenc(IA).");
    return;
  }

  const message = (input.value || "").trim();
  input.value = "";
  input.focus();

  if(!message) return;

  addMsg("user", message);
  showTyping(true);

  try{
    const user = getSessionUser();
    const email = localStorage.getItem("herencia-ia-active-email") || "";
    const data = await apiFetch("/api/herencia-ai/chat", { message, user, email, lang });
    if(data?.error) throw new Error(data.error);
    addMsg("bot", (data.reply || "").trim());
    consumeHerenciaUsage();
  }catch(_){
    addMsg("bot", "⚠️ Error de conexión con Herenc(IA).");
  }finally{
    showTyping(false);
  }
}

function wireSend(){
  $("sendBtn")?.addEventListener("click", sendChat);
  $("userInput")?.addEventListener("keydown", (e)=>{
    if(e.key === "Enter"){
      e.preventDefault();
      sendChat();
    }
  });
  applyHerenciaUsageState();
}

// ================= MIC (walkie / toggle) =================
function langToSTT(l){
  if(l === "ca") return "ca-ES";
  if(l === "en") return "en-GB";
  if(l === "fr") return "fr-FR";
  return "es-ES";
}

function initSpeechRecognition(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return null;
  const r = new SR();
  r.continuous = true;
  r.interimResults = true;
  return r;
}

function wireMic(){
  const micBtn = $("micButton");
  const input = $("userInput");
  if(!micBtn || !input) return;

  const start = ()=>{
    if(!recognition) recognition = initSpeechRecognition();
    if(!recognition){
      addMsg("bot", "⚠️ Tu navegador no soporta micrófono.");
      return;
    }
    recognition.lang = langToSTT(lang);

    // pulse visual
    if(micPulse){
      micBtn.__pulseTimer && clearInterval(micBtn.__pulseTimer);
      let grow = true;
      micBtn.__pulseTimer = setInterval(()=>{
        micBtn.style.boxShadow = grow ? "0 0 0 10px rgba(255,0,0,0.20)" : "0 0 0 0 rgba(255,0,0,0.6)";
        grow = !grow;
      }, 350);
    }

    micBtn.style.background = "#ffdddd";
    micBtn.style.borderColor = "#ff6666";

    recognition.onresult = (event)=>{
      let transcript = "";
      for(let i=event.resultIndex; i<event.results.length; i++){
        transcript += event.results[i][0].transcript;
      }
      input.value = (input.value ? input.value + " " : "") + transcript.trim();
    };

    try{ recognition.start(); }catch(_){}
  };

  const stop = ()=>{
    micBtn.style.background = "white";
    micBtn.style.borderColor = "#dcdcdc";
    if(micBtn.__pulseTimer){ clearInterval(micBtn.__pulseTimer); micBtn.__pulseTimer = null; micBtn.style.boxShadow = ""; }
    try{ recognition && recognition.stop(); }catch(_){}
  };

  // bind by mode
  function bind(){
    // remove previous
    micBtn.onmousedown = micBtn.onmouseup = micBtn.onmouseleave = null;
    micBtn.ontouchstart = micBtn.ontouchend = null;
    micBtn.onclick = null;

    if(micMode === "toggle"){
      let on = false;
      micBtn.onclick = (e)=>{
        e.preventDefault();
        on = !on;
        if(on) start(); else stop();
      };
    }else{
      micBtn.addEventListener("mousedown", start);
      micBtn.addEventListener("mouseup", stop);
      micBtn.addEventListener("mouseleave", stop);

      micBtn.addEventListener("touchstart", (e)=>{ e.preventDefault(); start(); }, {passive:false});
      micBtn.addEventListener("touchend", (e)=>{ e.preventDefault(); stop(); }, {passive:false});
    }
  }

  bind();
}

// ================= TTS =================
function pickVoice(name){
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return voices.find(v => v.name === name) || null;
}

function speak(text){
  if(!text) return;
  if(!("speechSynthesis" in window)){
    addMsg("bot", "⚠️ Tu navegador no soporta voz.");
    return;
  }
  if(speaking) return;

  const u = new SpeechSynthesisUtterance(text.replace(WATERMARK_TEXT, ""));
  u.lang = langToSTT(lang);

  const v = selectedVoiceName ? pickVoice(selectedVoiceName) : null;
  if(v) u.voice = v;

  u.rate = 1;
  u.onend = ()=>{ speaking = false; };
  speaking = true;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function wireSpeaker(){
  $("voiceBtn")?.addEventListener("click", ()=> speak(lastBotText()));
}

function populateVoices(){
  const sel = $("voiceSelect");
  if(!sel || !("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices() || [];
  const current = selectedVoiceName;

  // keep Auto
  const auto = new Option("Auto", "");
  sel.innerHTML = "";
  sel.appendChild(auto);

  voices.forEach(v=>{
    sel.appendChild(new Option(`${v.name} — ${v.lang}`, v.name));
  });
  if(current) sel.value = current;
}

if("speechSynthesis" in window){
  window.speechSynthesis.onvoiceschanged = populateVoices;
}

// ================= DIAG MENU (autocierre) =================
function wireDiagMenu(){
  const btn = $("diagBtn");
  const menu = $("diagMenu");
  if(!btn || !menu) return;

  btn.addEventListener("click", ()=>{
    menu.style.display = (menu.style.display === "none" || !menu.style.display) ? "block" : "none";
  });

  menu.addEventListener("click", (e)=>{
    const t = e.target;
    if(t?.dataset?.diag){
      diagMode = t.dataset.diag;
      menu.style.display = "none";
      addMsg("bot", `🔍 Modo diagnóstico: ${diagMode}`);
    }
  });

  document.addEventListener("click", (e)=>{
    if(!menu.contains(e.target) && !btn.contains(e.target)){
      menu.style.display = "none";
    }
  });
}

// ================= TRANSLATE MENU =================
function wireTranslate(){
  const btn = $("translateBtn");
  const menu = $("translateMenu");
  if(!btn || !menu) return;

  btn.addEventListener("click", ()=>{
    menu.style.display = (menu.style.display === "none" || !menu.style.display) ? "block" : "none";
  });

  menu.addEventListener("click", (e)=>{
    const t = e.target;
    if(t?.dataset?.lang){
      lang = t.dataset.lang;
      localStorage.setItem("herencia_lang", lang);
      menu.style.display = "none";
      addMsg("bot", `🌍 Idioma: ${lang}`);
    }
  });

  document.addEventListener("click", (e)=>{
    if(!menu.contains(e.target) && !btn.contains(e.target)){
      menu.style.display = "none";
    }
  });
}

// ================= PHOTO UPLOAD =================
function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function runDiagnosis(base64){
  showTyping(true);
  try{
    const pure = base64.split(",")[1] || base64;
    const map = { general:"general", hongos:"hongos", plagas:"plagas", cuidados:"cuidados" };
    const mode = map[diagMode] || "general";

    const r = await apiFetch("/api/herencia-ai/diagnosis", { imageBase64: pure, mode });
    if(!r.ok){
      addMsg("bot", `⚠️ Diagnóstico: ${r.error || "error"}`);
      return;
    }

    const diseases = r.result?.health_assessment?.diseases || [];
    const top = diseases[0];
    const name = top?.name || "Sin coincidencia clara";
    const prob = (top?.probability != null) ? Math.round(top.probability * 100) + "%" : "?";

    addMsg("bot", `✅ Diagnóstico: ${name}\nConfianza: ${prob}`);
  }catch(_){
    addMsg("bot", `⚠️ Error diagnóstico.`);
  }finally{
    showTyping(false);
  }
}

function wirePhoto(){
  const input = $("photoInput");
  if(!input) return;
  input.addEventListener("change", async ()=>{
    const file = input.files?.[0];
    if(!file) return;
    const dataUrl = await fileToBase64(file);
    addMsg("user", "📸 Foto enviada", dataUrl);
    await runDiagnosis(dataUrl);
    input.value = "";
  });
}

// ================= SCANNER (camera + autoscan) =================
function startAutoScan(){
  if(autoScanTimer) return;
  autoScanTimer = setInterval(async ()=>{
    if(scanInFlight) return;
    const overlay = $("cameraPreview");
    if(!overlay || overlay.style.display !== "block") return;
    scanInFlight = true;
    try{
      await captureFrame(true);
    } finally {
      scanInFlight = false;
    }
  }, Math.max(2, scanIntervalSec) * 1000);
}

function stopAutoScan(){
  if(autoScanTimer){ clearInterval(autoScanTimer); autoScanTimer = null; }
}

async function openCamera(){
  const overlay = $("cameraPreview");
  const video = $("cameraVideo");
  if(!overlay || !video) return;

  overlay.style.display = "block";
  try{
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio:false });
    video.srcObject = camStream;
    if(autoScan) startAutoScan();
  }catch(_){
    addMsg("bot", "⚠️ No se pudo abrir la cámara.");
    overlay.style.display = "none";
  }
}

function closeCamera(){
  const overlay = $("cameraPreview");
  const video = $("cameraVideo");
  if(video) video.srcObject = null;
  if(camStream){
    camStream.getTracks().forEach(t=>t.stop());
    camStream = null;
  }
  if(overlay) overlay.style.display = "none";
  stopAutoScan();
}

async function captureFrame(silent=false){
  const video = $("cameraVideo");
  if(!video) return;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

  if(!silent) addMsg("user", "📟 Escáner capturado", dataUrl);
  await runDiagnosis(dataUrl);
}

function wireScanner(){
  $("scannerBtn")?.addEventListener("click", openCamera);
  $("closeCameraBtn")?.addEventListener("click", closeCamera);
  $("captureFrameBtn")?.addEventListener("click", ()=>captureFrame(false));
}

// ================= DEV MENU (extend) =================
function getPin(){ return sessionStorage.getItem("herencia_dev_pin") || ""; }

function addDevLog(msg){
  const box = $("devLogs");
  if(!box) return;
  const p = document.createElement("div");
  p.textContent = msg;
  box.appendChild(p);
  box.scrollTop = box.scrollHeight;
}

async function devGetKeys(pin){ return apiFetch("/api/dev/get-keys", {}, pin); }
async function devGetConfig(pin){ return apiFetch("/api/dev/get-config", {}, pin); }
async function devSetConfig(pin, payload){ return apiFetch("/api/dev/set-config", payload, pin); }
async function devIaList(pin){ return apiFetch("/api/dev/ia-list", {}, pin); }

function ensureDevExtras(devMenu){
  if(devMenu.querySelector("#apiKeysSection")) return;

  // API keys section
  
  const secKeys = document.createElement("section");
  secKeys.id = "apiKeysSection";
  secKeys.style.marginBottom = "18px";
  secKeys.style.display = "none";
  secKeys.innerHTML = `
    <h3 style="margin-bottom:6px;">API Keys</h3>
    <input id="keyGroq" placeholder="Groq API key" style="width:100%;padding:8px;border-radius:8px;background:#0b1430;color:#e6ebff;border:1px solid #27346d;margin-bottom:8px;" />
    <input id="keyPlantGeneral" placeholder="Plant.ID key (general)" style="width:100%;padding:8px;border-radius:8px;background:#0b1430;color:#e6ebff;border:1px solid #27346d;margin-bottom:8px;" />
    <input id="keyPlantFungus" placeholder="Plant.ID key (hongos)" style="width:100%;padding:8px;border-radius:8px;background:#0b1430;color:#e6ebff;border:1px solid #27346d;margin-bottom:8px;" />
    <input id="keyPlantInsects" placeholder="Plant.ID key (plagas)" style="width:100%;padding:8px;border-radius:8px;background:#0b1430;color:#e6ebff;border:1px solid #27346d;margin-bottom:8px;" />
    <input id="keyPlantCare" placeholder="Plant.ID key (cuidados)" style="width:100%;padding:8px;border-radius:8px;background:#0b1430;color:#e6ebff;border:1px solid #27346d;margin-bottom:10px;" />
    <label style="display:block;margin-bottom:10px;">Modelo Groq:
  <select id="groqModelSelect" style="width:100%;padding:8px;border-radius:8px;background:#0b1430;color:#e6ebff;border:1px solid #27346d;">
    <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (recomendado)</option>
    <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (rápido)</option>
  </select>
</label>
<div style="display:flex;gap:10px;flex-wrap:wrap;">
  <button id="saveKeysBtn" style="background:#4B6B1F;color:white;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;">Guardar API Keys</button>
      <button id="testGroqBtn" style="background:#395015;color:white;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;">Test Groq</button>
    </div>
    <div style="margin-top:8px;font-size:0.75rem;opacity:.85;">Se guardan en backend/data/apis.json</div>
  `;

  // Voice + mic section
  const secVoice = document.createElement("section");
  secVoice.id = "voiceSection";
  secVoice.style.marginBottom = "18px";
  secVoice.innerHTML = `
    <h3 style="margin-bottom:6px;">Voces y Mic</h3>
    <label style="display:block;margin-bottom:8px;">Voz TTS del navegador:
      <select id="voiceSelect" style="width:100%;padding:8px;border-radius:8px;background:#0b1430;color:#e6ebff;border:1px solid #27346d;">
        <option value="">Auto</option>
      </select>
    </label>
    <label style="display:block;margin-bottom:8px;">Idioma STT/TTS:
      <select id="langSelect" style="width:100%;padding:8px;border-radius:8px;background:#0b1430;color:#e6ebff;border:1px solid #27346d;">
        <option value="es">Español</option>
        <option value="en">English</option>
        <option value="ca">Català</option>
        <option value="fr">Français</option>
      </select>
    </label>
    <label style="display:block;margin-bottom:8px;">Modo mic:
      <select id="micModeSelect" style="width:100%;padding:8px;border-radius:8px;background:#0b1430;color:#e6ebff;border:1px solid #27346d;">
        <option value="hold">Walkie (mantener pulsado)</option>
        <option value="toggle">Click on/off</option>
      </select>
    </label>
    <label style="display:flex;gap:10px;align-items:center;margin-bottom:10px;">
      <input type="checkbox" id="micPulseDev"> Mic con pulso
    </label>
    <label style="display:flex;gap:10px;align-items:center;margin-bottom:6px;">
      <input type="checkbox" id="autoScanDev"> Escáner en tiempo real
    </label>
    <label style="display:block;margin-bottom:10px;">Intervalo (seg):
      <select id="scanIntervalSelect" style="width:100%;padding:8px;border-radius:8px;background:#0b1430;color:#e6ebff;border:1px solid #27346d;">
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="5">5</option>
        <option value="8">8</option>
      </select>
    </label>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <button id="testVoiceBtn" style="background:#395015;color:white;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;">Probar voz</button>
    </div>
  `;

  // Feeder section (internet learning controlled)
  const secFeeder = document.createElement("section");
  secFeeder.id = "feederSection";
  secFeeder.style.marginBottom = "18px";
  secFeeder.innerHTML = `
    <h3 style="margin-bottom:6px;">Feeder (Internet)</h3>
    <input id="feederUrl" placeholder="Pega una URL para aprender (controlado)" style="width:100%;padding:8px;border-radius:8px;background:#0b1430;color:#e6ebff;border:1px solid #27346d;margin-bottom:10px;" />
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <button id="feederFetchBtn" style="background:#4B6B1F;color:white;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;">Aprender URL</button>
      <button id="feederClearBtn" style="background:#395015;color:white;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;">Borrar Feeds</button>
    </div>
    <div style="margin-top:8px;font-size:0.75rem;opacity:.85;">Se guarda en backend/data/training.json</div>
  `;

  // insert at top of devmenu content (after title bar)
  devMenu.insertBefore(secKeys, devMenu.children[2] || null);
  devMenu.insertBefore(secVoice, devMenu.children[3] || null);
  devMenu.insertBefore(secFeeder, devMenu.children[4] || null);
}

async function devRefresh(pin){
  // status
  try{
    const st = await apiFetch("/api/dev/status", {}, pin);
    addDevLog(st.ok ? "🟢 Backend OK" : "🟠 Backend status error");
  }catch(_){
    addDevLog("🟠 Backend status error");
  }

  // keys
  try{
    const keys = await devGetKeys(pin);
    if(keys.ok){
      $("keyGroq") && ($("keyGroq").value = keys.keys?.groq || "");
      $("keyPlantGeneral") && ($("keyPlantGeneral").value = keys.keys?.plant_general || "");
      $("keyPlantFungus") && ($("keyPlantFungus").value = keys.keys?.plant_fungus || "");
      $("keyPlantInsects") && ($("keyPlantInsects").value = keys.keys?.plant_insects || "");
      $("keyPlantCare") && ($("keyPlantCare").value = keys.keys?.plant_care || "");
      addDevLog("🔑 Keys cargadas");
    }
  }catch(_){
    addDevLog("⚠️ No se pudieron cargar keys");
  }

  // config
  try{
    const cfg = await devGetConfig(pin);
    if(cfg.ok){
      $("modelSelect") && ($("modelSelect").value = cfg.config?.mode || "herencia-core");
      $("personaSelect") && ($("personaSelect").value = cfg.config?.persona || "cariñosa");
      $("debugMode") && ($("debugMode").checked = !!cfg.config?.debug);
      $("autoRepair") && ($("autoRepair").checked = !!cfg.config?.autoRepair);
      $("groqModelSelect") && ($("groqModelSelect").value = cfg.config?.groq_model || "llama-3.3-70b-versatile");
      addDevLog("🔧 Config cargada");
    }
  }catch(_){}

  // voice settings
  $("langSelect") && ($("langSelect").value = lang);
  $("micPulseDev") && ($("micPulseDev").checked = micPulse);
  $("micModeSelect") && ($("micModeSelect").value = micMode);
  $("autoScanDev") && ($("autoScanDev").checked = autoScan);
  $("scanIntervalSelect") && ($("scanIntervalSelect").value = String(scanIntervalSec));
  populateVoices();

  // IA list
  try{
    const il = await devIaList(pin);
    const box = $("iaList");
    if(il.ok && box){
      box.textContent = (il.list || []).map(x=>`• ${x}`).join("\n");
      addDevLog("🧠 IA list cargada");
    }
  }catch(_){}
}

async function openDevMenu(){
  const devMenu = $("devMenu");
  if(!devMenu) return;

  let pin = getPin();
  if(!pin){
    pin = prompt("PIN DevMenu:");
    if(!pin) return;
    sessionStorage.setItem("herencia_dev_pin", pin);
  }

  devMenu.style.display = "block";
  ensureDevExtras(devMenu);
  await devRefresh(pin);
}


async function learnStatus(){
  try{
    const r = await fetch(API_BASE + "/api/learn/status");
    const j = await r.json();
    return j;
  }catch(e){ return { ok:false, error:String(e) }; }
}
async function learnToggle(enabled){
  try{
    const r = await fetch(API_BASE + "/api/learn/toggle", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ enabled }) });
    return await r.json();
  }catch(e){ return { ok:false, error:String(e) }; }
}
async function learnAdd(title, text, tags=[]){
  try{
    const r = await fetch(API_BASE + "/api/learn/add", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ title, text, tags }) });
    return await r.json();
  }catch(e){ return { ok:false, error:String(e) }; }
}

function wireDevMenu(){
  $("devTrigger")?.addEventListener("click", openDevMenu);
  $("closeDevBtn")?.addEventListener("click", ()=>{ $("devMenu").style.display = "none"; });

  // click actions (one listener)
  document.addEventListener("click", async (e)=>{
    const t = e.target;

    if(t?.id === "saveKeysBtn"){
      const pin = getPin() || prompt("PIN DevMenu:");
      if(!pin) return;
      sessionStorage.setItem("herencia_dev_pin", pin);
      const keys = {
        groq: $("keyGroq")?.value?.trim() || "",
        plant_general: $("keyPlantGeneral")?.value?.trim() || "",
        plant_fungus: $("keyPlantFungus")?.value?.trim() || "",
        plant_insects: $("keyPlantInsects")?.value?.trim() || "",
        plant_care: $("keyPlantCare")?.value?.trim() || ""
      };
      try{
        const r = await apiFetch("/api/dev/save-keys", keys, pin);
        addDevLog(r.ok ? "✅ Keys guardadas (persisten al reiniciar)" : "⚠️ No se pudo guardar keys");
      }catch(_){
        addDevLog("⚠️ No se pudo guardar keys");
      }
    }

    if(t?.id === "testGroqBtn"){
      const pin = getPin() || prompt("PIN DevMenu:");
      if(!pin) return;
      sessionStorage.setItem("herencia_dev_pin", pin);
      addDevLog("🧪 Probando Groq…");
      try{
        const r = await apiFetch("/api/dev/test-groq", {}, pin);
        addDevLog(r.ok ? "✅ Groq OK" : "⚠️ Groq FAIL");
        if(r.reply) addDevLog(String(r.reply).slice(0, 180));
      }catch(_){
        addDevLog("⚠️ Groq FAIL (sin respuesta)");
      }
    }

    if(t?.id === "testVoiceBtn"){
      speak("Hola, soy Herenc(IA). Te leo con esta voz.");
      addDevLog("🔊 Probando voz…");
    }

    if(t?.id === "exportConfigBtn"){
      const pin = getPin() || prompt("PIN DevMenu:");
      if(!pin) return;
      sessionStorage.setItem("herencia_dev_pin", pin);
      try{
        const r = await apiFetch("/api/dev/get-config", {}, pin);
        const blob = new Blob([JSON.stringify(r, null, 2)], { type:"application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "herencia_config.json";
        a.click();
        URL.revokeObjectURL(url);
        addDevLog("✅ Config exportada");
      }catch(_){
        addDevLog("⚠️ Error exportando config");
      }
    }

    if(t?.id === "reloadBrainBtn"){
      const pin = getPin() || prompt("PIN DevMenu:");
      if(!pin) return;
      sessionStorage.setItem("herencia_dev_pin", pin);
      addDevLog("🔄 Recargando cerebro…");
      try{
        const r = await apiFetch("/api/dev/reload", {}, pin);
        addDevLog(r.ok ? "✅ Cerebro recargado" : "⚠️ Error recargando");
        await devRefresh(pin);
      }catch(_){
        addDevLog("⚠️ Error recargando");
      }
    }

    if(t?.id === "clearTrainingBtn"){
      const pin = getPin() || prompt("PIN DevMenu:");
      if(!pin) return;
      sessionStorage.setItem("herencia_dev_pin", pin);
      addDevLog("🧹 Borrando entrenamiento…");
      try{
        const r = await apiFetch("/api/dev/clear-training", {}, pin);
        addDevLog(r.ok ? "✅ Entrenamiento borrado" : "⚠️ Error borrando entrenamiento");
      }catch(_){
        addDevLog("⚠️ Error borrando entrenamiento");
      }
    }

    if(t?.id === "feederFetchBtn"){
      const pin = getPin() || prompt("PIN DevMenu:");
      if(!pin) return;
      sessionStorage.setItem("herencia_dev_pin", pin);
      const url = ($("feederUrl")?.value || "").trim();
      if(!url) return addDevLog("⚠️ Pega una URL");
      addDevLog("🌐 Aprendiendo URL…");
      try{
        const r = await apiFetch("/api/dev/feed-url", { url }, pin);
        addDevLog(r.ok ? `✅ Feed guardado (${r.chars||0} chars)` : `⚠️ Feed error: ${r.error||"?"}`);
      }catch(_){
        addDevLog("⚠️ Feed error");
      }
    }

    if(t?.id === "feederClearBtn"){
      const pin = getPin() || prompt("PIN DevMenu:");
      if(!pin) return;
      sessionStorage.setItem("herencia_dev_pin", pin);
      addDevLog("🧽 Borrando feeds…");
      try{
        const r = await apiFetch("/api/dev/clear-feeds", {}, pin);
        addDevLog(r.ok ? "✅ Feeds borrados" : "⚠️ Error borrando feeds");
      }catch(_){
        addDevLog("⚠️ Error borrando feeds");
      }
    }
  });

  // change handler (select/checkbox)
  document.addEventListener("change", async (e)=>{
    const t = e.target;

    // voice + language
    if(t?.id === "voiceSelect"){
      selectedVoiceName = t.value || "";
      localStorage.setItem("herencia_voice", selectedVoiceName);
      addDevLog("🔊 Voz actualizada");
    }
    if(t?.id === "langSelect"){
      lang = t.value || "es";
      localStorage.setItem("herencia_lang", lang);
      addDevLog("🌍 Idioma actualizado");
    }
    if(t?.id === "micPulseDev"){
      micPulse = !!t.checked;
      localStorage.setItem("herencia_mic_pulse", micPulse ? "1" : "0");
      addDevLog("🎙 Mic pulso actualizado");
    }
    if(t?.id === "micModeSelect"){
      micMode = t.value || "hold";
      localStorage.setItem("herencia_mic_mode", micMode);
      addDevLog("🎙 Modo mic actualizado");
      location.reload(); // rebind cleanly
    }
    if(t?.id === "autoScanDev"){
      autoScan = !!t.checked;
      localStorage.setItem("herencia_auto_scan", autoScan ? "1" : "0");
      addDevLog("📟 AutoScan actualizado");
    }
    if(t?.id === "scanIntervalSelect"){
      scanIntervalSec = parseInt(t.value || "3", 10);
      localStorage.setItem("herencia_scan_interval", String(scanIntervalSec));
      addDevLog("⏱ Intervalo escáner actualizado");
    }

    // config -> backend
    if(t?.id === "modelSelect" || t?.id === "personaSelect" || t?.id === "debugMode" || t?.id === "autoRepair" || t?.id === "groqModelSelect"){
      const pin = getPin() || prompt("PIN DevMenu:");
      if(!pin) return;
      sessionStorage.setItem("herencia_dev_pin", pin);

      const payload = {};
      if(t.id === "modelSelect") payload.mode = t.value;
      if(t.id === "personaSelect") payload.persona = t.value;
      if(t.id === "debugMode") payload.debug = !!t.checked;
      if(t.id === "autoRepair") payload.autoRepair = !!t.checked;
      if(t.id === "groqModelSelect") payload.groq_model = t.value;

      const r = await devSetConfig(pin, payload);
      addDevLog(r.ok ? "✅ Config guardada" : "⚠️ Error guardando config");
      if(t.id === "groqModelSelect") addDevLog("🤖 Groq model actualizado");
    }
  });

  // existing buttons in HTML dev menu
  $("clearChatDevBtn")?.addEventListener("click", ()=>{
    $("messages").innerHTML = "";
    addDevLog("🧹 Chat limpiado (UI)");
  });

  $("resetBrainBtn")?.addEventListener("click", async ()=>{
    const pin = getPin() || prompt("PIN DevMenu:");
    if(!pin) return;
    sessionStorage.setItem("herencia_dev_pin", pin);
    const r = await apiFetch("/api/dev/clear-memory", {}, pin);
    addDevLog(r.ok ? "🧠 Memoria borrada" : "⚠️ Error borrando memoria");
  });

  $("saveMemoryBtn")?.addEventListener("click", async ()=>{
    const pin = getPin() || prompt("PIN DevMenu:");
    if(!pin) return;
    sessionStorage.setItem("herencia_dev_pin", pin);
    const payload = {
      short: $("shortMem")?.value || "",
      mid: $("midMem")?.value || "",
      long: $("longMem")?.value || ""
    };
    const r = await apiFetch("/api/dev/save-memory", payload, pin);
    addDevLog(r.ok ? "💾 Memorias guardadas" : "⚠️ Error guardando memorias");
  });

  $("trainBtn")?.addEventListener("click", async ()=>{
    const pin = getPin() || prompt("PIN DevMenu:");
    if(!pin) return;
    sessionStorage.setItem("herencia_dev_pin", pin);
    const examples = $("trainingInput")?.value || "";
    const r = await apiFetch("/api/dev/train", { examples }, pin);
    addDevLog(r.ok ? "🧠 Entrenamiento guardado" : "⚠️ Error entrenando");
  });


// Auto-learn toggle + manual save
const autoToggle = document.getElementById("autoLearnToggle");
const btnSaveLearn = document.getElementById("btnSaveLearning");
if(autoToggle){
  learnStatus().then(st => {
    if(st && st.ok) autoToggle.checked = !!st.auto_learn;
  });
  autoToggle.addEventListener("change", async () => {
    const r = await learnToggle(!!autoToggle.checked);
    logOk(r && r.ok ? ("Auto-aprender: " + (r.auto_learn ? "ON" : "OFF")) : ("Error Auto-aprender"));
  });
}
if(btnSaveLearn){
  btnSaveLearn.addEventListener("click", async () => {
    const last = (window.__lastAssistantText || "").trim();
    if(!last || last.length < 40){ logWarn("Nada que guardar (respuesta muy corta)"); return; }
    const title = (last.split("\n")[0] || "Aprendizaje").slice(0,120);
    const r = await learnAdd(title, last, []);
    logOk(r && r.ok ? "Aprendizaje guardado" : ("Error guardando aprendizaje"));
  });
}
}

function injectWatermark(){
  // watermark outside chat, bottom area
  let wm = document.getElementById("herenciaWatermark");
  if(wm) return;
  wm = document.createElement("div");
  wm.id = "herenciaWatermark";
  wm.textContent = WATERMARK_TEXT;
  wm.style.position = "fixed";
  wm.style.left = "50%";
  wm.style.bottom = "10px";
  wm.style.transform = "translateX(-50%)";
  wm.style.maxWidth = "92vw";
  wm.style.textAlign = "center";
  wm.style.fontSize = "12px";
  wm.style.letterSpacing = "0.4px";
  wm.style.color = "rgba(200,200,200,0.55)";
  wm.style.background = "rgba(0,0,0,0.18)";
  wm.style.padding = "6px 10px";
  wm.style.borderRadius = "10px";
  wm.style.backdropFilter = "blur(2px)";
  wm.style.pointerEvents = "none";
  wm.style.zIndex = "9999";
  document.body.appendChild(wm);
}

// ================= INIT =================
wireSend();
injectWatermark();

addMsg("bot", "🌿 Hola, soy Herenc(IA). ¿Qué planta quieres cuidar hoy?");
