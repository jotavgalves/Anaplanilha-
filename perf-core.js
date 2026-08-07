let __anaIconFrame=0;
function refreshIcons(){
  if(!window.lucide||__anaIconFrame)return;
  __anaIconFrame=requestAnimationFrame(()=>{
    __anaIconFrame=0;
    lucide.createIcons({attrs:{"stroke-width":1.9}});
  });
}
function renderCurrentView(){
  const id=document.querySelector('.view.active')?.id||'dashboard';
  if(id==='dashboard')renderDashboard();
  else if(id==='orders')renderOrders();
  else if(id==='clients')renderClients();
  else if(id==='manual')renderManuals();
  else if(id==='pending')renderPending();
  else if(id==='audit')renderAudit();
  else if(id==='settings')$('#csvEndpoint').textContent=endpoint().replace(/&t=\d+$/,'');
}
function renderAll(){
  syncSourceSwitch();
  renderCurrentView();
  refreshIcons();
}
function renderAudit(){
  const a=JSON.parse(localStorage.getItem(K.audit)||'[]').slice(0,200);
  $('#auditList').innerHTML=a.length?a.map(x=>`<div class="audititem"><time>${new Date(x.time).toLocaleString('pt-BR')}</time><div class="auditkind ${x.type}">${x.type==='delete'?'EXCLUSÃO':x.type==='change'?'ALTERAÇÃO':x.type==='add'?'ADIÇÃO':'MANUAL'}</div><div>${esc(x.msg)}</div></div>`).join(''):'<div class="empty">Nenhuma atividade registrada ainda.</div>';
}
