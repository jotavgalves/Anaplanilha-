(()=>{
  const actions=document.querySelector('.topactions');
  if(!actions)return;

  const more=document.createElement('button');
  more.type='button';
  more.id='mobileMoreBtn';
  more.className='btn mobile-more-btn';
  more.setAttribute('aria-label','Mais opções');
  more.innerHTML='<i data-lucide="ellipsis"></i>';
  actions.appendChild(more);

  const menu=document.createElement('div');
  menu.id='mobileMoreMenu';
  menu.className='mobile-more-menu';
  menu.innerHTML=`
    <button type="button" data-mobile-view="audit"><i data-lucide="history"></i><span><b>Atividades</b><small>Histórico de alterações</small></span></button>
    <button type="button" data-mobile-view="settings"><i data-lucide="settings-2"></i><span><b>Configurações</b><small>Planilha, metas e sincronização</small></span></button>`;
  document.body.appendChild(menu);

  more.onclick=e=>{e.stopPropagation();menu.classList.toggle('open');};
  menu.querySelectorAll('[data-mobile-view]').forEach(b=>b.onclick=()=>{menu.classList.remove('open');switchView(b.dataset.mobileView);});
  document.addEventListener('click',e=>{if(!menu.contains(e.target)&&e.target!==more)menu.classList.remove('open');});

  document.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.classList.remove('open');if(document.querySelector('#drawer.open'))closeDrawer();}});

  let touchStartX=null;
  const drawer=document.querySelector('#drawer');
  drawer?.addEventListener('touchstart',e=>{touchStartX=e.touches[0]?.clientX??null;},{passive:true});
  drawer?.addEventListener('touchend',e=>{
    if(touchStartX==null)return;
    const end=e.changedTouches[0]?.clientX??touchStartX;
    if(end-touchStartX>85)closeDrawer();
    touchStartX=null;
  },{passive:true});

  refreshIcons();
})();
