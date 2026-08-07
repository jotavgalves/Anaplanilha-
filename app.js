(()=>{
  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='./mobile-v2.css';
  document.head.appendChild(css);

  const loadScript=src=>new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src=src;
    s.onload=resolve;
    s.onerror=()=>reject(new Error(`Falha ao carregar ${src}`));
    document.body.appendChild(s);
  });

  (async()=>{
    try{
      await loadScript("./app-1.js");
      await loadScript("./cloud-state.js");
      if(window.__cloudStateReady) await window.__cloudStateReady;
      await loadScript("./app-2.js");
      await loadScript("./perf-core.js");
      await loadScript("./app-3.js");
      await loadScript("./perf-after.js");
      await loadScript("./cloud-after.js");
      await loadScript("./mobile-ui.js");
      await loadScript("./mobile-ui-v2.js");
    }catch(error){
      console.error(error);
      const banner=document.querySelector("#banner");
      if(banner){banner.style.display="block";banner.textContent="Falha ao iniciar o sistema. Atualize a página.";}
    }
  })();
})();
