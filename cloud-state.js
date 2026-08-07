const CLOUD_DEFAULTS = {
  manual: [], pending: [], notes: {}, clientNotes: {}, audit: [], settings: {}, snapshot: {}
};
let cloudState = structuredClone(CLOUD_DEFAULTS);
let cloudOnline = false;
let cloudWriteChain = Promise.resolve();

async function cloudRequest(method, key, value) {
  const options = { method, headers: { "Content-Type": "application/json" }, cache: "no-store" };
  if (method === "PUT") options.body = JSON.stringify({ key, value });
  const response = await fetch("/api/state", options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function queueCloudWrite(key, value) {
  const snapshotValue = structuredClone(value);
  cloudWriteChain = cloudWriteChain
    .then(async()=>{
      const result=await cloudRequest("PUT", key, snapshotValue);
      cloudOnline=true;
      return result;
    })
    .catch(error => {
      console.error("Falha ao salvar no D1", key, error);
      if (typeof toast === "function") toast("Não consegui salvar esta alteração no banco.");
    });
  return cloudWriteChain;
}

function oldLocalState() {
  const read = (key, fallback) => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (_) { return fallback; }
  };
  const settings=read(K.settings, {});
  try {
    const source=localStorage.getItem("ana_v4_dashboard_source");
    if(source&&!settings.dashboardSource)settings.dashboardSource=source;
  } catch (_) {}
  return {
    manual: read(K.manual, []),
    pending: read(K.pending, []),
    notes: read(K.notes, {}),
    clientNotes: {},
    audit: read(K.audit, []),
    settings,
    snapshot: read(K.snapshot, {})
  };
}

function hasMeaningfulLocalState(s) {
  return (s.manual?.length || 0) + (s.pending?.length || 0) + (s.audit?.length || 0) > 0 ||
    Object.keys(s.notes || {}).length > 0 || Object.keys(s.settings || {}).length > 0;
}
function hasMeaningfulCloudState(s) {
  return (s.manual?.length || 0) + (s.pending?.length || 0) + (s.audit?.length || 0) > 0 ||
    Object.keys(s.notes || {}).length > 0 || Object.keys(s.clientNotes || {}).length > 0 || Object.keys(s.settings || {}).length > 0;
}
function clearLegacyLocalState() {
  [K.manual,K.pending,K.notes,K.audit,K.settings,K.snapshot,K.cache,"ana_v4_dashboard_source"].forEach(k=>localStorage.removeItem(k));
}

function sanitizeAdminResidue(settings){
  const next=Object.assign({},settings||{});
  const hadAdminKeys=['profile','profileName','sellerName'].some(key=>Object.prototype.hasOwnProperty.call(next,key));
  const dayaneSheet=String(next.sheetUrl||'').includes('1yuR43gP2_kPMZpySYeiyJIJXRwGchvosa31fhigVoMw');
  const dayaneTab=String(next.sheetName||'').trim()==='VENNDA DO MÊS';
  if(!hadAdminKeys&&!dayaneSheet&&!dayaneTab)return {changed:false,value:next};
  delete next.profile;delete next.profileName;delete next.sellerName;
  if(dayaneSheet||dayaneTab){
    next.sheetUrl=DEFAULT_SHEET_URL;
    next.sheetName=DEFAULT_SHEET_NAME;
  }
  return {changed:true,value:next};
}

async function loadCloudState() {
  try {
    const data = await cloudRequest("GET");
    const remoteState = Object.assign(structuredClone(CLOUD_DEFAULTS), data.state || {});
    const cleaned=sanitizeAdminResidue(remoteState.settings);
    if(cleaned.changed){
      remoteState.settings=cleaned.value;
      try{await cloudRequest("PUT","settings",cleaned.value)}catch(error){console.warn("Não foi possível remover o resíduo do perfil administrativo do D1",error)}
    }
    cloudState = remoteState;
    cloudOnline = true;

    const legacy = oldLocalState();
    if (!hasMeaningfulCloudState(remoteState) && hasMeaningfulLocalState(legacy)) {
      const migratedState = Object.assign(structuredClone(CLOUD_DEFAULTS), legacy);
      try {
        for (const key of ["manual","pending","notes","audit","settings","snapshot"]) {
          await cloudRequest("PUT", key, migratedState[key]);
        }
        cloudState = migratedState;
        clearLegacyLocalState();
      } catch (migrationError) {
        console.warn("D1 conectado, mas a migração do cache antigo não foi concluída", migrationError);
        cloudState = remoteState;
      }
    } else {
      clearLegacyLocalState();
    }
    return true;
  } catch (error) {
    cloudOnline = false;
    console.error("D1 indisponível", error);
    return false;
  }
}

manuals = function(){ return cloudState.manual || []; };
pendings = function(){ return cloudState.pending || []; };
saveManuals = function(value){ cloudState.manual = value; return queueCloudWrite("manual", value); };
savePendings = function(value){ cloudState.pending = value; return queueCloudWrite("pending", value); };

cfg = function(){
  return Object.assign({
    sheetUrl:DEFAULT_SHEET_URL,
    sheetName:DEFAULT_SHEET_NAME,
    interval:60,
    g40:40000,p40:3,
    g60:60000,p60:3.5,
    g80:80000,p80:4
  }, cloudState.settings || {});
};
window.saveCloudSettings = function(patch){
  cloudState.settings = Object.assign({}, cloudState.settings || {}, patch || {});
  return queueCloudWrite("settings", cloudState.settings);
};

dashboardSourceMode = function(){ return cloudState.settings?.dashboardSource || "all"; };

auditAdd = function(type,msg){
  const list = cloudState.audit || [];
  list.unshift({time:new Date().toISOString(),type,msg});
  cloudState.audit = list.slice(0,1200);
  queueCloudWrite("audit", cloudState.audit);
};

compareSnapshot = function(rows){
  const neu=snapshot(rows),old=cloudState.snapshot || {};
  if(Object.keys(old).length){
    for(let [id,o] of Object.entries(old)){
      if(!neu[id]) auditAdd("delete",`Pedido #${id} de ${o.name||"cliente não identificado"} foi removido da planilha.`);
      else {
        let n=neu[id],changes=[];
        for(let [k,label] of Object.entries({name:"Cliente",value:"Valor",payment:"Pagamento",status:"Status",method:"Forma",description:"Descrição",due:"Previsão de entrega"})){
          if(String(o[k]??"")!==String(n[k]??""))changes.push(`${label}: "${o[k]??"}" → "${n[k]??"}"`);
        }
        if(changes.length)auditAdd("change",`Pedido #${id} alterado: ${changes.join(" • ")}`);
      }
    }
    for(let [id,n] of Object.entries(neu)) if(!old[id]) auditAdd("add",`Novo pedido #${id} adicionado pela planilha para ${n.name||"cliente não identificado"} (${brl(n.value)}).`);
  }
  cloudState.snapshot = neu;
  queueCloudWrite("snapshot", neu);
};

function showDatabaseWarning(){
  const b=$("#banner");
  if(!b)return;
  b.style.display="block";
  b.innerHTML='<b>Salvamento online não conectado.</b> Vincule um banco Cloudflare D1 ao Pages usando o binding <b>DB</b>.';
}

sync = async function(){
  $("#syncText").textContent="Sincronizando com a planilha...";
  try{
    const res=await fetch(endpoint(),{cache:"no-store"});
    if(!res.ok)throw Error(`HTTP ${res.status}`);
    const txt=await res.text();
    if(!txt.includes("ID_PEDIDO"))throw Error("A aba esperada não foi encontrada");
    const parsed=csvParse(txt);
    if(!parsed.length)throw Error("A aba retornou vazia");
    compareSnapshot(parsed);
    sheetData=parsed;
    if(cloudOnline)$("#banner").style.display="none";else showDatabaseWarning();
    $("#syncText").textContent=`Sincronizado às ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`;
  }catch(error){
    const b=$("#banner");
    b.style.display="block";
    b.innerHTML=`Não consegui atualizar a Google Sheets agora. Os dados já carregados continuam visíveis. <span style="opacity:.65">${esc(error.message)}</span>`;
    $("#syncText").textContent="Planilha temporariamente indisponível";
  }
  rebuildMonths();
  if(typeof renderAll==="function")renderAll();
};

window.cloudNotes = function(){ return cloudState.notes || {}; };
window.saveCloudNotes = function(value){ cloudState.notes = value; return queueCloudWrite("notes", value); };
window.cloudClientNotes = function(){ return cloudState.clientNotes || {}; };
window.saveCloudClientNotes = function(value){ cloudState.clientNotes = value; return queueCloudWrite("clientNotes", value); };
window.cloudAudit = function(){ return cloudState.audit || []; };
window.cloudStateOnline = function(){ return cloudOnline; };
window.refreshCloudHealth = async function(){
  try {
    await cloudRequest("GET");
    cloudOnline = true;
    return true;
  } catch (error) {
    cloudOnline = false;
    return false;
  }
};
window.__cloudStateReady = loadCloudState();
