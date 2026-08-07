const EMBEDDED_DATA = [];
const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/1EdkihhLcVQiUlJMb54RknQTHzq6RyqNhNzONvzBbTpM";
const DEFAULT_SHEET_ID = "1EdkihhLcVQiUlJMb54RknQTHzq6RyqNhNzONvzBbTpM";
const DEFAULT_SHEET_NAME = "VENDA DO MÊS";
const K={settings:"ana_v3_settings",manual:"ana_v3_manual",pending:"ana_v3_pending",notes:"ana_v3_notes",snapshot:"ana_v3_snapshot",audit:"ana_v3_audit",cache:"ana_v3_cache"};
let sheetData=[], currentOrderKey=null, timer=null;

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const brl=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)||0);
const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function money(v){if(typeof v==="number")return v;let s=String(v??"").trim().replace(/R\$\s?/i,"");if(!s)return 0;if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");return Number(s)||0}
function parseDate(v){if(!v)return null;if(v instanceof Date)return v;if(typeof v==="number"&&v>30000)return new Date(Date.UTC(1899,11,30)+v*86400000);let s=String(v).trim(),m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);if(m){let y=+m[3];if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1])}let d=new Date(s);return isNaN(d)?null:d}
const fmtDate=v=>{let d=parseDate(v);return d?d.toLocaleDateString("pt-BR"):"—"};
const monthKey=d=>d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`:"";
const monthLabel=k=>{let [y,m]=k.split("-").map(Number);return new Date(y,m-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"}).replace(/^./,c=>c.toUpperCase())};
const uid=()=>`${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;

function canonicalSheet(r){
 return {key:`sheet:${String(r["ID_PEDIDO"]??"").trim()||uid()}`,source:"sheet",seller:r["VENDEDORA "]??r["VENDEDORA"]??"",orderId:String(r["ID_PEDIDO"]??"").trim(),clientId:String(r["ID_CLIENTE"]??"").trim(),name:String(r["NOME DO CLIENTE"]??"").trim(),value:money(r["VALOR DO PAGAMENTO"]),payment:String(r["STATUS DO PAGAMENTO"]??"").trim().toUpperCase(),paymentDate:r["DATA DO PAGAMENTO"]??"",status:String(r["STATUS DO PEDIDO"]??"").trim(),document:String(r["CPF/CNPJ"]??"").trim(),phone:String(r["TELEFONE"]??"").trim(),email:String(r["EMAIL"]??"").trim(),birth:r["DATA DE NASCIMENTO"]??"",method:String(r["FORMA DE PAGAMENTO"]??"").trim(),installments:r["QUANTIDADE DE PARCELA"]??"",description:String(r["DESCRIÇÃO"]??"").trim(),due:r["DATA_P_ENTREGA"]??"",delivered:r["DATA_ENTREGA"]??""};
}
function manuals(){return JSON.parse(localStorage.getItem(K.manual)||"[]")}
function pendings(){return JSON.parse(localStorage.getItem(K.pending)||"[]")}
function saveManuals(a){localStorage.setItem(K.manual,JSON.stringify(a))}
function savePendings(a){localStorage.setItem(K.pending,JSON.stringify(a))}
function allPaidRows(){return [...sheetData.map(canonicalSheet).filter(r=>norm(r.payment)==="pago"&&r.value>0),...manuals().map(r=>({...r,source:"manual",payment:"PAGO"}))]}
function rowsMonth(k){return allPaidRows().filter(r=>monthKey(parseDate(r.paymentDate))===k)}
function dashboardSourceMode(){return localStorage.getItem("ana_v4_dashboard_source")||"all"}
function dashboardRows(k){
 let rows=rowsMonth(k),mode=dashboardSourceMode();
 if(mode==="sheet")return rows.filter(r=>r.source==="sheet");
 if(mode==="manual")return rows.filter(r=>r.source==="manual");
 return rows;
}
function syncSourceSwitch(){
 let mode=dashboardSourceMode();
 $$("#sourceSwitch [data-source-mode]").forEach(b=>b.classList.toggle("active",b.dataset.sourceMode===mode));
 let captions={
  all:"Planilha e lançamentos manuais estão somados em todos os indicadores abaixo.",
  sheet:"Todos os cálculos abaixo consideram somente as vendas sincronizadas da Google Sheets.",
  manual:"Todos os cálculos abaixo consideram somente os lançamentos manuais pagos."
 };
 $("#sourceCaption").textContent=captions[mode];
}
function aggregateOrders(rows){
 const m=new Map();
 rows.forEach((r,i)=>{const id=r.orderId||r.key||`row${i}`;const key=`${r.source}:${id}`;if(!m.has(key))m.set(key,{...r,key,value:0});const x=m.get(key);x.value+=r.value;if(r.status)x.status=r.status;if(r.description)x.description=r.description});
 return [...m.values()];
}
function cfg(){return Object.assign({sheetUrl:DEFAULT_SHEET_URL,sheetName:DEFAULT_SHEET_NAME,interval:60,g60:60000,g80:80000},JSON.parse(localStorage.getItem(K.settings)||"{}"))}
function commission(total){const s=cfg();let rate=total>=s.g80?.04:total>=s.g60?.035:.03;return {rate,value:total*rate,label:(rate*100).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%"}}
function sourceLabel(s){return s==="manual"?"Manual":"Planilha"}
function normalizedStatus(s){let n=norm(s);if(!n)return "Sem status";if(n.includes("costura"))return"Costura";if(n.includes("corte"))return"Corte";if(n.includes("impress"))return"Impressão";if(n.includes("produ"))return"Produção";if(n.includes("pronto"))return"Pronto";if(n.includes("retir")||n.includes("entreg"))return"Entregue/Retirado";if(n.includes("cancel"))return"Cancelado";if(n.includes("arte"))return"Arte";return s.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,"").trim()||"Outro"}
function sheetId(url){return (String(url).match(/\/spreadsheets\/d\/([A-Za-z0-9-_]+)/)||[])[1]||DEFAULT_SHEET_ID}
function endpoint(){let s=cfg();return `https://docs.google.com/spreadsheets/d/${sheetId(s.sheetUrl)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(s.sheetName)}&t=${Date.now()}`}
function csvParse(text){let rows=[],row=[],cell="",q=false;for(let i=0;i<text.length;i++){let c=text[i],n=text[i+1];if(q){if(c==='"'&&n==='"'){cell+='"';i++}else if(c==='"')q=false;else cell+=c}else{if(c==='"')q=true;else if(c===","){row.push(cell);cell=""}else if(c==="\n"){row.push(cell);rows.push(row);row=[];cell=""}else if(c!=="\r")cell+=c}}if(cell.length||row.length){row.push(cell);rows.push(row)}let h=(rows.shift()||[]).map(x=>x.trim());return rows.filter(r=>r.some(x=>String(x).trim())).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??""])))}

