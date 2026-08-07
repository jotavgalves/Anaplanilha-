async function ensure(db){
  if(!db) throw new Error('D1 binding DB não configurado');
  await db.prepare(`CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    entity_key TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_annotations_entity ON annotations(scope, entity_key, updated_at DESC)').run();
}
function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
function validOrigin(request){const o=request.headers.get('Origin');return !o||o===new URL(request.url).origin}
export async function onRequestGet({request,env}){
  try{await ensure(env.DB);const u=new URL(request.url),scope=u.searchParams.get('scope'),entity=u.searchParams.get('entity');let q='SELECT * FROM annotations',args=[];if(scope&&entity){q+=' WHERE scope=?1 AND entity_key=?2';args=[scope,entity]}else if(scope){q+=' WHERE scope=?1';args=[scope]}q+=' ORDER BY updated_at DESC';let st=env.DB.prepare(q);if(args.length)st=st.bind(...args);const r=await st.all();return json({ok:true,annotations:r.results||[]})}catch(e){return json({ok:false,error:e.message},503)}
}
export async function onRequestPost({request,env}){
  try{if(!validOrigin(request))return json({ok:false,error:'Origem não permitida'},403);await ensure(env.DB);const b=await request.json(),scope=String(b.scope||''),entityKey=String(b.entityKey||''),text=String(b.text||'').trim();if(!['order','client'].includes(scope)||!entityKey||!text)return json({ok:false,error:'Dados inválidos'},400);const now=new Date().toISOString();if(scope==='client'){const old=await env.DB.prepare('SELECT id, created_at FROM annotations WHERE scope=?1 AND entity_key=?2 LIMIT 1').bind(scope,entityKey).first();const id=old?.id||crypto.randomUUID();await env.DB.prepare(`INSERT INTO annotations(id,scope,entity_key,text,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(id) DO UPDATE SET text=excluded.text,updated_at=excluded.updated_at`).bind(id,scope,entityKey,text,old?.created_at||now,now).run();return json({ok:true,id,updatedAt:now})}const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO annotations(id,scope,entity_key,text,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6)').bind(id,scope,entityKey,text,now,now).run();return json({ok:true,id,updatedAt:now})}catch(e){return json({ok:false,error:e.message},503)}
}
export async function onRequestDelete({request,env}){
  try{if(!validOrigin(request))return json({ok:false,error:'Origem não permitida'},403);await ensure(env.DB);const u=new URL(request.url),id=u.searchParams.get('id'),scope=u.searchParams.get('scope'),entity=u.searchParams.get('entity');if(id)await env.DB.prepare('DELETE FROM annotations WHERE id=?1').bind(id).run();else if(scope&&entity)await env.DB.prepare('DELETE FROM annotations WHERE scope=?1 AND entity_key=?2').bind(scope,entity).run();else return json({ok:false,error:'Identificador ausente'},400);return json({ok:true})}catch(e){return json({ok:false,error:e.message},503)}
}
