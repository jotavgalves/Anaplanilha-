renderNotes = function(){
  const all=window.cloudNotes?window.cloudNotes():{};
  const a=all[currentOrderKey]||[];
  $('#noteList').innerHTML=a.map(n=>`<div class="note">${esc(n.text)}<time>${new Date(n.time).toLocaleString('pt-BR')}</time></div>`).join('')||'<div class="muted">Nenhuma anotação.</div>';
};

$('#addNote').onclick=()=>{
  const text=$('#noteText').value.trim();
  if(!text||!currentOrderKey)return;
  const all=structuredClone(window.cloudNotes?window.cloudNotes():{});
  all[currentOrderKey]=all[currentOrderKey]||[];
  all[currentOrderKey].unshift({text,time:new Date().toISOString()});
  window.saveCloudNotes(all);
  $('#noteText').value='';
  renderNotes();
  auditAdd('manual',`Anotação adicionada ao pedido ${currentOrderKey}.`);
  toast('Anotação salva online.');
};

$('#saveSettings').onclick=async()=>{
  const next={
    sheetUrl:$('#sheetUrlInput').value.trim(),
    sheetName:$('#sheetNameInput').value.trim(),
    interval:+$('#refreshInterval').value,
    g60:+$('#goal60').value,
    g80:+$('#goal80').value
  };
  await window.saveCloudSettings(next);
  setupTimer();
  await sync();
  toast('Configurações salvas online.');
};

$$('#sourceSwitch [data-source-mode]').forEach(button=>{
  button.onclick=async()=>{
    await window.saveCloudSettings({dashboardSource:button.dataset.sourceMode});
    syncSourceSwitch();
    renderDashboard();
    refreshIcons();
  };
});

const cloudLabel=document.createElement('div');
cloudLabel.id='cloudStatus';
cloudLabel.className='cloud-status '+(window.cloudStateOnline&&window.cloudStateOnline()?'online':'offline');
cloudLabel.innerHTML=window.cloudStateOnline&&window.cloudStateOnline()?'<span></span>Salvamento online':'<span></span>Banco não conectado';
document.querySelector('.topactions')?.appendChild(cloudLabel);

const noteStatus=document.querySelector('#drawer .cardhead span');
if(noteStatus) noteStatus.textContent='salvas online';
const sideFooter=document.querySelector('.sidefooter');
if(sideFooter) sideFooter.innerHTML='Google Sheets + banco online<br>Sincronização inteligente';

if(!(window.cloudStateOnline&&window.cloudStateOnline())){
  const b=$('#banner');
  b.style.display='block';
  b.innerHTML='<b>Persistência online ainda não conectada.</b> Crie um banco Cloudflare D1 e vincule-o ao projeto com o binding <b>DB</b>. Até isso ser feito, alterações desta sessão não ficam permanentemente salvas.';
}
refreshIcons();
