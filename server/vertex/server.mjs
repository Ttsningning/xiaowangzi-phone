import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createConfigStore} from './config-store.mjs';

export function configFromEnv(env,credentials,{setup=false}={}){
 if(!setup&&(credentials?.type!=='service_account'||!credentials.client_email||!credentials.private_key))throw Error('需要 service_account 类型的 JSON 文件');
 const project=env.GOOGLE_CLOUD_PROJECT||credentials?.project_id||(setup?'pending-project':''),location=env.VERTEX_LOCATION||'global';
 if(!/^[a-z][a-z0-9-]{4,62}$/.test(project||'')||!(/^[a-z]+(?:-[a-z0-9]+)*\d$/.test(location)||location==='global'))throw Error('项目或区域格式无效');
 const models=(env.VERTEX_MODELS||'').split(',').map(x=>x.trim()).filter(Boolean);
 if((!setup&&!models.length)||models.some(x=>!/^gemini-[a-zA-Z0-9_.-]+$/.test(x)))throw Error('VERTEX_MODELS 必须列出你允许调用的 Gemini 模型 ID');
 const token=env.BRIDGE_TOKEN||'';if(token.length<32)throw Error('BRIDGE_TOKEN 至少需要 32 个字符');
 const origins=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
 if(!origins.length||origins.some(x=>{try{return new URL(x).origin!==x||!x.startsWith('https://')}catch{return true}}))throw Error('ALLOWED_ORIGINS 需要明确的 HTTPS 网站来源');
 return {project,location,models,token,origins};
}
function safeEqual(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
function fail(res,status,message){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:{message}}))}
export function createBridge(config,{getToken,fetcher=fetch,store}={}){
 const active=new Set();
 return http.createServer(async(req,res)=>{
  const origin=req.headers.origin;res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(origin&&!config.origins.includes(origin))return fail(res,403,'不允许的网站来源');
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, X-Vertex-Admin-Token'});return res.end()}
  if(!safeEqual(req.headers.authorization||'','Bearer '+config.token))return fail(res,401,'转发访问密钥无效');
  if(req.url==='/v1/config'){
   if(!store)return fail(res,404,'服务器尚未启用网页配置管理，请升级后台');
   if(req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(store.snapshot()))}
   if(req.method!=='POST')return fail(res,405,'请求方法不支持');
   if(!config.adminToken||!safeEqual(req.headers['x-vertex-admin-token']||'',config.adminToken))return fail(res,403,'需要正确的配置管理密钥');
   try{const input=await readJSON(req,65536);if(input.models!==undefined&&!Array.isArray(input.models))return fail(res,400,'模型列表格式无效');const metadata=await store.save(input);res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(metadata))}catch(e){return fail(res,e.status||400,e.status?e.message:'配置验证或保存失败，旧配置已保留；请检查 JSON、地区、模型和服务器文件权限')}
  }
  const selected=store?store.capture():{...config,getToken};
  if(req.method==='GET'&&req.url==='/v1/models'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({object:'list',source:'server-allowlist',data:selected.models.map(id=>({id,object:'model',owned_by:'google'}))}))}
  if(req.method!=='POST'||req.url!=='/v1/generate')return fail(res,404,'接口不存在');
  if(store&&!selected.ready)return fail(res,503,'请先在 Vertex 配置中导入并保存服务账号 JSON');
  if(active.size>=4)return fail(res,429,'请求较多，请稍后再试');
  const controller=new AbortController();active.add(controller);const timer=setTimeout(()=>controller.abort(),120000);
  res.on('close',()=>{if(!res.writableEnded)controller.abort()});
  try{
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024){fail(res,413,'请求超过 2MB');return}chunks.push(chunk)}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return fail(res,400,'请求不是有效 JSON')}
   if(!selected.models.includes(body.model))return fail(res,400,'模型未列入服务器允许列表');
   const r=body.request;if(!r||!Array.isArray(r.contents)||!r.contents.length)return fail(res,400,'缺少对话内容');
   // Only generation fields are forwarded: clients cannot choose a host, project,
   // credential, billable cache resource, tools or arbitrary API method.
   const contents=r.contents.map(c=>{if(!['user','model'].includes(c.role)||!Array.isArray(c.parts)||!c.parts.length)throw Error('invalid');return {role:c.role,parts:c.parts.map(part)}});
   const payload={contents};
   if(r.systemInstruction){if(!Array.isArray(r.systemInstruction.parts))throw Error('invalid');payload.systemInstruction={parts:r.systemInstruction.parts.map(p=>{if(typeof p.text!=='string')throw Error('invalid');return {text:p.text}})}}
   const gc=r.generationConfig||{},max=Number(gc.maxOutputTokens),temp=Number(gc.temperature);
   if(!Number.isInteger(max)||max<1||max>32768||!Number.isFinite(temp)||temp<0||temp>2)return fail(res,400,'生成参数无效，输出上限为 32768 tokens');
   payload.generationConfig={temperature:temp,maxOutputTokens:max};
   const host=selected.location==='global'?'aiplatform.googleapis.com':selected.location+'-aiplatform.googleapis.com';
   const method=body.stream===true?'streamGenerateContent?alt=sse':'generateContent';
   const upstream=await fetcher(`https://${host}/v1/projects/${selected.project}/locations/${selected.location}/publishers/google/models/${body.model}:${method}`,{method:'POST',headers:{Authorization:'Bearer '+await selected.getToken(),'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
   if(!upstream.ok){await upstream.body?.cancel();return fail(res,upstream.status,({400:'Google 拒绝请求，请检查模型、区域或参数',401:'Google 认证失败，请检查服务账号',403:'Google 权限或结算未开通',404:'该区域没有此模型，请检查模型 ID',429:'Google 配额不足或请求过多'}[upstream.status]||'Google 服务暂时不可用'))}
   res.writeHead(200,{'Content-Type':body.stream===true?'text/event-stream; charset=utf-8':'application/json; charset=utf-8','X-Accel-Buffering':'no'});
   for await(const chunk of upstream.body){if(controller.signal.aborted)break;res.write(chunk)}res.end();
  }catch(e){if(res.headersSent)res.destroy();else fail(res,controller.signal.aborted?504:e.message==='invalid'?400:502,controller.signal.aborted?'Vertex 请求超时，请稍后重试':e.message==='invalid'?'消息格式无效':'Vertex 连接失败，请检查服务器配置')}
  finally{clearTimeout(timer);active.delete(controller)}
 });
}
function part(p){if(typeof p.text==='string')return {text:p.text};const d=p.inlineData;if(d&&/^image\/[\w.+-]+$/.test(d.mimeType)&&typeof d.data==='string'&&/^[A-Za-z0-9+/=\r\n]+$/.test(d.data))return {inlineData:{mimeType:d.mimeType,data:d.data}};throw Error('invalid')}
async function readJSON(req,limit){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw Object.assign(Error('配置超过大小限制'),{status:413});chunks.push(chunk)}return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
export async function start(env=process.env){
 const store=await createConfigStore(env),state=store.snapshot();
 const config=configFromEnv(env,{type:'service_account',project_id:state.project||'pending-project',client_email:'configured',private_key:'configured'},{setup:true});
 const adminToken=env.VERTEX_ADMIN_TOKEN||'';
 if(adminToken.length<32||adminToken===config.token)throw Error('需要独立且至少32字符的 VERTEX_ADMIN_TOKEN');
 config.adminToken=adminToken;
 const server=createBridge(config,{store});
 const host=env.BRIDGE_HOST||'127.0.0.1',port=Number(env.PORT||8787);server.listen(port,host,()=>console.log('Vertex bridge listening on '+host+':'+port));return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)start().catch(()=>{console.error('Vertex bridge startup failed: check credential file, environment and permissions.');process.exitCode=1});
