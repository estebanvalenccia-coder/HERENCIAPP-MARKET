// Botón visual separado para llamada AssemblyAI. No toca el micro normal.
(function(){
  function byId(id){ return document.getElementById(id); }
  function styles(){
    if(byId('assemblyVoiceButtonStyles')) return;
    var s=document.createElement('style');
    s.id='assemblyVoiceButtonStyles';
    s.textContent='.assembly-call-shell{width:76px;height:46px;border-radius:999px;background:#1e1e1e;border:0;padding:5px;display:flex;align-items:center;justify-content:flex-end;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.28);flex:0 0 auto}.assembly-call-shell:hover{transform:translateY(-1px) scale(1.03)}.assembly-call-shell.active{background:#14220f;box-shadow:0 0 0 8px rgba(75,107,31,.16),0 12px 30px rgba(0,0,0,.38)}.assembly-call-orb{width:36px;height:36px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center}.assembly-wave-icon{width:22px;height:22px;display:flex;align-items:center;justify-content:center;gap:2px}.assembly-wave-icon span{display:block;width:3px;border-radius:999px;background:#111}.assembly-wave-icon span:nth-child(1){height:8px}.assembly-wave-icon span:nth-child(2){height:15px}.assembly-wave-icon span:nth-child(3){height:20px}.assembly-wave-icon span:nth-child(4){height:13px}.assembly-wave-icon span:nth-child(5){height:7px}.assembly-call-shell.active .assembly-wave-icon span{animation:assemblyWaveBars .72s infinite ease-in-out}.assembly-call-shell.active .assembly-wave-icon span:nth-child(2){animation-delay:.08s}.assembly-call-shell.active .assembly-wave-icon span:nth-child(3){animation-delay:.16s}.assembly-call-shell.active .assembly-wave-icon span:nth-child(4){animation-delay:.24s}.assembly-call-shell.active .assembly-wave-icon span:nth-child(5){animation-delay:.32s}@keyframes assemblyWaveBars{0%,100%{transform:scaleY(.75);opacity:.75}50%{transform:scaleY(1.25);opacity:1}}';
    document.head.appendChild(s);
  }
  function icon(){ return '<div class="assembly-wave-icon"><span></span><span></span><span></span><span></span><span></span></div>'; }
  function toggleAssemblyCall(event){
    if(event){
      event.preventDefault();
      event.stopPropagation();
      if(typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }

    if(typeof window.HerenciaAssemblyVoiceCallToggle === 'function'){
      window.HerenciaAssemblyVoiceCallToggle();
      return;
    }

    window.dispatchEvent(new CustomEvent('herencia:assembly-call-toggle'));
  }
  function boot(){
    styles();
    var existing=byId('assemblyVoiceCallButton');
    if(existing){
      if(existing.dataset.assemblyVisualBound!=='1'){
        existing.dataset.assemblyVisualBound='1';
        existing.addEventListener('click',toggleAssemblyCall,true);
      }
      return;
    }
    var mic=byId('micButton');
    if(!mic || !mic.parentElement) return;
    var b=document.createElement('button');
    b.id='assemblyVoiceCallButton';
    b.type='button';
    b.className='assembly-call-shell';
    b.title='Llamada online con HERENC(IA)';
    b.innerHTML='<div class="assembly-call-orb">'+icon()+'</div>';
    b.dataset.assemblyVisualBound='1';
    mic.parentElement.insertBefore(b,mic.nextSibling);
    b.addEventListener('click',toggleAssemblyCall,true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  setTimeout(boot,300);
  setTimeout(boot,1000);
})();
