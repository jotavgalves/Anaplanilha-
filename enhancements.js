(()=>{
  const baseCfg=cfg;
  cfg=function(){
    return Object.assign({g40:40000,p40:3,g60:60000,p60:3.5,g80:80000,p80:4},baseCfg());
  };

  commission=function(total){
    const s=cfg();
    const pct=total>=Number(s.g80)?Number(s.p80):total>=Number(s.g60)?Number(s.p60):Number(s.p40);
    const safePct=Number.isFinite(pct)?pct:0;
    return {rate:safePct/100,value:total*(safePct/100),label:safePct.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%'};
  };

  const goals=()=>{
    const s=cfg();
    return [
      {key:'g40',label:'Meta 1',target:Number(s.g40)||40000,pct:Number(s.p40)||0},
      {key:'g60',label:'Meta 2',target:Number(s.g60)||60000,pct:Number(s.p60)||0},
      {key:'g80',label:'Meta 3',target:Number(s.g80)||80000,pct:Number(s.p80)||0}
    ].sort((a,b)=>a.target-b.target);
  };

  let activeGoalKey=(cfg().dashboardGoal&&['g40','g60','g80'].includes(cfg().dashboardGoal))?cfg().dashboardGoal:'g40';

  function ensureGoalUI(){
    if($('#goalTargetSwitch'))return;
    const head=$('#goalCurrent')?.closest('.card')?.querySelector('.cardhead');
    if(!head)return;
    const wrap=document.createElement('div');
    wrap.className='goal-selector-card';
    wrap.innerHTML=`<div class="goal-selector-copy"><b>Meta em acompanhamento</b><small>Escolha qual objetivo Ana quer perseguir agora</small></div><div id="goalTargetSwitch" class="goal-selector-buttons"></div>`;
    head.insertAdjacentElement('afterend',wrap);
    const msg=document.createElement('div');
    msg.id='goalTargetMessage';
    msg.className='goal-target-message';
    const tiers=$('.tiers');
    tiers?.insertAdjacentElement('beforebegin',msg);
  }

  function paintGoalSelector(){
    ensureGoalUI();
    const box=$('#goalTargetSwitch');
    if(!box)return;
    box.innerHTML=goals().map(g=>`<button type="button" data-goal-key="${g.key}" class="${g.key===activeGoalKey?'active':''}">${g.label}<br>${brl(g.target)}</button>`).join('');
    box.querySelectorAll('[data-goal-key]').forEach(button=>button.onclick=()=>{
      activeGoalKey=button.dataset.goalKey;
      renderDashboard();
      window.saveCloudSettings?.({dashboardGoal:activeGoalKey});
    });
  }

  renderDashboard=function(){
    const k=selectedMonth();if(!k)return;
    const rows=dashboardRows(k),orders=aggregateOrders(rows),total=rows.reduce((a,r)=>a+r.value,0),c=commission(total),clientSet=new Set(rows.map(r=>r.clientId||norm(r.name)).filter(Boolean));
    const [yy,mm]=k.split('-').map(Number),days=new Date(yy,mm,0).getDate(),today=new Date(),cur=today.getFullYear()===yy&&today.getMonth()+1===mm,elapsed=cur?Math.max(1,Math.min(today.getDate(),days)):days,remaining=cur?Math.max(0,days-today.getDate()):0,projection=cur?total/elapsed*days:total,pc=commission(projection),s=cfg();

    $('#kpiSales').textContent=brl(total);
    const mode=dashboardSourceMode(),hints={all:`${rows.filter(r=>r.source==='sheet').length} registros da planilha + ${rows.filter(r=>r.source==='manual').length} manuais`,sheet:'Somente Google Sheets',manual:'Somente lançamentos manuais'};
    $('#kpiSalesHint').textContent=hints[mode];
    $('#kpiOrders').textContent=orders.length;$('#kpiOrdersHint').textContent=`${clientSet.size} clientes únicos`;
    $('#kpiCommission').textContent=brl(c.value);$('#kpiCommissionHint').textContent=`Faixa atual: ${c.label} sobre tudo vendido`;
    $('#kpiProjection').textContent=brl(projection);$('#kpiProjectionHint').textContent=`Comissão projetada: ${brl(pc.value)} • ${pc.label}`;
    $('#goalCurrent').textContent=brl(total);$('#goalCommission').textContent=brl(c.value);$('#daysLeft').textContent=cur?`${remaining} dias restantes`:'Mês encerrado';
    $('#avgDay').textContent=brl(total/elapsed);
    $('#pendingTotal').textContent=brl(pendings().reduce((a,p)=>a+p.value,0));

    const defs=goals();
    if(!defs.some(g=>g.key===activeGoalKey))activeGoalKey=defs[0].key;
    const selected=defs.find(g=>g.key===activeGoalKey)||defs[0];
    const firstUnmet=defs.find(g=>total<g.target);
    const nextAfterSelected=defs.find(g=>g.target>Math.max(selected.target,total));
    const gapSelected=Math.max(0,selected.target-total);
    $('#goalBar').style.width=`${Math.min(100,(total/Math.max(1,selected.target))*100)}%`;
    const labels=$('.progress-labels')?.children;
    if(labels?.length>=3){labels[0].textContent='R$ 0';labels[1].textContent=`${selected.label} • ${Math.min(100,total/selected.target*100).toFixed(1).replace('.',',')}%`;labels[2].textContent=brl(selected.target);}
    const gapLabel=$('#nextGap')?.closest('.micro')?.querySelector('small');
    if(total<selected.target){
      $('#nextGap').textContent=brl(gapSelected);if(gapLabel)gapLabel.textContent=`Falta para ${selected.label}`;
      $('#goalTargetMessage').innerHTML=`Faltam <strong>${brl(gapSelected)}</strong> para atingir <strong>${selected.label} (${brl(selected.target)})</strong>.`;
    }else if(nextAfterSelected){
      const gap=Math.max(0,nextAfterSelected.target-total);$('#nextGap').textContent=brl(gap);if(gapLabel)gapLabel.textContent=`Falta para ${nextAfterSelected.label}`;
      $('#goalTargetMessage').innerHTML=`<strong>${selected.label} atingida.</strong> Faltam <strong>${brl(gap)}</strong> para ${nextAfterSelected.label} (${brl(nextAfterSelected.target)}).`;
    }else if(firstUnmet){
      const gap=Math.max(0,firstUnmet.target-total);$('#nextGap').textContent=brl(gap);if(gapLabel)gapLabel.textContent=`Falta para ${firstUnmet.label}`;
      $('#goalTargetMessage').innerHTML=`Faltam <strong>${brl(gap)}</strong> para ${firstUnmet.label}.`;
    }else{
      $('#nextGap').textContent='Todas atingidas';if(gapLabel)gapLabel.textContent='Metas';
      $('#goalTargetMessage').innerHTML='<strong>Todas as metas foram atingidas.</strong>';
    }

    const tierEls=[['#tier3',defs[0]],['#tier35',defs[1]],['#tier4',defs[2]]];
    tierEls.forEach(([sel,g],i)=>{const el=$(sel);if(!el)return;el.querySelector('b').textContent=`${g.label} · ${g.pct.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;el.querySelector('span').textContent=brl(g.target);el.classList.toggle('active',i===0?total<defs[1].target:i===1?total>=defs[1].target&&total<defs[2].target:total>=defs[2].target);});

    paintGoalSelector();

    const sm={};orders.forEach(o=>{const z=normalizedStatus(o.status);sm[z]=(sm[z]||0)+1});$('#statusTotal').textContent=`${orders.length} pedidos`;$('#statusGrid').innerHTML=Object.entries(sm).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n,v])=>`<div class="status"><b>${v}</b><small>${esc(n)}</small></div>`).join('')||'<div class="empty">Sem pedidos no período.</div>';
    const by={};rows.forEach(r=>{const key=r.clientId||norm(r.name)||'sem';if(!by[key])by[key]={name:r.name||'Não identificado',value:0};by[key].value+=r.value});$('#topClients').innerHTML=Object.values(by).sort((a,b)=>b.value-a.value).slice(0,7).map((x,i)=>`<div class="rankrow"><div class="ranknum">${i+1}</div><div class="rankname">${esc(x.name)}</div><div class="rankval">${brl(x.value)}</div></div>`).join('')||'<div class="empty">Sem clientes.</div>';
    const daily=Array(days).fill(0);rows.forEach(r=>{const d=parseDate(r.paymentDate);if(d)daily[d.getDate()-1]+=r.value});const best=Math.max(...daily),bi=daily.indexOf(best)+1;$('#bestDay').textContent=best?`Melhor dia: ${String(bi).padStart(2,'0')}/${String(mm).padStart(2,'0')} • ${brl(best)}`:'—';drawChart(daily);
    const att=[];orders.forEach(o=>{if(!o.status)att.push({kind:'Pedido sem status',o});const due=parseDate(o.due);if(due&&!o.delivered&&due<new Date(new Date().setHours(0,0,0,0)))att.push({kind:'Entrega atrasada',o})});pendings().forEach(p=>{const d=parseDate(p.due);if(d&&d<new Date(new Date().setHours(0,0,0,0)))att.push({kind:'Pagamento em atraso',pending:p})});
    $('#attentionCount').textContent=`${att.length} itens`;$('#attentionList').innerHTML=att.slice(0,10).map(a=>a.o?`<div class="attrow"><div class="attleft"><span class="atticon"><i data-lucide="triangle-alert"></i></span><div><b>${esc(a.kind)}</b><small>#${esc(a.o.orderId||'—')} • ${esc(a.o.name)}</small></div></div><button class="link" onclick="openOrder('${encodeURIComponent(a.o.key)}')">Ver</button></div>`:`<div class="attrow"><div class="attleft"><span class="atticon"><i data-lucide="clock-alert"></i></span><div><b>${esc(a.kind)}</b><small>${esc(a.pending.name)} • ${brl(a.pending.value)}</small></div></div><button class="link" data-view-go="pending">A receber</button></div>`).join('')||'<div class="empty">Nada importante exigindo atenção.</div>';
    refreshIcons();
  };

  function waNumber(phone){
    let d=String(phone||'').replace(/\D/g,'').replace(/^0+/,'');
    if(d.length===10||d.length===11)d='55'+d;
    return d.length>=12?d:'';
  }
  function clientNoteKey(raw){return 'client:'+String(raw||'').trim();}

  function ensureClientNoteModal(){
    if($('#clientNoteModalBack'))return;
    const back=document.createElement('div');back.id='clientNoteModalBack';back.className='client-note-backdrop';
    back.innerHTML=`<div class="client-note-modal"><div class="client-note-modal-head"><div><h3 id="clientNoteTitle">Anotação do cliente</h3><p>Esta anotação fica salva no banco e sinaliza o cliente na lista.</p></div><button type="button" id="clientNoteClose" class="btn">Fechar</button></div><textarea id="clientNoteText" placeholder="Escreva algo importante sobre este cliente..."></textarea><div class="client-note-modal-actions"><button type="button" id="clientNoteRemove" class="btn danger">Remover anotação</button><button type="button" id="clientNoteSave" class="btn purple">Salvar anotação</button></div></div>`;
    document.body.appendChild(back);
    $('#clientNoteClose').onclick=()=>back.classList.remove('open');
    back.onclick=e=>{if(e.target===back)back.classList.remove('open');};
  }

  let editingClientKey='',editingClientName='';
  window.openClientNote=(encodedKey,encodedName)=>{
    ensureClientNoteModal();editingClientKey=decodeURIComponent(encodedKey);editingClientName=decodeURIComponent(encodedName);
    const note=(window.cloudClientNotes?.()||{})[editingClientKey];
    $('#clientNoteTitle').textContent=`Anotação · ${editingClientName}`;$('#clientNoteText').value=note?.text||'';$('#clientNoteModalBack').classList.add('open');$('#clientNoteText').focus();
  };

  function bindClientNoteActions(){
    ensureClientNoteModal();
    $('#clientNoteSave').onclick=async()=>{
      const text=$('#clientNoteText').value.trim(),all=structuredClone(window.cloudClientNotes?.()||{});
      if(text)all[editingClientKey]={text,updatedAt:new Date().toISOString()};else delete all[editingClientKey];
      await window.saveCloudClientNotes?.(all);auditAdd('manual',`Anotação do cliente ${editingClientName} foi ${text?'salva':'removida'}.`);$('#clientNoteModalBack').classList.remove('open');renderClients();toast(text?'Anotação salva online.':'Anotação removida.');
    };
    $('#clientNoteRemove').onclick=async()=>{const all=structuredClone(window.cloudClientNotes?.()||{});delete all[editingClientKey];await window.saveCloudClientNotes?.(all);auditAdd('manual',`Anotação do cliente ${editingClientName} foi removida.`);$('#clientNoteModalBack').classList.remove('open');renderClients();toast('Anotação removida.');};
  }

  renderClients=function(){
    const rows=rowsMonth(selectedMonth()),m={},notes=window.cloudClientNotes?.()||{};
    rows.forEach(r=>{const raw=r.clientId||norm(r.name)||uid(),key=clientNoteKey(raw);if(!m[key])m[key]={key,name:r.name||'Não identificado',phone:'',total:0,orders:new Set(),last:null};const x=m[key];x.total+=r.value;x.orders.add(r.orderId||r.key);if(r.phone&&!x.phone)x.phone=r.phone;const d=parseDate(r.paymentDate);if(d&&(!x.last||d>x.last))x.last=d;});
    let a=Object.values(m).map(x=>({...x,count:x.orders.size,avg:x.total/x.orders.size,note:notes[x.key]})),q=norm($('#clientSearch').value);if(q)a=a.filter(x=>norm([x.name,x.phone].join(' ')).includes(q));a.sort((a,b)=>b.total-a.total);
    const head=$('#clients table thead tr');if(head&&!head.querySelector('[data-client-actions-header]')){const th=document.createElement('th');th.dataset.clientActionsHeader='1';th.textContent='Contato';head.appendChild(th);}
    $('#clientsBody').innerHTML=a.map(x=>{const wa=waNumber(x.phone),has=!!x.note?.text;return `<tr class="${has?'client-row-has-note':''}"><td><div class="client-name-line"><b>${esc(x.name)}</b>${has?'<span class="client-note-flag"><i data-lucide="sticky-note"></i>Anotação</span>':''}</div><span class="muted">${esc(x.phone||'')}</span></td><td>${x.count}</td><td><b>${brl(x.total)}</b></td><td>${brl(x.avg)}</td><td>${x.last?x.last.toLocaleDateString('pt-BR'):'—'}</td><td><div class="client-actions">${wa?`<a class="client-action whatsapp" href="https://wa.me/${wa}" target="_blank" rel="noopener"><i data-lucide="message-circle"></i>WhatsApp</a>`:'<span class="client-action disabled"><i data-lucide="message-circle"></i>Sem telefone</span>'}<button class="client-action note" type="button" onclick="openClientNote('${encodeURIComponent(x.key)}','${encodeURIComponent(x.name)}')"><i data-lucide="sticky-note"></i>${has?'Ver anotação':'Anotar'}</button></div></td></tr>`}).join('')||'<tr><td class="empty" colspan="6">Nenhum cliente.</td></tr>';
    refreshIcons();
  };

  renderAudit=function(){
    const a=(window.cloudAudit?.()||[]).slice(0,300);$('#auditList').innerHTML=a.length?a.map(x=>`<div class="audititem"><time>${new Date(x.time).toLocaleString('pt-BR')}</time><div class="auditkind ${x.type}">${x.type==='delete'?'EXCLUSÃO':x.type==='change'?'ALTERAÇÃO':x.type==='add'?'ADIÇÃO':'MANUAL'}</div><div>${esc(x.msg)}</div></div>`).join(''):'<div class="empty">Nenhuma atividade registrada ainda.</div>';
  };

  function mkSetting(id,label,step='1'){
    const div=document.createElement('div');div.innerHTML=`<label>${label}</label><input id="${id}" class="input" type="number" step="${step}" min="0">`;return div;
  }
  function ensureGoalSettings(){
    if($('#goal40'))return;
    const g60=$('#goal60'),g80=$('#goal80');if(!g60||!g80)return;
    const grid=g60.closest('.settingsgrid');
    const subtitle=document.createElement('div');subtitle.className='settings-subtitle';subtitle.textContent='Metas e comissões';grid.insertBefore(subtitle,g60.parentElement);
    const g40=mkSetting('goal40','Meta 1 (R$)');grid.insertBefore(g40,g60.parentElement);
    const p40=mkSetting('percent40','Comissão base / Meta 1 (%)','0.1');grid.insertBefore(p40,g60.parentElement);
    g60.parentElement.querySelector('label').textContent='Meta 2 (R$)';const p60=mkSetting('percent60','Comissão após Meta 2 (%)','0.1');g60.parentElement.insertAdjacentElement('afterend',p60);
    g80.parentElement.querySelector('label').textContent='Meta 3 (R$)';const p80=mkSetting('percent80','Comissão após Meta 3 (%)','0.1');g80.parentElement.insertAdjacentElement('afterend',p80);
  }
  function loadGoalSettings(){
    ensureGoalSettings();const s=cfg();$('#goal40').value=s.g40;$('#percent40').value=s.p40;$('#goal60').value=s.g60;$('#percent60').value=s.p60;$('#goal80').value=s.g80;$('#percent80').value=s.p80;
  }
  function bindGoalSettings(){
    loadGoalSettings();
    $('#saveSettings').onclick=async()=>{
      const g40=Number($('#goal40').value),g60=Number($('#goal60').value),g80=Number($('#goal80').value),p40=Number($('#percent40').value),p60=Number($('#percent60').value),p80=Number($('#percent80').value);
      if(!(g40>0&&g60>g40&&g80>g60)){toast('As metas precisam estar em ordem crescente.');return;}
      if([p40,p60,p80].some(v=>!Number.isFinite(v)||v<0||v>100)){toast('Confira os percentuais das comissões.');return;}
      await window.saveCloudSettings?.({sheetUrl:$('#sheetUrlInput').value.trim(),sheetName:$('#sheetNameInput').value.trim(),interval:+$('#refreshInterval').value,g40,p40,g60,p60,g80,p80,dashboardGoal:activeGoalKey});
      setupTimer();renderDashboard();toast('Metas e configurações salvas online.');
    };
  }

  async function paintDatabaseHealth(){
    let online=false;
    try{const res=await fetch('/api/state?health='+Date.now(),{cache:'no-store'});const data=await res.json();online=res.ok&&data?.ok===true;}catch(_){online=false;}
    const label=$('#cloudStatus');if(label){label.className='cloud-status '+(online?'online':'offline');label.innerHTML=online?'<span></span>Banco conectado':'<span></span>Banco não conectado';}
    if(online){const b=$('#banner');if(b&&/persistência online|salvamento online|banco cloudflare d1|banco não conectado/i.test(b.textContent||''))b.style.display='none';}
    return online;
  }

  ensureGoalUI();paintGoalSelector();bindGoalSettings();bindClientNoteActions();renderDashboard();
  if($('.view.active')?.id==='clients')renderClients();
  paintDatabaseHealth();setInterval(paintDatabaseHealth,15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)paintDatabaseHealth();});
})();
