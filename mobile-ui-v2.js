(()=>{
  const mobile=window.matchMedia('(max-width:760px)');

  function makeOptional(form,names,title){
    if(!mobile.matches||!form||form.querySelector('.mobile-optional'))return;
    const blocks=names.map(name=>form.elements[name]?.closest('div')).filter(Boolean);
    if(!blocks.length)return;
    const details=document.createElement('details');
    details.className='mobile-optional';
    details.innerHTML=`<summary>${title}</summary><div class="mobile-optional-body"></div>`;
    blocks[0].before(details);
    const body=details.querySelector('.mobile-optional-body');
    blocks.forEach(node=>body.appendChild(node));
  }

  function setupCompactForms(){
    makeOptional(document.querySelector('#manualForm'),['orderId','status','phone','document','email','due','description'],'Mais detalhes do pedido');
    makeOptional(document.querySelector('#pendingForm'),['method','due','note'],'Adicionar prazo e observações');
  }

  function setupSourceSwitch(){
    const box=document.querySelector('#sourceSwitch');
    if(!box)return;
    box.querySelectorAll('[data-source-mode]').forEach(button=>{
      button.setAttribute('role','button');
      button.onclick=e=>{
        e.preventDefault();e.stopPropagation();
        const mode=button.dataset.sourceMode;
        box.querySelectorAll('[data-source-mode]').forEach(b=>{
          const active=b.dataset.sourceMode===mode;
          b.classList.toggle('active',active);
          b.setAttribute('aria-pressed',active?'true':'false');
        });
        if(typeof window.saveCloudSettings==='function'){
          window.saveCloudSettings({dashboardSource:mode});
        }
        if(typeof syncSourceSwitch==='function')syncSourceSwitch();
        if(typeof renderDashboard==='function')renderDashboard();
        if(typeof refreshIcons==='function')refreshIcons();
      };
    });
  }

  function setupEditExpansion(){
    if(typeof window.editManual==='function'&&!window.editManual.__mobileWrapped){
      const original=window.editManual;
      const wrapped=id=>{original(id);document.querySelector('#manualForm .mobile-optional')?.setAttribute('open','');};
      wrapped.__mobileWrapped=true;window.editManual=wrapped;
    }
    if(typeof window.editPending==='function'&&!window.editPending.__mobileWrapped){
      const original=window.editPending;
      const wrapped=id=>{original(id);document.querySelector('#pendingForm .mobile-optional')?.setAttribute('open','');};
      wrapped.__mobileWrapped=true;window.editPending=wrapped;
    }
  }

  function setupKeyboardAwareNav(){
    if(!window.visualViewport)return;
    const initial=window.visualViewport.height;
    const update=()=>{
      const viewport=window.visualViewport;
      const keyboardLikely=viewport.height<Math.max(420,window.innerHeight*.72) || viewport.height<initial*.72;
      document.body.classList.toggle('keyboard-open',keyboardLikely);
    };
    window.visualViewport.addEventListener('resize',update,{passive:true});
    window.visualViewport.addEventListener('scroll',update,{passive:true});
  }

  function keepFocusedFieldVisible(){
    document.addEventListener('focusin',e=>{
      if(!mobile.matches||!e.target.matches('input,select,textarea'))return;
      setTimeout(()=>e.target.scrollIntoView({block:'center',behavior:'smooth'}),220);
    });
  }

  setupCompactForms();
  setupSourceSwitch();
  setupEditExpansion();
  setupKeyboardAwareNav();
  keepFocusedFieldVisible();
  if(typeof refreshIcons==='function')refreshIcons();
})();
