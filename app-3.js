function formObj(form){return Object.fromEntries(new FormData(form).entries())}
$("#manualForm").addEventListener("submit",e=>{
 e.preventDefault();
 let f=formObj(e.currentTarget),v=money(f.value);
 if(!f.name.trim()||v<=0||!f.method){toast("Preencha cliente, valor e forma de pagamento.");return}
 let a=manuals(),existing=f.editId?a.find(x=>x.id===f.editId):null;
 let r={
  id:existing?.id||uid(),key:existing?.key||("manual:"+uid()),source:"manual",
  orderId:f.orderId.trim()||existing?.orderId||`M${String(Date.now()).slice(-6)}`,
  clientId:existing?.clientId||"",name:f.name.trim(),value:v,payment:"PAGO",
  paymentDate:f.date||new Date().toISOString().slice(0,10),status:f.status||"",
  document:f.document||"",phone:f.phone||"",email:f.email||"",method:f.method,
  description:f.description||"",due:f.due||"",delivered:existing?.delivered||"",
  createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()
 };
 if(existing){
  a=a.map(x=>x.id===existing.id?r:x);
  auditAdd("manual",`Lançamento manual #${r.orderId} de ${r.name} foi editado. Valor atual: ${brl(r.value)}.`);
 }else{
  a.unshift(r);
  auditAdd("manual",`Venda manual #${r.orderId} lançada para ${r.name} no valor de ${brl(r.value)}.`);
 }
 saveManuals(a);resetManualForm();rebuildMonths();renderAll();
 toast(existing?"Lançamento atualizado.":"Venda lançada e contabilizada.");
});
$("#pendingForm").addEventListener("submit",e=>{
 e.preventDefault();
 let f=formObj(e.currentTarget),v=money(f.value);
 if(!f.name.trim()||v<=0){toast("Preencha cliente e valor.");return}
 let a=pendings(),existing=f.editId?a.find(x=>x.id===f.editId):null;
 let p={
  id:existing?.id||uid(),name:f.name.trim(),value:v,method:f.method||"",
  due:f.due||"",note:f.note||"",createdAt:existing?.createdAt||new Date().toISOString(),
  updatedAt:new Date().toISOString()
 };
 if(existing){
  a=a.map(x=>x.id===existing.id?p:x);
  auditAdd("manual",`Valor a receber de ${p.name} foi editado para ${brl(p.value)}.`);
 }else{
  a.unshift(p);
  auditAdd("manual",`Valor a receber adicionado para ${p.name}: ${brl(p.value)}.`);
 }
 savePendings(a);resetPendingForm();renderAll();
 toast(existing?"Valor a receber atualizado.":"Cliente adicionado em A receber.");
});

function resetManualForm(){
 let f=$("#manualForm");f.reset();f.elements.editId.value="";
 f.elements.date.value=new Date().toISOString().slice(0,10);
 $("#manualEditNote").classList.remove("show");$("#manualCancelEdit").style.display="none";
 $("#manualSubmitBtn span").textContent="Lançar venda";refreshIcons()
}
window.editManual=id=>{
 let r=manuals().find(x=>x.id===id);if(!r)return;switchView("manual");
 let f=$("#manualForm");f.elements.editId.value=r.id;f.elements.name.value=r.name||"";
 f.elements.value.value=String(r.value).replace(".",",");f.elements.method.value=r.method||"";
 f.elements.date.value=(parseDate(r.paymentDate)||new Date()).toISOString().slice(0,10);
 f.elements.orderId.value=r.orderId||"";f.elements.status.value=r.status||"";
 f.elements.phone.value=r.phone||"";f.elements.document.value=r.document||"";
 f.elements.email.value=r.email||"";f.elements.due.value=r.due?((parseDate(r.due)||new Date()).toISOString().slice(0,10)):"";
 f.elements.description.value=r.description||"";
 $("#manualEditNote").classList.add("show");$("#manualCancelEdit").style.display="inline-flex";
 $("#manualSubmitBtn span").textContent="Salvar alterações";window.scrollTo({top:0,behavior:"smooth"});refreshIcons()
};
function resetPendingForm(){
 let f=$("#pendingForm");f.reset();f.elements.editId.value="";
 $("#pendingEditNote").classList.remove("show");$("#pendingCancelEdit").style.display="none";
 $("#pendingSubmitBtn span").textContent="Adicionar a receber";refreshIcons()
}
window.editPending=id=>{
 let p=pendings().find(x=>x.id===id);if(!p)return;switchView("pending");
 let f=$("#pendingForm");f.elements.editId.value=p.id;f.elements.name.value=p.name||"";
 f.elements.value.value=String(p.value).replace(".",",");f.elements.method.value=p.method||"";
 f.elements.due.value=p.due?((parseDate(p.due)||new Date()).toISOString().slice(0,10)):"";
 f.elements.note.value=p.note||"";
 $("#pendingEditNote").classList.add("show");$("#pendingCancelEdit").style.display="inline-flex";
 $("#pendingSubmitBtn span").textContent="Salvar alterações";window.scrollTo({top:0,behavior:"smooth"});refreshIcons()
};
$("#manualCancelEdit").onclick=resetManualForm;
$("#pendingCancelEdit").onclick=resetPendingForm;

