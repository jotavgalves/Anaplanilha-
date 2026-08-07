(()=>{
  const box=document.querySelector('#sourceSwitch');
  if(!box)return;

  let activeMode='all';
  try{ activeMode=(typeof dashboardSourceMode==='function'&&dashboardSourceMode())||'all'; }catch(_){ activeMode='all'; }

  // A partir daqui, todo o dashboard lê deste estado imediato.
  dashboardSourceMode=function(){ return activeMode; };

  const paint=()=>{
    box.querySelectorAll('[data-source-mode]').forEach(button=>{
      const active=button.dataset.sourceMode===activeMode;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    });
    if(typeof syncSourceSwitch==='function')syncSourceSwitch();
  };

  const apply=mode=>{
    if(!['all','sheet','manual'].includes(mode))return;
    activeMode=mode;
    paint();
    if(typeof renderDashboard==='function')renderDashboard();
    if(typeof refreshIcons==='function')refreshIcons();

    // Persistência nunca bloqueia a troca visual/cálculo.
    try{
      const save=window.saveCloudSettings?.({dashboardSource:mode});
      if(save&&typeof save.catch==='function') save.catch(error=>console.error('Falha ao persistir fonte do dashboard',error));
    }catch(error){ console.error('Falha ao persistir fonte do dashboard',error); }
  };

  const handle=e=>{
    const button=e.target.closest?.('[data-source-mode]');
    if(!button||!box.contains(button))return;
    e.preventDefault();
    e.stopPropagation();
    if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
    apply(button.dataset.sourceMode);
  };

  // Captura vence handlers antigos carregados anteriormente.
  box.addEventListener('pointerup',handle,true);
  box.addEventListener('click',handle,true);
  box.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    handle(e);
  },true);

  paint();
  window.__setDashboardSource=apply;
})();
