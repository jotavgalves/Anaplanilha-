(()=>{
  const baseCfg=cfg;
  let runtimeSettings=null;

  cfg=function(){
    return Object.assign({},baseCfg(),runtimeSettings||{});
  };

  function currentProfile(){
    const s=typeof cfg==='function'?cfg():{};
    return s.profile==='dayane'?{key:'dayane',name:'Dayane'}:{key:'ana',name:'Ana'};
  }

  function paintIdentity(){
    const p=currentProfile();
    const brand=document.querySelector('.brandtext b');
    if(brand)brand.textContent=p.name;
    document.title=`${p.name} • Central de Vendas`;
    const pageTitle=document.querySelector('#pageTitle');
    const dashboard=document.querySelector('#dashboard');
    if(pageTitle&&dashboard?.classList.contains('active'))pageTitle.textContent=`Olá, ${p.name}!`;
    const badge=document.querySelector('#adminCurrentProfile');
    if(badge)badge.innerHTML=`<i data-lucide="user-round-cog"></i>Perfil atual: ${p.name}`;
    const goalCopy=document.querySelector('.goal-selector-copy small');
    if(goalCopy)goalCopy.textContent=`Escolha qual objetivo ${p.name} quer perseguir agora`;
    if(window.lucide)lucide.createIcons({attrs:{'stroke-width':1.9}});
  }

  const baseAllPaidRows=allPaidRows;
  allPaidRows=function(){
    const all=baseAllPaidRows();
    const seller=norm(cfg().sellerName||currentProfile().name);
    const sheet=all.filter(r=>r.source==='sheet'&&norm(r.seller)===seller);
    const manual=all.filter(r=>r.source==='manual');
    return [...sheet,...manual];
  };

  const originalSwitch=window.switchView||switchView;
  if(typeof originalSwitch==='function'){
    window.switchView=function(id){
      originalSwitch(id);
      const pageTitle=document.querySelector('#pageTitle');
      if(id==='dashboard'&&pageTitle)pageTitle.textContent=`Olá, ${currentProfile().name}!`;
      paintIdentity();
    };
    try{switchView=window.switchView}catch(_){ }
  }

  function ensureAdminField(){
    if(document.querySelector('#adminCredentialCard'))return;
    const settingsCard=document.querySelector('#settings .card.pad');
    if(!settingsCard)return;

    const box=document.createElement('section');
    box.id='adminCredentialCard';
    box.className='admin-credential-card';
    box.innerHTML=`
      <div class="admin-credential-head">
        <div>
          <h3>Senha administrativa</h3>
          <p>Credencie para alternar entre os perfis Ana e Dayane.</p>
        </div>
        <span id="adminCurrentProfile" class="admin-profile-badge"></span>
      </div>
      <div class="admin-credential-row">
        <label>Senha administrativa
          <input id="adminPassword" class="input" type="password" inputmode="numeric" autocomplete="off" placeholder="Digite a senha administrativa">
        </label>
        <button id="adminCredentialBtn" type="button" class="btn purple"><i data-lucide="key-round"></i>Credenciar</button>
      </div>
      <div id="adminCredentialFeedback" class="admin-credential-feedback"></div>`;

    settingsCard.appendChild(box);

    const input=document.querySelector('#adminPassword');
    const button=document.querySelector('#adminCredentialBtn');
    const feedback=document.querySelector('#adminCredentialFeedback');

    async function credential(){
      const password=input.value.trim();
      if(!password){
        feedback.className='admin-credential-feedback error';
        feedback.textContent='Digite a senha administrativa.';
        return;
      }

      const before=currentProfile();
      const targetProfile=before.key==='ana'?'dayane':'ana';
      const targetName=targetProfile==='dayane'?'Dayane':'Ana';

      button.disabled=true;
      feedback.className='admin-credential-feedback';
      feedback.textContent=`Credenciando ${targetName}...`;

      try{
        const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'toggleProfile',password,targetProfile}),cache:'no-store'});
        const data=await response.json().catch(()=>({}));
        if(!response.ok||!data.ok)throw new Error(data.error||`HTTP ${response.status}`);
        if(data.profile!==targetProfile||!data.settings)throw new Error('O servidor não confirmou o perfil solicitado.');

        runtimeSettings=data.settings;
        if(typeof window.applyRemoteSettings==='function'){
          try{window.applyRemoteSettings(data.settings)}catch(error){console.warn('Aplicação auxiliar do estado falhou; usando perfil confirmado pelo servidor.',error)}
        }

        input.value='';
        paintIdentity();
        if(typeof loadSettings==='function'){
          try{loadSettings()}catch(_){ }
        }

        feedback.className='admin-credential-feedback success';
        feedback.textContent=`Perfil alterado para ${data.profileName}. Reabrindo com a nova planilha...`;
        if(typeof toast==='function')toast(`Agora: ${data.profileName}.`);

        setTimeout(()=>{
          const url=new URL(window.location.href);
          url.searchParams.set('_profileSwitch',Date.now().toString());
          window.location.replace(url.toString());
        },450);
      }catch(error){
        console.error('Falha ao alternar perfil',error);
        feedback.className='admin-credential-feedback error';
        feedback.textContent=error.message||'Não foi possível credenciar.';
      }finally{
        button.disabled=false;
      }
    }

    button.onclick=credential;
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();credential();}});
    paintIdentity();
  }

  async function reconcileProfileWithServer(){
    try{
      const response=await fetch('/api/state?profile='+Date.now(),{cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      const settings=data?.state?.settings;
      if(response.ok&&data.ok&&settings?.profile){
        runtimeSettings=settings;
        if(typeof window.applyRemoteSettings==='function'){
          try{window.applyRemoteSettings(settings)}catch(_){ }
        }
        paintIdentity();
        if(typeof loadSettings==='function'){
          try{loadSettings()}catch(_){ }
        }
      }
    }catch(error){
      console.warn('Não foi possível reconciliar o perfil com o D1.',error);
    }
  }

  ensureAdminField();
  paintIdentity();
  reconcileProfileWithServer();
})();
