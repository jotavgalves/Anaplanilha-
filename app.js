(()=>{
  const addCss=href=>{const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l)};
  addCss('./mobile-v2.css?v=20260807-1640');
  addCss('./source-fix.css?v=20260807-1640');
  addCss('./enhancements.css?v=20260807-1640');
  addCss('./integrity.css?v=20260807-1640');

  const loadScript=src=>new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error(`Falha ao carregar ${src}`));document.body.appendChild(s);
  });

  (async()=>{
    try{
      await loadScript('./app-1.js?v=20260807-1640');
      await loadScript('./cloud-state.js?v=20260807-1640');
      if(window.__cloudStateReady) await window.__cloudStateReady;
      await loadScript('./app-2.js?v=20260807-1640');
      await loadScript('./perf-core.js?v=20260807-1640');
      await loadScript('./audit-pre.js?v=20260807-1640');
      await loadScript('./app-3.js?v=20260807-1640');
      await loadScript('./perf-after.js?v=20260807-1640');
      await loadScript('./cloud-after.js?v=20260807-1640');
      await loadScript('./mobile-ui.js?v=20260807-1640');
      await loadScript('./mobile-ui-v2.js?v=20260807-1640');
      await loadScript('./source-fix.js?v=20260807-1640');
      await loadScript('./enhancements.js?v=20260807-1640');
      await loadScript('./integrity.js?v=20260807-1640');
    }catch(error){
      console.error(error);const banner=document.querySelector('#banner');if(banner){banner.style.display='block';banner.textContent='Falha ao iniciar o sistema. Atualize a página.';}
    }
  })();
})();