function auditAdd(type,msg){let a=JSON.parse(localStorage.getItem(K.audit)||"[]");a.unshift({time:new Date().toISOString(),type,msg});localStorage.setItem(K.audit,JSON.stringify(a.slice(0,1200)))}
function snapshot(rows){let m={};rows.map(canonicalSheet).forEach((r,i)=>{let id=r.orderId||`row_${i}`;m[id]=r});return m}
function compareSnapshot(rows){let neu=snapshot(rows),old=JSON.parse(localStorage.getItem(K.snapshot)||"{}");if(Object.keys(old).length){for(let [id,o] of Object.entries(old)){if(!neu[id])auditAdd("delete",`Pedido #${id} de ${o.name||"cliente não identificado"} foi removido da planilha.`);else{let n=neu[id],changes=[];for(let [k,label] of Object.entries({name:"Cliente",value:"Valor",payment:"Pagamento",status:"Status",method:"Forma",description:"Descrição",due:"Previsão de entrega"})){if(String(o[k]??"")!==String(n[k]??""))changes.push(`${label}: "${o[k]??""}" → "${n[k]??""}"`)}if(changes.length)auditAdd("change",`Pedido #${id} alterado: ${changes.join(" • ")}`)}}for(let [id,n] of Object.entries(neu))if(!old[id])auditAdd("add",`Novo pedido #${id} adicionado pela planilha para ${n.name||"cliente não identificado"} (${brl(n.value)}).`)}
 localStorage.setItem(K.snapshot,JSON.stringify(neu))
}
async function sync(){
 $("#syncText").textContent="Sincronizando com a planilha...";
 try{let res=await fetch(endpoint(),{cache:"no-store"});if(!res.ok)throw Error(`HTTP ${res.status}`);let txt=await res.text();if(!txt.includes("ID_PEDIDO"))throw Error("A aba esperada não foi encontrada");let parsed=csvParse(txt);if(!parsed.length)throw Error("A aba retornou vazia");compareSnapshot(parsed);sheetData=parsed;localStorage.setItem(K.cache,JSON.stringify(parsed));$("#banner").style.display="none";$("#syncText").textContent=`Sincronizado às ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`}
 catch(e){let cache=JSON.parse(localStorage.getItem(K.cache)||"null");sheetData=cache?.length?cache:EMBEDDED_DATA;let b=$("#banner");b.style.display="block";b.innerHTML=`Não consegui ler a Google Sheets neste momento. Estou usando a última cópia disponível. <span style="opacity:.65">${esc(e.message)}</span>`;$("#syncText").textContent="Usando cópia local da planilha"}
 rebuildMonths();renderAll()
}
function rebuildMonths(){let keys=[...new Set(allPaidRows().map(r=>monthKey(parseDate(r.paymentDate))).filter(Boolean))].sort().reverse(),sel=$("#monthSelect"),prev=sel.value;let now=monthKey(new Date());if(!keys.includes(now))keys.unshift(now);sel.innerHTML=keys.map(k=>`<option value="${k}">${monthLabel(k)}</option>`).join("");sel.value=keys.includes(prev)?prev:(keys.includes(now)?now:keys[0])}
const selectedMonth=()=>$("#monthSelect").value;
