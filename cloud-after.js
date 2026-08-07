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

const cloudLabel=document.createElement('div');
cloudLabel.id='cloudStatus';
cloudLabel.className='cloud-status';
cloudLabel.innerHTML='<span></span>Verificando banco';
document.querySelector('.topactions')?.appendChild(cloudLabel);

function paintCloudStatus(online){
  cloudLabel.className='cloud-status '+(online?'online':'offline');
  cloudLabel.innerHTML=online?'<span></span>Banco conectado':'<span></span>Banco não conectado';
  const b=$('#banner');
  if(online && b && /Persistência online|Salvamento online|banco Cloudflare D1/i.test(b.textContent||'')) b.style.display='none';
}

(async()=>{
  const online=window.refreshCloudHealth?await window.refreshCloudHealth():(window.cloudStateOnline&&window.cloudStateOnline());
  paintCloudStatus(!!online);
})();

const noteStatus=document.querySelector('#drawer .cardhead span');
if(noteStatus) noteStatus.textContent='salvas online';
const sideFooter=document.querySelector('.sidefooter');
if(sideFooter) sideFooter.innerHTML='Google Sheets + banco online<br>Sincronização inteligente';

refreshIcons();
