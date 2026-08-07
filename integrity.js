(()=>{
  let orderNotes={};
  let clientNotes={};
  let auditCache=[];

  async function api(url,options={}){
    const res=await fetch(url,{cache:'no-store',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok)throw new Error(data.error||`HTTP ${res.status}`);
    return data;
  }

  function indexAnnotations(rows){
    orderNotes={};clientNotes={};
    for(const n of rows||[]){
      const note={id:n.id,text:n.text,time:n.updated_at||n.created_at,createdAt:n.created_at,updatedAt:n.updated_at};
      if(n.scope==='order'){
        orderNotes[n.entity_key]=orderNotes[n.entity_key]||[];
        orderNotes[n.entity_key].push(note);
      }else if(n.scope==='client') clientNotes[n.entity_key]=note;
    }
  }

  async function loadAnnotations(){
    try{const data=await api('/api/annotations?ts='+Date.now());indexAnnotations(data.annotations);return true}
    catch(e){console.error('Falha ao carregar anotações',e);return false}
  }

  window.cloudNotes=()=>orderNotes;
  window.cloudClientNotes=()=>clientNotes;

  renderNotes=function(){
    const list=orderNotes[currentOrderKey]||[];
    $('#noteList').innerHTML=list.length?list.map(n=>`<div class="note durable-note"><div>${esc(n.text)}</div><div class="note-foot"><time>${new Date(n.time).toLocaleString('pt-BR')}</time><button type="button" class="note-delete" data-note-id="${esc(n.id)}">Excluir</button></div></div>`).join(''):'<div class="muted">Nenhuma anotação.</div>';
    $('#noteList').querySelectorAll('[data-note-id]').forEach(b=>b.onclick=async()=>{
      b.disabled=true;
      try{await api('/api/annotations?id='+encodeURIComponent(b.dataset.noteId),{method:'DELETE'});await loadAnnotations();renderNotes();toast('Anotação excluída.')}catch(e){toast('Não consegui excluir a anotação.')}finally{b.disabled=false}
    });
  };

  const add=$('#addNote');
  if(add)add.onclick=async()=>{
    const text=$('#noteText').value.trim();
    if(!text||!currentOrderKey)return;
    add.disabled=true;
    try{
      await api('/api/annotations',{method:'POST',body:JSON.stringify({scope:'order',entityKey:currentOrderKey,text})});
      $('#noteText').value='';
      await loadAnnotations();
      renderNotes();
      auditAdd('manual',`Anotação adicionada ao pedido ${currentOrderKey}.`);
      toast('Anotação gravada no banco.');
    }catch(e){console.error(e);toast('Não consegui gravar a anotação.');}
    finally{add.disabled=false}
  };

  const noteModal=$('#clientNoteModalBack');
  if(noteModal){
    let currentClientKey='',currentClientName='';
    window.openClientNote=(encodedKey,encodedName)=>{
      currentClientKey=decodeURIComponent(encodedKey);currentClientName=decodeURIComponent(encodedName);
      $('#clientNoteTitle').textContent=`Anotação · ${currentClientName}`;
      $('#clientNoteText').value=clientNotes[currentClientKey]?.text||'';
      noteModal.classList.add('open');
      setTimeout(()=>$('#clientNoteText').focus(),30);
    };
    $('#clientNoteSave').onclick=async()=>{
      const text=$('#clientNoteText').value.trim();if(!currentClientKey)return;
      const btn=$('#clientNoteSave');btn.disabled=true;
      try{
        if(text)await api('/api/annotations',{method:'POST',body:JSON.stringify({scope:'client',entityKey:currentClientKey,text})});
        else await api('/api/annotations?scope=client&entity='+encodeURIComponent(currentClientKey),{method:'DELETE'});
        await loadAnnotations();noteModal.classList.remove('open');renderClients();auditAdd('manual',`Anotação do cliente ${currentClientName} foi ${text?'salva':'removida'}.`);toast(text?'Anotação gravada no banco.':'Anotação removida.');
      }catch(e){console.error(e);toast('Não consegui salvar a anotação.')}finally{btn.disabled=false}
    };
    $('#clientNoteRemove').onclick=async()=>{
      if(!currentClientKey)return;const btn=$('#clientNoteRemove');btn.disabled=true;
      try{await api('/api/annotations?scope=client&entity='+encodeURIComponent(currentClientKey),{method:'DELETE'});await loadAnnotations();noteModal.classList.remove('open');renderClients();auditAdd('manual',`Anotação do cliente ${currentClientName} foi removida.`);toast('Anotação removida.')}catch(e){toast('Não consegui remover a anotação.')}finally{btn.disabled=false}
    };
  }

  function canonicalForAudit(rows){return rows.map(canonicalSheet).map(r=>({seller:r.seller,orderId:r.orderId,clientId:r.clientId,name:r.name,value:r.value,payment:r.payment,paymentDate:r.paymentDate,status:r.status,document:r.document,phone:r.phone,email:r.email,birth:r.birth,method:r.method,installments:r.installments,description:r.description,due:r.due,delivered:r.delivered}))}

  compareSnapshot=function(rows){
    api('/api/sheet-audit',{method:'POST',body:JSON.stringify({rows:canonicalForAudit(rows)})}).then(data=>{
      auditCache=data.audit||[];
      if((data.events||[]).length){
        const n=data.events.length;
        toast(`${n} alteração${n===1?'':'ões'} da planilha detectada${n===1?'':'s'}.`);
        if($('#audit')?.classList.contains('active'))renderAudit();
      }
    }).catch(e=>console.error('Falha na auditoria da planilha',e));
  };

  function auditKind(type){
    if(type==='sheet_delete'||type==='delete')return ['EXCLUSÃO','delete'];
    if(type==='sheet_change'||type==='change')return ['ALTERAÇÃO','change'];
    if(type==='sheet_add'||type==='add')return ['ADIÇÃO','add'];
    return ['MANUAL','manual'];
  }
  function val(v){if(v===null||v===undefined||v==='')return 'vazio';if(typeof v==='number')return String(v);return String(v)}
  renderAudit=function(){
    const list=(auditCache.length?auditCache:(window.cloudAudit?.()||[])).slice(0,500);
    $('#auditList').innerHTML=list.length?list.map(x=>{
      const [label,cls]=auditKind(x.type);
      const changes=Array.isArray(x.changes)&&x.changes.length?`<div class="audit-changes">${x.changes.map(c=>`<div><b>${esc(c.label||c.field)}</b><span>${esc(val(c.before))}</span><i>→</i><span>${esc(val(c.after))}</span></div>`).join('')}</div>`:'';
      return `<div class="audititem audititem-rich"><time>${new Date(x.time).toLocaleString('pt-BR')}</time><div class="auditkind ${cls}">${label}</div><div><b class="audit-message">${esc(x.msg||'Alteração registrada')}</b>${changes}<small class="audit-detected">Horário registrado: ${new Date(x.time).toLocaleString('pt-BR')}</small></div></div>`;
    }).join(''):'<div class="empty">Nenhuma atividade registrada ainda.</div>';
  };

  async function refreshAudit(){
    try{const data=await api('/api/state?audit='+Date.now());auditCache=Array.isArray(data.state?.audit)?data.state.audit:[];if($('#audit')?.classList.contains('active'))renderAudit()}catch(e){console.error('Falha ao carregar histórico',e)}
  }

  document.querySelectorAll('.nav button[data-view="audit"],[data-mobile-view="audit"]').forEach(b=>b.addEventListener('click',()=>setTimeout(refreshAudit,30)));

  (async()=>{
    await loadAnnotations();
    if($('#clients')?.classList.contains('active'))renderClients();
    await refreshAudit();
    // Reenvia o estado atual da planilha para criar/atualizar a linha de base da auditoria server-side.
    if(sheetData?.length)compareSnapshot(sheetData);else setTimeout(()=>{if(sheetData?.length)compareSnapshot(sheetData)},1500);
  })();
})();
