(()=>{
  const mobileCss=document.createElement('link');
  mobileCss.rel='stylesheet';
  mobileCss.href='./mobile-v2.css?v=20260807-1615';
  document.head.appendChild(mobileCss);

  const sourceCss=document.createElement('link');
  sourceCss.rel='stylesheet';
  sourceCss.href='./source-fix.css?v=20260807-1615';
  document.head.appendChild(sourceCss);

  const enhancementsCss=document.createElement('link');
  enhancementsCss.rel='stylesheet';
  enhancementsCss.href='./enhancements.css?v=20260807-1615';
  document.head.appendChild(enhancementsCss);

  const loadScript=src=>new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src=src;
    s.onload=resolve;
    s.onerror=()=>reject(new Error(`Falha ao carregar ${src}`));
    document.body.appendChild(s);
  });

  (async()=>{
    try{
      await loadScript("./app-1.js?v=20260807-1615");
      await loadScript("./cloud-state.js?v=20260807-1615");
      if(window.__cloudStateReady) await window.__cloudStateReady;
      await loadScript("./app-2.js?v=20260807-1615");
      await loadScript("./perf-core.js?v=20260807-1615");
      await loadScript("./app-3.js?v=20260807-1615");
      await loadScript("./perf-after.js?v=20260807-1615");
      await loadScript("./cloud-after.js?v=20260807-1615");
      await loadScript("./mobile-ui.js?v=20260807-1615");
      await loadScript("./mobile-ui-v2.js?v=20260807-1615");
      await loadScript("./source-fix.js?v=20260807-1615");
      await loadScript("./enhancements.js?v=20260807-1615");
    }catch(error){
      console.error(error);
      const banner=document.querySelector("#banner");
      if(banner){banner.style.display="block";banner.textContent="Falha ao iniciar o sistema. Atualize a página.";}
    }
  })();
})();
