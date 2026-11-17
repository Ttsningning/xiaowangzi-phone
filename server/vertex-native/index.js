const ORIGIN='https://xiaowangzi-phone.gtt137233896.chatgpt.site';
const enc=new TextEncoder(),dec=new TextDecoder(),tokens=new Map();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));
const locationOK=s=>s==='global'||/^[a-z]+(?:-[a-z0-9]+)*\d$/.test(s||'');
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin'}});
const error=(message,status=400)=>Object.assign(Error(message),{status});
async function key(env){if(!env.VERTEX_SEAL_KEY)throw error('认证服务未配置',503);return crypto.subtle.importKey('raw',bytes(env.VERTEX_SEAL_KEY),'AES-GCM',false,['encrypt','decrypt'])}
export async function seal(value,env){const iv=crypto.getRandomValues(new Uint8Array(12));return 'vx1.'+b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(ORIGIN)},await key(env),enc.encode(JSON.stringify(value))))}
export async function open(ticket,env){try{const [version,iv,data]=ticket.split('.');if(version!=='vx1'||!iv||!data||ticket.length>20000)throw Error();return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv),additionalData:enc.encode(ORIGIN)},await key(env),bytes(data))))}catch{throw error('账号凭据已失效，请重新导入 JSON',401)}}
export async function validate(raw){
 if(raw?.type!=='service_account'||!/^[a-z][a-z0-9-]{4,62}$/.test(raw.project_id||'')||!/^[-a-zA-Z0-9_.]+@[-a-zA-Z0-9.]+\.iam\.gserviceaccount\.com$/.test(raw.client_email||''))throw error('请导入完整的 Service Account JSON');
 if(typeof raw.private_key!=='string'||raw.private_key.length>16000)throw error('JSON 缺少私钥');
 let signingKey;try{signingKey=await crypto.subtle.importKey('pkcs8',bytes(raw.private_key.replace(/-----[^-]+-----|\s/g,'')),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign'])}catch{throw error('JSON 私钥格式无效')}
 if(signingKey.algorithm.modulusLength<2048)throw error('需要至少2048位 RSA 私钥');
 return {account:{type:'service_account',project_id:raw.project_id,client_email:raw.client_email,private_key:raw.private_key},signingKey};
}
export async function googleToken(account,fetcher=fetch){
 const digest=b64(await crypto.subtle.digest('SHA-256',enc.encode(account.client_email+account.private_key))),cached=tokens.get(digest);if(cached?.expires>Date.now()+60000)return cached.token;
 const {signingKey}=await validate(account),now=Math.floor(Date.now()/1000),head=b64(enc.encode(JSON.stringify({alg:'RS256',typ:'JWT'}))),body=b64(enc.encode(JSON.stringify({iss:account.client_email,scope:'https://www.googleapis.com/auth/cloud-platform',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}))),unsigned=head+'.'+body;
 const signature=b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',signingKey,enc.encode(unsigned)));
 const r=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature}),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw error('Google 身份验证失败，请检查 JSON 密钥是否被撤销、账号是否有效',422);const j=await r.json();if(typeof j.access_token!=='string')throw error('Google 未返回有效令牌',502);
 if(tokens.size>=64)tokens.delete(tokens.keys().next().value);tokens.set(digest,{token:j.access_token,expires:Date.now()+Math.min(+j.expires_in||3600,3600)*1000});return j.access_token;
}
async function read(req,max=2100000){if(+(req.headers.get('content-length')||0)>max)throw error('请求过大',413);const reader=req.body?.getReader();if(!reader)throw error('请求为空');let n=0,chunks=[];try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>max){await reader.cancel();throw error('请求过大',413)}chunks.push(value)}}finally{reader.releaseLock()}const all=new Uint8Array(n);let at=0;for(const c of chunks){all.set(c,at);at+=c.length}try{return JSON.parse(dec.decode(all))}catch{throw error('JSON 格式不正确')}}
const meta=s=>({ready:true,project:s.account.project_id,account:s.account.client_email,location:s.location,models:s.models||[]});
const googleError=s=>({400:'Google 拒绝请求，请检查模型或参数',401:'Google 认证失效，请重新导入 JSON',403:'Google 权限或结算未开通',404:'该模型在所选地区不可用或账号无权使用',429:'Google 配额不足或请求过多'}[s]||'Google 服务暂时不可用');
function part(p){if(typeof p.text==='string')return {text:p.text};const d=p.inlineData;if(d&&/^image\/[\w.+-]+$/.test(d.mimeType)&&typeof d.data==='string'&&/^[A-Za-z0-9+/=\r\n]+$/.test(d.data))return {inlineData:{mimeType:d.mimeType,data:d.data}};throw error('不支持的消息内容')}
export async function handle(req,env,fetcher=fetch){
 const origin=req.headers.get('Origin');if(origin&&origin!==ORIGIN)return json({error:{message:'不允许的网站来源'}},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Max-Age':'600'}});
 const path=new URL(req.url).pathname;if(path==='/')return new Response('小手机 Vertex 认证服务',{headers:{'Content-Type':'text/plain; charset=utf-8'}});
 try{
 const ticket=req.headers.get('Authorization')?.replace(/^Bearer /,'');
 if(path==='/v1/config'&&req.method==='POST'){
  const input=await read(req,65536);let s=input.credentials?{account:(await validate(input.credentials)).account}:await open(ticket||'',env);
  s.location=input.location||s.location||'global';if(!locationOK(s.location))throw error('地区格式无效');
  s.models=Array.isArray(input.models)?[...new Set(input.models)]:s.models||[];if(s.models.length>100||s.models.some(m=>!/^gemini-[a-zA-Z0-9_.-]+$/.test(m)))throw error('模型 ID 格式不正确');
  await googleToken(s.account,fetcher);return json({...meta(s),ticket:await seal(s,env)});
 }
 if(!ticket)throw error('请先导入并验证 JSON',401);const s=await open(ticket,env);
 if(path==='/v1/config'&&req.method==='GET')return json(meta(s));
 if(path==='/v1/models'&&req.method==='GET'){
  const token=await googleToken(s.account,fetcher),ids=new Set(s.models||[]);let page='';
  for(let n=0;n<10;n++){
   const url='https://aiplatform.googleapis.com/v1beta1/publishers/google/models?pageSize=100&listAllVersions=true'+(page?'&pageToken='+encodeURIComponent(page):'');
   const r=await fetcher(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});if(!r.ok)throw error(googleError(r.status)+'；可手动填写模型 ID',r.status);
   const j=await r.json();for(const m of j.publisherModels||[]){const id=(m.name||'').split('/').at(-1);if(/^gemini-[a-zA-Z0-9_.-]+$/.test(id))ids.add(id)}page=j.nextPageToken;if(!page)break;
  }
  return json({source:'google-publisher-catalog',data:[...ids].map(id=>({id}))});
 }
 if(path!=='/v1/generate'||req.method!=='POST')throw error('接口不存在',404);
 const input=await read(req);if(!/^gemini-[a-zA-Z0-9_.-]+$/.test(input.model))throw error('请填写有效 Gemini 模型 ID');
 const r=input.request;if(!Array.isArray(r?.contents)||!r.contents.length)throw error('缺少对话内容');
 const payload={contents:r.contents.map(c=>{if(!['user','model'].includes(c.role)||!Array.isArray(c.parts))throw error('消息格式无效');return {role:c.role,parts:c.parts.map(part)}})};
 if(r.systemInstruction)payload.systemInstruction={parts:r.systemInstruction.parts.map(p=>{if(typeof p.text!=='string')throw error('系统提示格式无效');return {text:p.text}})};
 const gc=r.generationConfig||{};if(!Number.isInteger(gc.maxOutputTokens)||gc.maxOutputTokens<1||gc.maxOutputTokens>32768||!Number.isFinite(gc.temperature)||gc.temperature<0||gc.temperature>2)throw error('生成参数无效');payload.generationConfig={maxOutputTokens:gc.maxOutputTokens,temperature:gc.temperature};
 const host=s.location==='global'?'aiplatform.googleapis.com':s.location+'-aiplatform.googleapis.com';const upstream=await fetcher(`https://${host}/v1/projects/${s.account.project_id}/locations/${s.location}/publishers/google/models/${input.model}:${input.stream?'streamGenerateContent?alt=sse':'generateContent'}`,{method:'POST',headers:{Authorization:'Bearer '+await googleToken(s.account,fetcher),'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(120000)});
 if(!upstream.ok){await upstream.body?.cancel();throw error(googleError(upstream.status),upstream.status)}
 return new Response(upstream.body,{headers:{'Content-Type':input.stream?'text/event-stream; charset=utf-8':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin'}});
 }catch(e){return json({error:{message:e.status?e.message:'认证服务暂时不可用，请稍后重试'}},e.status||502)}
}
// Cloudflare passes ExecutionContext as its third argument; it is not a fetch function.
export default {fetch(request,env,_ctx){return handle(request,env)}};
