// mic_fix.js — controlador único del micrófono para HERENC(IA)
// Micro normal: usa SpeechRecognition del navegador. NO usa AssemblyAI.
(function(){
  'use strict';

  window.__HERENCIA_MIC_FIX_VERSION__ = '2026-05-08-browser-transcription-restored-v7';

  const LANG_MAP = { es:'es-ES', en:'en-GB', ca:'ca-ES', fr:'fr-FR' };

  let recognition = null;
  let listening = false;
  let shouldRestart = false;
  let requestingPermission = false;
  let baseText = '';
  let finalText = '';
  let lastToggleAt = 0;

  function $(id){ return document.getElementById(id); }
  function input(){ return $('userInput'); }
  function mic(){ return $('micButton'); }

  function activeLang(){
    return LANG_MAP[localStorage.getItem('herencia_lang') || 'es'] || 'es-ES';
  }

  function isSafeOrigin(){
    const local = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
    return window.isSecureContext || location.protocol === 'https:' || local;
  }

  function SR(){ return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
  function safePrevent(e){ if(e && e.cancelable) e.preventDefault(); }

  function notice(text){
    const box = $('messages');
    if(!box){ alert(text); return; }
    const div = document.createElement('div');
    div.className = 'msg bot';
    div.textContent = text;
    box.appendChild(div);
    if(box.parentElement) box.parentElement.scrollTop = box.parentElement.scrollHeight;
  }

  function paint(on, pending){
    const b = mic();
    if(!b) return;
    b.disabled = !!pending;
    b.style.opacity = pending ? '.70' : '';
    b.style.background = on ? '#ffdddd' : 'white';
    b.style.borderColor = on ? '#ff6666' : '#dcdcdc';
    b.style.boxShadow = on ? '0 0 0 8px rgba(255,0,0,.16)' : '';
    b.title = pending ? 'Pidiendo permiso al micrófono...' : on ? 'Escuchando... pulsa otra vez para parar' : 'Pulsa para hablar';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function write(interim){
    const el = input();
    if(!el) return;
    el.value = [baseText, finalText, interim]
      .map(v => (v || '').trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    el.dispatchEvent(new Event('input', { bubbles:true }));
    el.focus();
    try{ el.setSelectionRange(el.value.length, el.value.length); }catch(_){}
  }

  async function askPermission(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    try{ stream.getTracks().forEach(track => track.stop()); }catch(_){}
    return true;
  }

  function makeRecognition(){
    const Ctor = SR();
    if(!Ctor) return null;
    const r = new Ctor();
    r.lang = activeLang();
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = function(){
      listening = true;
      shouldRestart = true;
      paint(true, false);
      input()?.focus();
    };

    r.onresult = function(event){
      let interim = '';
      for(let i = event.resultIndex; i < event.results.length; i++){
        const piece = event.results[i][0].transcript || '';
        if(event.results[i].isFinal){
          finalText = (finalText + ' ' + piece).replace(/\s+/g, ' ').trim();
        }else{
          interim = (interim + ' ' + piece).replace(/\s+/g, ' ').trim();
        }
      }
      write(interim);
    };

    r.onerror = function(event){
      const err = event && event.error;

      if(err === 'not-allowed' || err === 'service-not-allowed'){
        shouldRestart = false; listening = false; paint(false, false);
        notice('Permiso de micrófono bloqueado. Pulsa el candado del navegador, permite Micrófono y recarga.');
        return;
      }

      if(err === 'audio-capture'){
        shouldRestart = false; listening = false; paint(false, false);
        notice('No encuentro ningún micrófono activo. Revisa que esté conectado y que otra app no lo esté usando.');
        return;
      }

      if(err === 'network'){
        shouldRestart = false; listening = false; paint(false, false);
        notice('El reconocimiento de voz del navegador falló por red/servicio. El micro normal no usa API. Prueba recargar y revisar que el micrófono no esté apagado.');
        return;
      }
    };

    r.onend = function(){
      if(shouldRestart && listening && document.visibilityState !== 'hidden'){
        setTimeout(() => { try{ recognition && recognition.start(); }catch(_){} }, 350);
      }else{
        paint(false, false);
      }
    };
    return r;
  }

  async function startMic(){
    if(requestingPermission) return;
    if(!isSafeOrigin()) return notice('El micrófono necesita HTTPS o localhost. Abre la web con https:// para permitir la transcripción.');
    if(!SR()) return notice('Tu navegador no soporta transcripción por voz. Usa Google Chrome o Microsoft Edge.');

    requestingPermission = true;
    paint(false, true);

    try{
      await askPermission();
    }catch(error){
      requestingPermission = false; shouldRestart = false; listening = false; paint(false, false);
      if(error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) return notice('Debes permitir acceso al micrófono para usar la transcripción. Pulsa el candado del navegador y permite Micrófono.');
      if(error && error.name === 'NotFoundError') return notice('No encontré ningún micrófono conectado.');
      if(error && error.name === 'NotReadableError') return notice('El micrófono está ocupado por otra aplicación o pestaña. Ciérrala y vuelve a probar.');
      return notice('No pude pedir permiso al micrófono. Revisa permisos del navegador y recarga.');
    }

    requestingPermission = false;
    try{ recognition && recognition.abort && recognition.abort(); }catch(_){}

    baseText = (input()?.value || '').trim();
    finalText = '';
    recognition = makeRecognition();

    if(!recognition){
      listening = false; shouldRestart = false; paint(false, false);
      return notice('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
    }

    listening = true;
    shouldRestart = true;
    paint(true, false);

    try{ recognition.start(); }
    catch(_){
      listening = false; shouldRestart = false; paint(false, false);
      notice('No pude iniciar el micrófono. Cierra otras pestañas que usen el micro y recarga.');
    }
  }

  function stopMic(){
    requestingPermission = false;
    shouldRestart = false;
    listening = false;
    paint(false, false);
    try{ recognition && recognition.stop && recognition.stop(); }catch(_){}
    write('');
    input()?.focus();
  }

  function toggle(e){
    safePrevent(e);
    if(e) e.stopImmediatePropagation();
    const now = Date.now();
    if(now - lastToggleAt < 400) return;
    lastToggleAt = now;
    listening ? stopMic() : startMic();
  }

  function cleanButton(){
    const old = mic();
    if(!old) return null;
    const clone = old.cloneNode(true);
    clone.id = 'micButton';
    clone.onclick = null;
    clone.onmousedown = null;
    clone.onmouseup = null;
    clone.onmouseleave = null;
    clone.ontouchstart = null;
    clone.ontouchend = null;
    old.replaceWith(clone);
    return clone;
  }

  function install(){
    if(!input()) return false;
    const b = cleanButton();
    if(!b) return false;

    b.addEventListener('click', toggle, { capture:true, passive:false });
    b.addEventListener('touchend', toggle, { capture:true, passive:false });

    ['mousedown','mouseup','mouseleave','touchstart'].forEach(type => {
      b.addEventListener(type, function(e){
        safePrevent(e);
        e.stopImmediatePropagation();
      }, { capture:true, passive:false });
    });

    window.__HERENCIA_MIC_START__ = startMic;
    window.__HERENCIA_MIC_STOP__ = stopMic;
    window.__HERENCIA_INSTALL_MIC__ = install;
    window.__HERENCIA_MIC_READY__ = true;
    return true;
  }

  function boot(){
    [0,250,800,1600,3200,5500].forEach(ms => setTimeout(install, ms));
  }

  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden') stopMic();
  });

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
