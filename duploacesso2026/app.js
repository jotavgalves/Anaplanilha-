(()=>{
  'use strict';

  const SOURCES={
    ana:{key:'ana',label:'Ana',sheetId:'1EdkihhLcVQiUlJMb54RknQTHzq6RyqNhNzONvzBbTpM',sheetName:'VENDA DO MÊS'},
    dayane:{key:'dayane',label:'Dayane',sheetId:'1yuR43gP2_kPMZpySYeiyJIJXRwGchvosa31fhigVoMw',gid:'0'}
  };
  const FALLBACK_RULES={g40:40000,p40:3,g60:60000,p60:3.5,g80:80000,p80:4,fixedBase:0};
  const state={rows:{ana:[],dayane:[]},rules:{ana:{...FALLBACK_RULES},dayane:{...FALLBACK_RULES}},loaded:false};
  const $=s=>document.querySelector(s);
  const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const money=v=>{if(typeof v==='number')return v;let s=String(v??'').trim().replace(/R\$\s?/i,'');if(!s)return 0;if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');return Number(s)||0;};
  const parseDate=v=>{if(!v)return null;if(v instanceof Date)return v;let s=String(v).trim(),m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);if(m){let y=+m[3];if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1]);}const d=new Date(s);return Number.isNaN(d.getTime())?null:d;};
  const dayKey=d=>d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:'';
  const monthKey=d=>d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`:'';
  const monthLabel=k=>{const [y,m]=k.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());};
  const fmtDate=d=>d?d.toLocaleDateString('pt-BR'):'—';
  const headerKey=s=>norm(s).replace(/[^a-z0-9]/g,'');

  function readField(row,names){
    const keyed={};Object.entries(row).forEach(([k,v])=>{keyed[headerKey(k)]=v;});
    for(const name of names){const v=keyed[headerKey(name)];if(v!==undefined&&v!==null&&String(v).trim()!=='')return v;}
    return '';
  }

  function canonical(row,seller){
    const orderId=String(readField(row,['ID_PEDIDO','ID PEDIDO','PEDIDO','Nº PEDIDO'])||'').trim();
    return {
      key:`sheet:${seller}:${orderId||Math.random().toString(36).slice(2)}`,
      seller,
      sellerLabel:SOURCES[seller].label,
      orderId,
      clientId:String(readField(row,['ID_CLIENTE','ID CLIENTE'])||'').trim(),
      name:String(readField(row,['NOME DO CLIENTE','CLIENTE','NOME'])||'').trim(),
      value:money(readField(row,['VALOR DO PAGAMENTO','VALOR PAGO','VALOR'])),
      payment:String(readField(row,['STATUS DO PAGAMENTO','STATUS PAGAMENTO','PAGAMENTO'])||'').trim().toUpperCase(),
      paymentDate:readField(row,['DATA DO PAGAMENTO','DATA PAGAMENTO','DATA']),
      status:String(readField(row,['STATUS DO PEDIDO','STATUS PEDIDO'])||'').trim(),
      phone:String(readField(row,['TELEFONE','CELULAR'])||'').trim(),
      method:String(readField(row,['FORMA DE PAGAMENTO','FORMA PAGAMENTO'])||'').trim()
    };
  }

  function csvParse(text){
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i],n=text[i+1];
      if(quoted){if(c==='"'&&n==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
      else{if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell='';}else if(c!=='\r')cell+=c;}
    }
    if(cell.length||row.length){row.push(cell);rows.push(row);}
    const headers=(rows.shift()||[]).map(x=>x.trim());
    return rows.filter(r=>r.some(x=>String(x).trim())).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
  }

  function endpoint(src){
    const p=src.sheetName?`sheet=${encodeURIComponent(src.sheetName)}`:`gid=${encodeURIComponent(src.gid||'0')}`;
    return `https://docs.google.com/spreadsheets/d/${src.sheetId}/gviz/tq?tqx=out:csv&${p}&t=${Date.now()}`;
  }

  async function fetchSource(key){
    const src=SOURCES[key];
    const res=await fetch(endpoint(src),{cache:'no-store'});
    if(!res.ok)throw new Error(`${src.label}: HTTP ${res.status}`);
    const text=await res.text();
    const parsed=csvParse(text);
    if(!parsed.length)throw new Error(`${src.label}: planilha vazia ou indisponível`);
    const rows=parsed.map(r=>canonical(r,key)).filter(r=>{const pay=norm(r.payment);return (pay==='pago'||pay.startsWith('pago '))&&r.value>0&&parseDate(r.paymentDate);});
    if(!rows.length)throw new Error(`${src.label}: nenhum pagamento válido encontrado`);
    return rows;
  }

  async function loadRules(){
    try{
      const res=await fetch(`/api/state?management=${Date.now()}`,{cache:'no-store'});
      const data=await res.json();
      const base={...FALLBACK_RULES,...(data?.state?.settings||{})};
      const custom=data?.state?.managementSettings?.sellerCommissions||{};
      state.rules.ana={...base,...(custom.ana||{})};
      state.rules.dayane={...base,...(custom.dayane||{})};
    }catch(_){state.rules.ana={...FALLBACK_RULES};state.rules.dayane={...FALLBACK_RULES};}
  }

  function commission(total,key){
    const s=state.rules[key]||FALLBACK_RULES;
    const pct=total>=Number(s.g80)?Number(s.p80):total>=Number(s.g60)?Number(s.p60):Number(s.p40);
    const rate=Number.isFinite(pct)?pct:0;
    return {rate,value:total*rate/100,label:`${rate.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`};
  }

  function fixedPay(total,key){
    const s=state.rules[key]||FALLBACK_RULES;
    const target=Math.max(0,Number(s.g40)||0);
    const base=Math.max(0,Number(s.fixedBase??s.fixed??0)||0);
    const attainment=target>0?Math.max(0,Math.min(1,total/target)):0;
    return {base,attainment,value:base*attainment,label:`${(attainment*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% da Meta 1`};
  }

  function goals(key){
    const s=state.rules[key]||FALLBACK_RULES;
    return [
      {target:Number(s.g40)||40000,pct:Number(s.p40)||0,label:'Meta 1'},
      {target:Number(s.g60)||60000,pct:Number(s.p60)||0,label:'Meta 2'},
      {target:Number(s.g80)||80000,pct:Number(s.p80)||0,label:'Meta 3'}
    ].sort((a,b)=>a.target-b.target);
  }

  function selectedRange(key){
    const mode=$('#periodMode').value;
    if(mode==='month'){
      const mk=$(`#${key}Month`).value;
      if(!mk)return {from:null,to:null,label:'Sem período'};
      const [y,m]=mk.split('-').map(Number);
      return {from:new Date(y,m-1,1),to:new Date(y,m,0),label:monthLabel(mk),monthKey:mk};
    }
    const fs=$(`#${key}From`).value,ts=$(`#${key}To`).value;
    const from=fs?new Date(`${fs}T00:00:00`):null,to=ts?new Date(`${ts}T23:59:59`):null;
    return {from,to,label:from&&to?`${fmtDate(from)} → ${fmtDate(to)}`:'Período personalizado'};
  }

  function rowsFor(key){
    const range=selectedRange(key);
    return state.rows[key].filter(r=>{const d=parseDate(r.paymentDate);return d&&(!range.from||d>=range.from)&&(!range.to||d<=range.to);});
  }

  function uniqueOrders(rows){
    const map=new Map();
    rows.forEach((r,i)=>{const id=r.orderId||r.key||String(i);if(!map.has(id))map.set(id,{...r,value:0});map.get(id).value+=r.value;});
    return [...map.values()];
  }

  function stats(key){
    const rows=rowsFor(key),orders=uniqueOrders(rows),range=selectedRange(key);
    const total=rows.reduce((a,r)=>a+r.value,0),com=commission(total,key),fixed=fixedPay(total,key);
    const clients=new Set(rows.map(r=>r.clientId||norm(r.name)).filter(Boolean));
    const activeDays=new Set(rows.map(r=>dayKey(parseDate(r.paymentDate))).filter(Boolean)).size;
    const ticket=orders.length?total/orders.length:0;
    const daily=activeDays?total/activeDays:0;
    let projection=total,projectionHint='período selecionado';
    if(range.monthKey===monthKey(new Date())){
      const today=new Date(),days=new Date(today.getFullYear(),today.getMonth()+1,0).getDate(),elapsed=Math.max(1,today.getDate());
      projection=total/elapsed*days;projectionHint='estimativa do mês atual';
    }
    const next=goals(key).find(g=>total<g.target);
    const gap=next?Math.max(0,next.target-total):0;
    return {key,rows,orders,range,total,com,fixed,earnings:com.value+fixed.value,clients:clients.size,activeDays,ticket,daily,projection,projectionHint,next,gap};
  }

  function setText(id,value){const el=$(id);if(el)el.textContent=value;}

  function renderSeller(s){
    const p=s.key;
    setText(`#${p}PeriodLabel`,s.range.label);
    setText(`#${p}Sales`,brl(s.total));
    setText(`#${p}Commission`,brl(s.com.value));
    setText(`#${p}Rate`,`${s.com.label} sobre vendas da ${SOURCES[p].label}`);
    setText(`#${p}Fixed`,brl(s.fixed.value));
    setText(`#${p}FixedHint`,`${s.fixed.label} • base ${brl(s.fixed.base)}`);
    setText(`#${p}Earnings`,brl(s.earnings));
    setText(`#${p}EarningsHint`,'comissão + fixo proporcional');
    setText(`#${p}Orders`,String(s.orders.length));
    setText(`#${p}Clients`,`${s.clients} clientes`);
    setText(`#${p}Ticket`,brl(s.ticket));
    setText(`#${p}Daily`,brl(s.daily));
    setText(`#${p}ActiveDays`,`${s.activeDays} dias com venda`);
    setText(`#${p}Projection`,brl(s.projection));
    setText(`#${p}ProjectionHint`,s.projectionHint);
    setText(`#${p}Gap`,s.next?brl(s.gap):'Todas atingidas');
    setText(`#${p}GoalLabel`,s.next?`${s.next.label} • ${brl(s.next.target)} • ${s.next.pct.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`:'Faixa máxima');
    renderTopClients(p,s.rows);
  }

  function renderTopClients(key,rows){
    const by=new Map();
    rows.forEach(r=>{const id=r.clientId||norm(r.name)||r.key;if(!by.has(id))by.set(id,{name:r.name||'Não identificado',value:0});by.get(id).value+=r.value;});
    const list=[...by.values()].sort((a,b)=>b.value-a.value).slice(0,7);
    $(`#${key}TopClients`).innerHTML=list.length?list.map((x,i)=>`<div class="rank-row"><div class="rank-num">${i+1}</div><div class="rank-name">${esc(x.name)}</div><div class="rank-value">${brl(x.value)}</div></div>`).join(''):'<div class="empty">Sem clientes no período.</div>';
  }

  function renderCombined(a,d){
    const total=a.total+d.total,comm=a.com.value+d.com.value,fixed=a.fixed.value+d.fixed.value,earnings=comm+fixed;
    setText('#combinedSales',brl(total));setText('#combinedCommission',brl(comm));setText('#combinedFixed',brl(fixed));setText('#combinedEarnings',brl(earnings));setText('#combinedOrders',String(a.orders.length+d.orders.length));
    const ap=total?a.total/total*100:0,dp=total?d.total/total*100:0;
    setText('#combinedShare',`${ap.toFixed(1).replace('.',',')}% / ${dp.toFixed(1).replace('.',',')}%`);
  }

  function renderOrders(a,d){
    let rows=[...a.orders,...d.orders],seller=$('#sellerFilter').value,q=norm($('#orderSearch').value);
    if(seller!=='all')rows=rows.filter(r=>r.seller===seller);
    if(q)rows=rows.filter(r=>norm([r.orderId,r.name,r.phone].join(' ')).includes(q));
    rows.sort((x,y)=>(parseDate(y.paymentDate)||0)-(parseDate(x.paymentDate)||0));
    $('#ordersBody').innerHTML=rows.length?rows.slice(0,500).map(r=>`<tr><td><span class="seller-badge ${r.seller}">${esc(r.sellerLabel)}</span></td><td><b>#${esc(r.orderId||'—')}</b></td><td>${esc(r.name||'Não identificado')}</td><td><b>${brl(r.value)}</b></td><td class="paid">PAGO</td><td class="status">${esc(r.status||'Sem status')}</td><td>${fmtDate(parseDate(r.paymentDate))}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">Nenhum pedido encontrado.</td></tr>';
  }

  function dailySeries(s){
    const by=new Map();s.rows.forEach(r=>{const k=dayKey(parseDate(r.paymentDate));by.set(k,(by.get(k)||0)+r.value);});return by;
  }

  function renderChart(a,d){
    const canvas=$('#salesChart'),ctx=canvas.getContext('2d');
    const ratio=Math.max(1,Math.min(2,window.devicePixelRatio||1)),cssW=Math.max(300,canvas.clientWidth||1200),cssH=Math.max(220,canvas.clientHeight||285);
    canvas.width=Math.round(cssW*ratio);canvas.height=Math.round(cssH*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,cssW,cssH);
    const as=dailySeries(a),ds=dailySeries(d),allKeys=[...new Set([...as.keys(),...ds.keys()])].sort();
    if(!allKeys.length){ctx.fillStyle='#687285';ctx.font='12px DM Sans';ctx.fillText('Sem vendas no período selecionado.',24,42);return;}
    const max=Math.max(1,...allKeys.map(k=>Math.max(as.get(k)||0,ds.get(k)||0))),pad={l:55,r:18,t:18,b:38},gw=cssW-pad.l-pad.r,gh=cssH-pad.t-pad.b;
    ctx.font='10px DM Sans';ctx.lineWidth=1;
    for(let i=0;i<4;i++){const y=pad.t+gh*i/3;ctx.strokeStyle='#222a37';ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(cssW-pad.r,y);ctx.stroke();ctx.fillStyle='#677184';const value=max*(1-i/3);ctx.fillText(new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(value),5,y+3);}
    const x=i=>allKeys.length===1?pad.l+gw/2:pad.l+gw*i/(allKeys.length-1),y=v=>pad.t+gh-(v/max)*gh;
    const draw=(map,color)=>{ctx.strokeStyle=color;ctx.lineWidth=2.3;ctx.beginPath();allKeys.forEach((k,i)=>{const xx=x(i),yy=y(map.get(k)||0);if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);});ctx.stroke();allKeys.forEach((k,i)=>{const xx=x(i),yy=y(map.get(k)||0);ctx.fillStyle=color;ctx.beginPath();ctx.arc(xx,yy,2.5,0,Math.PI*2);ctx.fill();});};
    draw(as,'#9b7af8');draw(ds,'#5cb9a4');
    ctx.fillStyle='#677184';ctx.font='9px DM Sans';const step=Math.max(1,Math.ceil(allKeys.length/8));allKeys.forEach((k,i)=>{if(i%step===0||i===allKeys.length-1){const parts=k.split('-');ctx.fillText(`${parts[2]}/${parts[1]}`,x(i)-11,cssH-13);}});
    setText('#chartCaption',a.range.label===d.range.label?`Ana e Dayane em ${a.range.label}.`:`Ana: ${a.range.label} • Dayane: ${d.range.label}`);
  }

  function render(){
    if(!state.loaded)return;
    const a=stats('ana'),d=stats('dayane');renderSeller(a);renderSeller(d);renderCombined(a,d);renderOrders(a,d);renderChart(a,d);
  }

  function availableMonths(){
    const keys=[...new Set([...state.rows.ana,...state.rows.dayane].map(r=>monthKey(parseDate(r.paymentDate))).filter(Boolean))].sort().reverse();
    const now=monthKey(new Date());if(!keys.includes(now))keys.unshift(now);return keys;
  }

  function initPeriods(){
    const keys=availableMonths(),html=keys.map(k=>`<option value="${k}">${monthLabel(k)}</option>`).join('');
    $('#anaMonth').innerHTML=html;$('#dayaneMonth').innerHTML=html;const now=monthKey(new Date());
    $('#anaMonth').value=keys.includes(now)?now:keys[0];$('#dayaneMonth').value=$('#anaMonth').value;
    const today=new Date(),first=new Date(today.getFullYear(),today.getMonth(),1),last=new Date(today.getFullYear(),today.getMonth()+1,0);
    const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    $('#anaFrom').value=iso(first);$('#anaTo').value=iso(last);$('#dayaneFrom').value=iso(first);$('#dayaneTo').value=iso(last);
  }

  function syncPeriodFromAna(){
    if(!$('#samePeriod').checked)return;
    $('#dayaneMonth').value=$('#anaMonth').value;$('#dayaneFrom').value=$('#anaFrom').value;$('#dayaneTo').value=$('#anaTo').value;
  }

  function syncDisabled(){
    const same=$('#samePeriod').checked;['dayaneMonth','dayaneFrom','dayaneTo'].forEach(id=>{$(`#${id}`).disabled=same;});
    if(same)syncPeriodFromAna();render();
  }

  function bind(){
    $('#refreshBtn').addEventListener('click',sync);
    $('#periodMode').addEventListener('change',()=>{document.querySelector('.control-card').classList.toggle('custom-mode',$('#periodMode').value==='custom');render();});
    $('#samePeriod').addEventListener('change',syncDisabled);
    ['anaMonth','anaFrom','anaTo'].forEach(id=>$(`#${id}`).addEventListener('change',()=>{syncPeriodFromAna();render();}));
    ['dayaneMonth','dayaneFrom','dayaneTo','#sellerFilter','#orderSearch'].forEach(raw=>{const el=raw.startsWith('#')?$(raw):$(`#${raw}`);el.addEventListener(raw==='#orderSearch'?'input':'change',render);});
    window.addEventListener('resize',()=>{if(state.loaded)renderChart(stats('ana'),stats('dayane'));});
  }

  async function sync(){
    $('#syncText').textContent='Sincronizando Ana e Dayane...';$('#refreshBtn').disabled=true;$('#banner').classList.remove('show');
    await loadRules();
    const results=await Promise.allSettled([fetchSource('ana'),fetchSource('dayane')]);
    const errors=[];
    if(results[0].status==='fulfilled')state.rows.ana=results[0].value;else errors.push(results[0].reason?.message||'Falha ao carregar Ana');
    if(results[1].status==='fulfilled')state.rows.dayane=results[1].value;else errors.push(results[1].reason?.message||'Falha ao carregar Dayane');
    state.loaded=state.rows.ana.length>0||state.rows.dayane.length>0;
    if(!$('#anaMonth').options.length&&state.loaded)initPeriods();
    if(errors.length){$('#banner').textContent=`Atenção: ${errors.join(' • ')}`;$('#banner').classList.add('show');}
    $('#syncText').textContent=state.loaded?`Atualizado às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`:'Não foi possível carregar as planilhas';
    $('#refreshBtn').disabled=false;syncDisabled();render();
  }

  bind();sync();
})();
