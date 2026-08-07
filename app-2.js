function renderDashboard(){
 let k=selectedMonth();if(!k)return;let rows=dashboardRows(k),orders=aggregateOrders(rows),total=rows.reduce((a,r)=>a+r.value,0),c=commission(total),clients=new Set(rows.map(r=>r.clientId||norm(r.name)).filter(Boolean));
 let [yy,mm]=k.split("-").map(Number),days=new Date(yy,mm,0).getDate(),today=new Date(),cur=today.getFullYear()===yy&&today.getMonth()+1===mm,elapsed=cur?Math.max(1,Math.min(today.getDate(),days)):days,remaining=cur?Math.max(0,days-today.getDate()):0,projection=cur?total/elapsed*days:total,pc=commission(projection),s=cfg();
 $("#kpiSales").textContent=brl(total);
 let mode=dashboardSourceMode(),hints={
  all:`${rows.filter(r=>r.source==="sheet").length} registros da planilha + ${rows.filter(r=>r.source==="manual").length} manuais`,
  sheet:"Somente Google Sheets",
  manual:"Somente lançamentos manuais"
 };
 $("#kpiSalesHint").textContent=hints[mode];
 $("#kpiOrders").textContent=orders.length;$("#kpiOrdersHint").textContent=`${clients.size} clientes únicos`;
 $("#kpiCommission").textContent=brl(c.value);$("#kpiCommissionHint").textContent=`Faixa atual: ${c.label} sobre tudo vendido`;
 $("#kpiProjection").textContent=brl(projection);$("#kpiProjectionHint").textContent=`Comissão projetada: ${brl(pc.value)} • ${pc.label}`;
 $("#goalCurrent").textContent=brl(total);$("#goalCommission").textContent=brl(c.value);$("#daysLeft").textContent=cur?`${remaining} dias restantes`:"Mês encerrado";
 $("#goalBar").style.width=`${Math.min(100,total/s.g80*100)}%`;$("#avgDay").textContent=brl(total/elapsed);$("#nextGap").textContent=total<s.g60?brl(s.g60-total):total<s.g80?brl(s.g80-total):"Faixa máxima";
 let pend=pendings().reduce((a,p)=>a+p.value,0);$("#pendingTotal").textContent=brl(pend);
 $("#tier3").classList.toggle("active",total<s.g60);$("#tier35").classList.toggle("active",total>=s.g60&&total<s.g80);$("#tier4").classList.toggle("active",total>=s.g80);
 let sm={};orders.forEach(o=>{let z=normalizedStatus(o.status);sm[z]=(sm[z]||0)+1});$("#statusTotal").textContent=`${orders.length} pedidos`;$("#statusGrid").innerHTML=Object.entries(sm).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n,v])=>`<div class="status"><b>${v}</b><small>${esc(n)}</small></div>`).join("")||'<div class="empty">Sem pedidos no período.</div>';
 let by={};rows.forEach(r=>{let key=r.clientId||norm(r.name)||"sem";if(!by[key])by[key]={name:r.name||"Não identificado",value:0};by[key].value+=r.value});$("#topClients").innerHTML=Object.values(by).sort((a,b)=>b.value-a.value).slice(0,7).map((x,i)=>`<div class="rankrow"><div class="ranknum">${i+1}</div><div class="rankname">${esc(x.name)}</div><div class="rankval">${brl(x.value)}</div></div>`).join("")||'<div class="empty">Sem clientes.</div>';
 let daily=Array(days).fill(0);rows.forEach(r=>{let d=parseDate(r.paymentDate);if(d)daily[d.getDate()-1]+=r.value});let best=Math.max(...daily),bi=daily.indexOf(best)+1;$("#bestDay").textContent=best?`Melhor dia: ${String(bi).padStart(2,"0")}/${String(mm).padStart(2,"0")} • ${brl(best)}`:"—";drawChart(daily);
 let att=[];orders.forEach(o=>{if(!o.status)att.push({kind:"Pedido sem status",o});let due=parseDate(o.due);if(due&&!o.delivered&&due<new Date(new Date().setHours(0,0,0,0)))att.push({kind:"Entrega atrasada",o})});pendings().forEach(p=>{let d=parseDate(p.due);if(d&&d<new Date(new Date().setHours(0,0,0,0)))att.push({kind:"Pagamento em atraso",pending:p})});
 $("#attentionCount").textContent=`${att.length} itens`;$("#attentionList").innerHTML=att.slice(0,10).map(a=>a.o?`<div class="attrow"><div class="attleft"><span class="atticon"><i data-lucide="triangle-alert"></i></span><div><b>${esc(a.kind)}</b><small>#${esc(a.o.orderId||"—")} • ${esc(a.o.name)}</small></div></div><button class="link" onclick="openOrder('${encodeURIComponent(a.o.key)}')">Ver</button></div>`:`<div class="attrow"><div class="attleft"><span class="atticon"><i data-lucide="clock-alert"></i></span><div><b>${esc(a.kind)}</b><small>${esc(a.pending.name)} • ${brl(a.pending.value)}</small></div></div><button class="link" data-view-go="pending">A receber</button></div>`).join("")||'<div class="empty">Nada importante exigindo atenção.</div>';
 refreshIcons()
}
function drawChart(arr){
 let cv=$("#salesChart"),ctx=cv.getContext("2d"),w=cv.width,h=cv.height;ctx.clearRect(0,0,w,h);let pad={l:47,r:14,t:12,b:31},max=Math.max(...arr,1),gw=w-pad.l-pad.r,gh=h-pad.t-pad.b;ctx.font="10px DM Sans";for(let i=0;i<4;i++){let y=pad.t+gh*i/3;ctx.strokeStyle="#222836";ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillStyle="#5d6678";let val=max*(1-i/3);ctx.fillText(new Intl.NumberFormat("pt-BR",{notation:"compact",maximumFractionDigits:1}).format(val),3,y+3)}let bw=gw/arr.length;arr.forEach((v,i)=>{let bh=v/max*gh,x=pad.l+i*bw+bw*.18,y=pad.t+gh-bh;let g=ctx.createLinearGradient(0,y,0,pad.t+gh);g.addColorStop(0,"#9b7af8");g.addColorStop(1,"#6849d4");ctx.fillStyle=g;ctx.beginPath();let ww=Math.max(3,bw*.62);ctx.roundRect(x,y,ww,bh,[3,3,0,0]);ctx.fill();if(i%3===0||i===arr.length-1){ctx.fillStyle="#5d6678";ctx.fillText(String(i+1),x,h-11)}})
}
function renderOrders(){
 let rows=aggregateOrders(rowsMonth(selectedMonth())),q=norm($("#orderSearch").value),src=$("#sourceFilter").value,st=$("#statusFilter").value;if(q)rows=rows.filter(r=>norm([r.orderId,r.name,r.phone,r.document,r.email].join(" ")).includes(q));if(src)rows=rows.filter(r=>r.source===src);if(st)rows=rows.filter(r=>normalizedStatus(r.status)===st);rows.sort((a,b)=>(parseDate(b.paymentDate)||0)-(parseDate(a.paymentDate)||0));
 $("#ordersBody").innerHTML=rows.map(r=>`<tr><td><b>#${esc(r.orderId||"—")}</b></td><td><b>${esc(r.name||"Não identificado")}</b><br><span class="muted">${esc(r.phone||"")}</span></td><td><span class="badge ${r.source==="manual"?"purple":"blue"}">${sourceLabel(r.source)}</span></td><td><b>${brl(r.value)}</b></td><td><span class="badge green">PAGO</span></td><td><span class="badge">${esc(normalizedStatus(r.status))}</span></td><td>${esc(r.method||"—")}</td><td>${fmtDate(r.paymentDate)}</td><td><button class="link" onclick="openOrder('${encodeURIComponent(r.key)}')">Detalhes</button></td></tr>`).join("")||'<tr><td class="empty" colspan="9">Nenhum pedido encontrado.</td></tr>';
 let sts=[...new Set(aggregateOrders(rowsMonth(selectedMonth())).map(r=>normalizedStatus(r.status)))].sort(),e=$("#statusFilter"),old=e.value;e.innerHTML='<option value="">Todos os status</option>'+sts.map(x=>`<option>${esc(x)}</option>`).join("");e.value=sts.includes(old)?old:"";
}
function renderClients(){
 let rows=rowsMonth(selectedMonth()),m={};rows.forEach(r=>{let key=r.clientId||norm(r.name)||uid();if(!m[key])m[key]={name:r.name||"Não identificado",total:0,orders:new Set(),last:null};let x=m[key];x.total+=r.value;x.orders.add(r.orderId||r.key);let d=parseDate(r.paymentDate);if(d&&(!x.last||d>x.last))x.last=d});let a=Object.values(m).map(x=>({...x,count:x.orders.size,avg:x.total/x.orders.size})),q=norm($("#clientSearch").value);if(q)a=a.filter(x=>norm(x.name).includes(q));a.sort((a,b)=>b.total-a.total);$("#clientsBody").innerHTML=a.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${x.count}</td><td><b>${brl(x.total)}</b></td><td>${brl(x.avg)}</td><td>${x.last?x.last.toLocaleDateString("pt-BR"):"—"}</td></tr>`).join("")||'<tr><td class="empty" colspan="5">Nenhum cliente.</td></tr>'
}
function renderManuals(){
 let a=manuals().sort((x,y)=>(parseDate(y.paymentDate)||0)-(parseDate(x.paymentDate)||0));
 $("#manualCount").textContent=`${a.length} lançamentos`;
 $("#manualList").innerHTML=a.slice(0,18).map(r=>`<div class="attrow"><div class="attleft"><span class="atticon" style="color:#a78bfa;background:rgba(139,92,246,.08)"><i data-lucide="receipt-text"></i></span><div><b>${esc(r.name)}</b><small>${brl(r.value)} • ${esc(r.method)} • ${fmtDate(r.paymentDate)}</small></div></div><div style="display:flex;gap:12px"><button class="link" onclick="editManual('${r.id}')">Editar</button><button class="link" style="color:#ef8b89" onclick="deleteManual('${r.id}')">Excluir</button></div></div>`).join("")||'<div class="empty">Nenhum lançamento manual ainda.</div>';
 refreshIcons()
}
function renderPending(){
 let a=pendings().sort((x,y)=>(parseDate(x.due)||new Date(2999,0,1))-(parseDate(y.due)||new Date(2999,0,1))),total=a.reduce((sum,p)=>sum+p.value,0);
 $("#pendingHeader").textContent=brl(total);
 $("#pendingList").innerHTML=a.map(p=>`<div class="pending-item"><div class="pending-top"><div class="pending-name">${esc(p.name)}</div><div class="pending-value">${brl(p.value)}</div></div><div class="pending-meta"><span>${esc(p.method||"Forma não definida")}</span><span>${p.due?"Prazo "+fmtDate(p.due):"Sem prazo"}</span>${p.note?`<span>${esc(p.note)}</span>`:""}</div><div class="pending-actions"><button class="btn green" onclick="markPaid('${p.id}')"><i data-lucide="circle-check-big"></i>Marcar como pago</button><button class="btn" onclick="editPending('${p.id}')"><i data-lucide="pencil"></i>Editar</button><button class="btn danger" onclick="deletePending('${p.id}')"><i data-lucide="trash-2"></i>Excluir</button></div></div>`).join("")||'<div class="empty">Nenhum cliente em aberto.</div>';
 refreshIcons()
}
function renderAudit(){let a=JSON.parse(localStorage.getItem(K.audit)||"[]");$("#auditList").innerHTML=a.length?a.map(x=>`<div class="audititem"><time>${new Date(x.time).toLocaleString("pt-BR")}</time><div class="auditkind ${x.type}">${x.type==="delete"?"EXCLUSÃO":x.type==="change"?"ALTERAÇÃO":x.type==="add"?"ADIÇÃO":"MANUAL"}</div><div>${esc(x.msg)}</div></div>`).join(""):'<div class="empty">Nenhuma atividade registrada ainda.</div>'}
function renderAll(){syncSourceSwitch();renderDashboard();renderOrders();renderClients();renderManuals();renderPending();renderAudit();$("#csvEndpoint").textContent=endpoint().replace(/&t=\d+$/,"");refreshIcons()}
function refreshIcons(){if(window.lucide)lucide.createIcons({attrs:{"stroke-width":1.9}})}
function toast(msg){let t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove("show"),2200)}
