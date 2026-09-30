(()=>{
  'use strict';

  const DEFAULT_RULES={g40:40000,p40:3,g60:60000,p60:3.5,g80:80000,p80:4,fixedBase:0};
  const sellers=['ana','dayane'];
  const $=s=>document.querySelector(s);
  const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  let managementSettings={};

  async function request(method,key,value){
    const options={method,headers:{'Content-Type':'application/json'},cache:'no-store'};
    if(method==='PUT')options.body=JSON.stringify({key,value});
    const suffix=(method==='GET'?'?ts='+Date.now():'');
    const res=await fetch('/api/state'+suffix,options);
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));
    return data;
  }

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
  function apply(state){
    managementSettings=state?.managementSettings||{};
    const saved=managementSettings.sellerCommissions||{};
    sellers.forEach(key=>fill(key,saved[key]||DEFAULT_RULES));
  }

  async function load(){
    try{
      const data=await request('GET');
      apply(data.state||{});
      banner('Valores carregados do banco. Estes são os mesmos valores usados pelos painéis.','ok');
    }catch(error){
      sellers.forEach(key=>fill(key,DEFAULT_RULES));
      banner('Banco indisponível. Não é possível alterar as regras até a conexão voltar.','error');
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
    try{
      const next={
        ...managementSettings,
        sellerCommissions:{
          ...(managementSettings.sellerCommissions||{}),
          ana:{...rules.ana},
          dayane:{...rules.dayane}
        },
        updatedAt:new Date().toISOString()
      };

      await request('PUT','managementSettings',next);

      // Confirma lendo novamente exatamente o registro que os dashboards usam.
      const confirmation=await request('GET');
      const confirmed=confirmation?.state?.managementSettings||{};
      const ana=confirmed?.sellerCommissions?.ana;
      const dayane=confirmed?.sellerCommissions?.dayane;
      if(!ana||!dayane)throw new Error('O banco não devolveu as regras salvas.');

      const keys=['g40','p40','g60','p60','g80','p80','fixedBase'];
      const mismatch=keys.some(k=>Number(ana[k])!==Number(rules.ana[k]))||
        keys.some(k=>Number(dayane[k])!==Number(rules.dayane[k]));
      if(mismatch)throw new Error('A confirmação do banco não corresponde aos valores enviados.');

      managementSettings=confirmed;
      fill('ana',ana);fill('dayane',dayane);
      banner('Salvo e confirmado no banco • Ana: fixo '+brl(ana.fixedBase)+' • Dayane: fixo '+brl(dayane.fixedBase)+'.','ok');
    }catch(error){
      banner('Não foi possível salvar/confirmar no banco: '+error.message,'error');
    }finally{
      btn.disabled=false;btn.textContent='Salvar regras';
    }
  }

  sellers.forEach(key=>formFor(key).addEventListener('input',()=>preview(key)));
  $('#saveBtn').addEventListener('click',save);
  load();
})();