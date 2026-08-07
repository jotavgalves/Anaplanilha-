(()=>{
  const manualForm=document.querySelector('#manualForm');
  let bypassDuplicate=false;
  let pendingDuplicate=null;

  const dateKey=value=>{
    const d=typeof parseDate==='function'?parseDate(value):new Date(value);
    if(!d||Number.isNaN(d.getTime()))return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const normalizedName=value=>typeof norm==='function'?norm(value):String(value||'').trim().toLowerCase();

  function findSheetDuplicates(formData){
    const name=normalizedName(formData.name);
    const value=typeof money==='function'?money(formData.value):Number(formData.value||0);
    const day=dateKey(formData.date||new Date());
    if(!name||!value||!day||!Array.isArray(sheetData))return [];
    return sheetData.map(canonicalSheet).filter(row=>
      normalizedName(row.name)===name &&
      Math.abs(Number(row.value||0)-value)<0.01 &&
      dateKey(row.paymentDate)===day
    );
  }

  function ensureDuplicateModal(){
    if(document.querySelector('#duplicateModalBack'))return;
    const back=document.createElement('div');
    back.id='duplicateModalBack';
    back.className='duplicate-backdrop';
    back.innerHTML=`
      <div class="duplicate-modal" role="dialog" aria-modal="true" aria-labelledby="duplicateTitle">
        <div class="duplicate-icon"><i data-lucide="copy-check"></i></div>
        <div class="duplicate-copy">
          <h3 id="duplicateTitle">Possível venda duplicada</h3>
          <p>Já encontrei na planilha uma venda com o mesmo cliente, valor e data.</p>
        </div>
        <div id="duplicateMatches" class="duplicate-matches"></div>
        <div class="duplicate-warning">Confira antes de continuar. Manter mesmo assim fará os dois registros entrarem nos cálculos.</div>
        <div class="duplicate-actions">
          <button type="button" id="duplicateCancel" class="btn">Cancelar lançamento</button>
          <button type="button" id="duplicateKeep" class="btn purple">Manter mesmo assim</button>
        </div>
      </div>`;
    document.body.appendChild(back);
    back.addEventListener('click',e=>{if(e.target===back)closeDuplicateModal();});
    document.querySelector('#duplicateCancel').onclick=closeDuplicateModal;
    document.querySelector('#duplicateKeep').onclick=()=>{
      if(!pendingDuplicate||!manualForm)return;
      bypassDuplicate=true;
      closeDuplicateModal();
      manualForm.requestSubmit();
      queueMicrotask(()=>{bypassDuplicate=false;pendingDuplicate=null;});
    };
    if(window.lucide)lucide.createIcons({attrs:{'stroke-width':1.9}});
  }

  function closeDuplicateModal(){
    document.querySelector('#duplicateModalBack')?.classList.remove('open');
  }

  function showDuplicateModal(formData,matches){
    ensureDuplicateModal();
    pendingDuplicate={formData,matches};
    const list=document.querySelector('#duplicateMatches');
    list.innerHTML=matches.slice(0,5).map(row=>`<div class="duplicate-match">
      <div><span>Cliente</span><b>${esc(row.name||'Não identificado')}</b></div>
      <div><span>Valor</span><b>${brl(row.value)}</b></div>
      <div><span>Data</span><b>${fmtDate(row.paymentDate)}</b></div>
      <div><span>Pedido</span><b>#${esc(row.orderId||'—')}</b></div>
    </div>`).join('');
    document.querySelector('#duplicateModalBack').classList.add('open');
    if(window.lucide)lucide.createIcons({attrs:{'stroke-width':1.9}});
  }

  if(manualForm){
    manualForm.addEventListener('submit',e=>{
      if(bypassDuplicate)return;
      const formData=Object.fromEntries(new FormData(manualForm).entries());
      if(formData.editId)return;
      const matches=findSheetDuplicates(formData);
      if(!matches.length)return;
      e.preventDefault();
      e.stopPropagation();
      if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
      showDuplicateModal(formData,matches);
    },true);
  }

  let activityData=Array.isArray(window.cloudAudit?.())?window.cloudAudit():[];

  function activityCategory(item){
    const type=String(item?.type||'');
    if(type==='sheet_delete'||type==='delete')return 'delete';
    if(type==='sheet_change'||type==='change')return 'change';
    if(type==='sheet_add'||type==='add')return 'add';
    return 'manual';
  }
  function activitySource(item){
    const type=String(item?.type||'');
    return item?.source==='sheet'||type.startsWith('sheet_')?'sheet':'system';
  }
  function activityDateKey(time){
    const d=new Date(time);
    if(Number.isNaN(d.getTime()))return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function searchableActivity(item){
    const changes=Array.isArray(item?.changes)?item.changes.flatMap(c=>[c.label,c.field,c.before,c.after]):[];
    return normalizedName([item?.msg,item?.orderId,item?.name,...changes].join(' '));
  }
  function ensureActivityFilters(){
    const audit=document.querySelector('#audit');
    const list=document.querySelector('#auditList');
    if(!audit||!list||document.querySelector('#activityFilters'))return;
    const box=document.createElement('div');
    box.id='activityFilters';
    box.className='activity-filters';
    box.innerHTML=`
      <div class="activity-search-wrap"><i data-lucide="search"></i><input id="activitySearch" class="input" placeholder="Buscar cliente, pedido, campo ou valor"></div>
      <select id="activityType" class="select">
        <option value="">Todos os eventos</option>
        <option value="change">Alterações</option>
        <option value="delete">Exclusões</option>
        <option value="add">Adições</option>
        <option value="manual">Ações manuais</option>
      </select>
      <select id="activitySource" class="select">
        <option value="">Todas as origens</option>
        <option value="sheet">Planilha</option>
        <option value="system">Sistema</option>
      </select>
      <input id="activityFrom" class="input" type="date" aria-label="Data inicial">
      <input id="activityTo" class="input" type="date" aria-label="Data final">
      <button id="activityClear" type="button" class="btn"><i data-lucide="filter-x"></i>Limpar</button>
      <span id="activityCount" class="activity-count"></span>`;
    list.parentElement.insertBefore(box,list);
    ['activitySearch','activityType','activitySource','activityFrom','activityTo'].forEach(id=>document.querySelector('#'+id).addEventListener(id==='activitySearch'?'input':'change',()=>renderAudit()));
    document.querySelector('#activityClear').onclick=()=>{
      ['activitySearch','activityType','activitySource','activityFrom','activityTo'].forEach(id=>document.querySelector('#'+id).value='');
      renderAudit();
    };
    if(window.lucide)lucide.createIcons({attrs:{'stroke-width':1.9}});
  }

  function filteredActivities(){
    ensureActivityFilters();
    const search=normalizedName(document.querySelector('#activitySearch')?.value||'');
    const type=document.querySelector('#activityType')?.value||'';
    const source=document.querySelector('#activitySource')?.value||'';
    const from=document.querySelector('#activityFrom')?.value||'';
    const to=document.querySelector('#activityTo')?.value||'';
    return activityData.filter(item=>{
      if(search&&!searchableActivity(item).includes(search))return false;
      if(type&&activityCategory(item)!==type)return false;
      if(source&&activitySource(item)!==source)return false;
      const day=activityDateKey(item.time);
      if(from&&day<from)return false;
      if(to&&day>to)return false;
      return true;
    });
  }

  const displayValue=v=>v===null||v===undefined||v===''?'vazio':String(v);
  renderAudit=function(){
    ensureActivityFilters();
    const list=filteredActivities();
    const count=document.querySelector('#activityCount');
    if(count)count.textContent=`${list.length} de ${activityData.length}`;
    const target=document.querySelector('#auditList');
    if(!target)return;
    target.innerHTML=list.length?list.slice(0,500).map(item=>{
      const category=activityCategory(item);
      const label={delete:'EXCLUSÃO',change:'ALTERAÇÃO',add:'ADIÇÃO',manual:'MANUAL'}[category];
      const changes=Array.isArray(item.changes)&&item.changes.length?`<div class="audit-changes">${item.changes.map(c=>`<div><b>${esc(c.label||c.field||'Campo')}</b><span>${esc(displayValue(c.before))}</span><i>→</i><span>${esc(displayValue(c.after))}</span></div>`).join('')}</div>`:'';
      const sourceLabel=activitySource(item)==='sheet'?'Planilha':'Sistema';
      return `<div class="audititem audititem-rich"><time>${new Date(item.time).toLocaleString('pt-BR')}</time><div class="auditkind ${category}">${label}</div><div><b class="audit-message">${esc(item.msg||'Atividade registrada')}</b>${changes}<small class="audit-detected">${sourceLabel} • ${activitySource(item)==='sheet'?'Detectado em':'Registrado em'} ${new Date(item.time).toLocaleString('pt-BR')}</small></div></div>`;
    }).join(''):'<div class="empty">Nenhuma atividade encontrada com esses filtros.</div>';
  };

  async function refreshActivityData(){
    try{
      const res=await fetch('/api/state?auditFilters='+Date.now(),{cache:'no-store'});
      const data=await res.json();
      if(res.ok&&data.ok&&Array.isArray(data.state?.audit))activityData=data.state.audit;
    }catch(error){
      console.error('Falha ao atualizar atividades',error);
      activityData=Array.isArray(window.cloudAudit?.())?window.cloudAudit():activityData;
    }
    if(document.querySelector('#audit')?.classList.contains('active'))renderAudit();
  }

  document.querySelectorAll('.nav button[data-view="audit"],[data-mobile-view="audit"]').forEach(button=>button.addEventListener('click',()=>setTimeout(refreshActivityData,40)));
  ensureActivityFilters();
})();
