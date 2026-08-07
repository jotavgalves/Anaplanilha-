(()=>{
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
    if(window.lucide)lucide.createIcons({attrs:{'stroke-width':1.9}});
  }

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
      if(!password){feedback.className='admin-credential-feedback error';feedback.textContent='Digite a senha administrativa.';return;}
      button.disabled=true;
      feedback.className='admin-credential-feedback';
      feedback.textContent='Validando credencial...';
      try{
        const response=await fetch('/api/admin-toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password}),cache:'no-store'});
        const data=await response.json().catch(()=>({}));
        if(!response.ok||!data.ok)throw new Error(data.error||`HTTP ${response.status}`);
        feedback.className='admin-credential-feedback success';
        feedback.textContent=`Perfil alterado para ${data.profileName}. Recarregando...`;
        input.value='';
        if(typeof toast==='function')toast(`Perfil alterado para ${data.profileName}.`);
        setTimeout(()=>window.location.reload(),500);
      }catch(error){
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

  ensureAdminField();
  paintIdentity();
})();
