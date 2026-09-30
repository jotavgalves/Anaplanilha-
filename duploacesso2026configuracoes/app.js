(()=>{
  'use strict';
  const DEFAULT_RULES={g40:40000,p40:3,g60:60000,p60:3.5,g80:80000,p80:4,fixedBase:0};
  const LOCAL_KEY='ana_management_settings_v1';
  const ANA_DIRECT_KEY='ana_rules_direct_v2';
  const DAYANE_DIRECT_KEY='dayane_rules_direct_v2';
  const sellers=['ana','dayane'];
  const $=s=>document.querySelector(s);
  const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  let managementSettings={};
  let sharedSettings={};

  async function request(method,key,value){
    const options={method,headers:{'Content-Type':'application/json'},cache:'no-store'};
    if(method==='PUT')options.body=JSON.stringify({key,value});
    const res=await fetch('/api/state',options);
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));
    return data;
  }

  function readLocal(){
    try{
      const raw=JSON.parse(localStorage.getItem(LOCAL_KEY)||'null');
      if(!raw)return null;
      if(raw.value)return raw;
      if(raw.sellerCommissions)return {value:raw,pendingSync:false};
    }catch(_){}
    return null;
  }
  function writeLocal(value,pendingSync){
    try{localStorage.setItem(LOCAL_KEY,JSON.stringify({value,pendingSync:!!pendingSync,savedAt:new Date().toISOString()}));}catch(_){}
  }
  function writeDirectRules(rules,updatedAt){
    try{
      localStorage.setItem(ANA_DIRECT_KEY,JSON.stringify({rules:rules.ana,updatedAt}));
      localStorage.setItem(DAYANE_DIRECT_KEY,JSON.stringify({rules:rules.dayane,updatedAt}));
    }catch(_){}
  }
  function readDirectRules(key){
    try{
      const raw=JSON.parse(localStorage.getItem(key)||'null');
      return raw?.rules||null;
    }catch(_){return null;}
  }
  const stamp=value=>{const n=Date.parse(value?.updatedAt||'');return Number.isFinite(n)?n:0;};
  const hasRules=value=>!!(value?.sellerCommissions?.ana||value?.sellerCommissions?.dayane);

  function formFor(key){return document.querySelector('[data-seller="'+key+'"]');}
  function current(key){
    const form=formFor(key),out={};
    ['g40','p40','g60','p60','g80','p80','fixedBase'].forEach(name=>out[name]=Number(form.elements[name].value));
    return out;
  }
  function valid(r){
    if(![r.g40,r.g60,r.g80].every(v=>Number.isFinite(v)&&v>0))return 'As três metas precisam ser maiores que zero.';
    if(!(r.g40<r.g60&&r.g60<r.g80))return 'As metas precisam estar em ordem crescente: Meta 1 < Meta 2 < Meta 3.';
    if(![r.p40,r.p60,r.p80].every(v=>Number.isFinite(v)&&v>=0&&v<=100))return 'Os percentuais de comissão precisam ficar entre 0% e 100%.';
    if(!Number.isFinite(r.fixedBase)||r.fixedBase<0)return 'O fixo precisa ser zero ou maior.';
    return '';
  }
  function fill(key,rules){
    const form=formFor(key),r=Object.assign({},DEFAULT_RULES,rules||{});
    Object.keys(DEFAULT_RULES).forEach(name=>form.elements[name].value=String(r[name]??DEFAULT_RULES[name]));
    preview(key);
  }
  function preview(key){
    const r=current(key),el=document.querySelector('[data-preview="'+key+'"]');
    if(!el)return;
    el.innerHTML='<b>Leitura rápida:</b> em 50% da Meta 1, o fixo pago será '+brl(r.fixedBase*.5)+'. Ao atingir '+brl(r.g40)+', o fixo chega a '+brl(r.fixedBase)+'. Comissão: '+r.p40.toLocaleString('pt-BR')+'% até a Meta 2, '+r.p60.toLocaleString('pt-BR')+'% a partir dela e '+r.p80.toLocaleString('pt-BR')+'% a partir da Meta 3.';
  }
  function banner(message,type){
    const el=$('#banner');el.textContent=message;el.className='banner show '+type;
  }

  async function pushPendingLocal(showMessage=false){
    const entry=readLocal();
    if(!entry?.value||!entry.pendingSync)return false;
    try{
      await request('PUT','managementSettings',entry.value);
      writeLocal(entry.value,false);
      managementSettings=entry.value;
      if(showMessage)banner('Configuração local sincronizada com o banco.','ok');
      return true;
    }catch(_){return false;}
  }

  async function load(){
    const localEntry=readLocal();
    const localValue=localEntry?.value||{};
    try{
      const data=await request('GET');
      const remote=data?.state?.managementSettings||{};
      sharedSettings=Object.assign({},data?.state?.settings||{});
      const legacyBase=Object.assign({},DEFAULT_RULES,sharedSettings);
      const useLocal=hasRules(localValue)&&(localEntry?.pendingSync||stamp(localValue)>stamp(remote)||!hasRules(remote));
      managementSettings=useLocal?localValue:remote;
      if(useLocal){
        try{
          await request('PUT','managementSettings',localValue);
          writeLocal(localValue,false);
        }catch(_){
          writeLocal(localValue,true);
          banner('Banco indisponível. Usando a configuração salva neste navegador; a sincronização ficará pendente.','error');
        }
      }else if(hasRules(remote)){
        writeLocal(remote,false);
      }
      const saved=managementSettings.sellerCommissions||{};
      const anaDirect=readDirectRules(ANA_DIRECT_KEY);
      const dayaneDirect=readDirectRules(DAYANE_DIRECT_KEY);
      fill('ana',Object.assign({},legacyBase,saved.ana||{},anaDirect||{}));
      fill('dayane',Object.assign({},legacyBase,saved.dayane||{},dayaneDirect||{}));
    }catch(error){
      managementSettings=hasRules(localValue)?localValue:{};
      const saved=managementSettings.sellerCommissions||{};
      sellers.forEach(key=>fill(key,Object.assign({},DEFAULT_RULES,saved[key]||{})));
      banner(hasRules(localValue)?'Banco indisponível. Carreguei as regras salvas localmente; você pode continuar usando e editando normalmente.':'Banco indisponível e ainda não há uma configuração local salva. Preencha e salve as regras abaixo.','error');
    }
  }

  async function save(){
    const rules={};
    for(const key of sellers){
      rules[key]=current(key);
      const error=valid(rules[key]);
      if(error){banner((key==='ana'?'Ana: ':'Dayane: ')+error,'error');return;}
    }
    const btn=$('#saveBtn');btn.disabled=true;btn.textContent='Salvando...';
    managementSettings=Object.assign({},managementSettings,{
      sellerCommissions:Object.assign({},managementSettings.sellerCommissions||{},rules),
      updatedAt:new Date().toISOString()
    });
    writeLocal(managementSettings,true);
    writeDirectRules(rules,managementSettings.updatedAt);
    try{
      await request('PUT','managementSettings',managementSettings);
      sharedSettings=Object.assign({},sharedSettings,rules.ana);
      await request('PUT','settings',sharedSettings);
      const confirmation=await request('GET');
      const savedFixed=Number(confirmation?.state?.managementSettings?.sellerCommissions?.ana?.fixedBase);
      const expectedFixed=Number(rules.ana.fixedBase);
      if(!Number.isFinite(savedFixed)||Math.abs(savedFixed-expectedFixed)>0.001){
        writeLocal(managementSettings,true);
        throw new Error('O banco não confirmou o fixo da Ana.');
      }
      writeLocal(managementSettings,false);
      writeDirectRules(rules,managementSettings.updatedAt);
      banner('Salvo: fixo da Ana '+brl(expectedFixed)+' • fixo da Dayane '+brl(rules.dayane.fixedBase)+'. Os painéis já podem usar estes valores.','ok');
    }catch(error){
      banner('Regras salvas neste navegador. O banco não confirmou a gravação agora; a sincronização ficará pendente.','ok');
    }finally{
      btn.disabled=false;btn.textContent='Salvar regras';
    }
  }

  sellers.forEach(key=>formFor(key).addEventListener('input',()=>preview(key)));
  $('#saveBtn').addEventListener('click',save);
  window.addEventListener('online',()=>pushPendingLocal(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)pushPendingLocal(false);});
  setInterval(()=>pushPendingLocal(false),15000);
  load();
})();