window.markPaid=id=>{let a=pendings(),p=a.find(x=>x.id===id);if(!p)return;let method=p.method||"PIX";let r={id:uid(),key:"manual:"+uid(),source:"manual",orderId:`R${String(Date.now()).slice(-6)}`,clientId:"",name:p.name,value:p.value,payment:"PAGO",paymentDate:new Date().toISOString().slice(0,10),status:"",document:"",phone:"",email:"",method,description:p.note||"",due:"",delivered:"",createdAt:new Date().toISOString(),fromPending:true};let ms=manuals();ms.unshift(r);saveManuals(ms);savePendings(a.filter(x=>x.id!==id));auditAdd("manual",`${p.name} foi marcado como pago (${brl(p.value)}) e convertido em lançamento manual.`);rebuildMonths();renderAll();toast("Pagamento recebido e lançado nas vendas.")};
window.deletePending=id=>{let a=pendings(),p=a.find(x=>x.id===id);if(!p)return;savePendings(a.filter(x=>x.id!==id));auditAdd("manual",`Registro a receber de ${p.name} (${brl(p.value)}) foi excluído.`);renderAll();toast("Registro removido.")};
window.deleteManual=id=>{let a=manuals(),r=a.find(x=>x.id===id);if(!r)return;saveManuals(a.filter(x=>x.id!==id));auditAdd("manual",`Lançamento manual de ${r.name} (${brl(r.value)}) foi excluído.`);rebuildMonths();renderAll();toast("Lançamento excluído.")};

window.openOrder=enc=>{let key=decodeURIComponent(enc),r=aggregateOrders(rowsMonth(selectedMonth())).find(x=>x.key===key);if(!r)return;currentOrderKey=key;$("#drawerTitle").textContent=`Pedido #${r.orderId||"—"}`;$("#drawerSub").textContent=`${r.name||"Cliente não identificado"} • ${sourceLabel(r.source)}`;let fields=[["Valor pago",brl(r.value)],["Pagamento","Pago"],["Forma",r.method||"—"],["Status",normalizedStatus(r.status)],["Data",fmtDate(r.paymentDate)],["Telefone",r.phone||"—"],["CPF/CNPJ",r.document||"—"],["E-mail",r.email||"—"],["Previsão",fmtDate(r.due)],["Descrição",r.description||"—"]];$("#drawerDetails").innerHTML=fields.map(([a,b])=>`<div class="detail"><small>${esc(a)}</small><b>${esc(b)}</b></div>`).join("");renderNotes();$("#drawerBack").classList.add("open");$("#drawer").classList.add("open");refreshIcons()};
function closeDrawer(){$("#drawerBack").classList.remove("open");$("#drawer").classList.remove("open")}
function renderNotes(){let all=JSON.parse(localStorage.getItem(K.notes)||"{}"),a=all[currentOrderKey]||[];$("#noteList").innerHTML=a.map(n=>`<div class="note">${esc(n.text)}<time>${new Date(n.time).toLocaleString("pt-BR")}</time></div>`).join("")||'<div class="muted">Nenhuma anotação.</div>'}
$("#addNote").onclick=()=>{let t=$("#noteText").value.trim();if(!t||!currentOrderKey)return;let all=JSON.parse(localStorage.getItem(K.notes)||"{}");all[currentOrderKey]=all[currentOrderKey]||[];all[currentOrderKey].unshift({text:t,time:new Date().toISOString()});localStorage.setItem(K.notes,JSON.stringify(all));$("#noteText").value="";renderNotes();toast("Anotação adicionada.")};

function switchView(id){$$(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.view===id));$$(".view").forEach(x=>x.classList.toggle("active",x.id===id));let titles={dashboard:"Olá, Ana!",orders:"Pedidos",manual:"Lançamentos manuais",pending:"Clientes a receber",clients:"Clientes",audit:"Atividades",settings:"Configurações"};$("#pageTitle").textContent=titles[id]||"Olá, Ana!";if(id==="audit")renderAudit();refreshIcons()}
$$(".nav button").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$$("#sourceSwitch [data-source-mode]").forEach(b=>b.onclick=()=>{
 localStorage.setItem("ana_v4_dashboard_source",b.dataset.sourceMode);
 syncSourceSwitch();renderDashboard();refreshIcons();
});
document.addEventListener("click",e=>{let b=e.target.closest("[data-view-go]");if(b)switchView(b.dataset.viewGo)});
$("#refreshBtn").onclick=sync;$("#openSheet").onclick=()=>window.open(cfg().sheetUrl,"_blank");$("#monthSelect").onchange=renderAll;$("#orderSearch").oninput=renderOrders;$("#sourceFilter").onchange=renderOrders;$("#statusFilter").onchange=renderOrders;$("#clientSearch").oninput=renderClients;$("#drawerBack").onclick=closeDrawer;$("#drawerClose").onclick=closeDrawer;
$("#saveSettings").onclick=()=>{let s=cfg();s.sheetUrl=$("#sheetUrlInput").value.trim();s.sheetName=$("#sheetNameInput").value.trim();s.interval=+$("#refreshInterval").value;s.g60=+$("#goal60").value;s.g80=+$("#goal80").value;localStorage.setItem(K.settings,JSON.stringify(s));setupTimer();sync();toast("Configurações salvas.")};
function loadSettings(){let s=cfg();$("#sheetUrlInput").value=s.sheetUrl;$("#sheetNameInput").value=s.sheetName;$("#refreshInterval").value=String(s.interval);$("#goal60").value=s.g60;$("#goal80").value=s.g80}
function setupTimer(){if(timer)clearInterval(timer);let sec=cfg().interval;if(sec>0)timer=setInterval(sync,sec*1000)}
loadSettings();$("#manualForm").elements.date.value=new Date().toISOString().slice(0,10);sheetData=EMBEDDED_DATA;rebuildMonths();renderAll();setupTimer();refreshIcons();sync();
