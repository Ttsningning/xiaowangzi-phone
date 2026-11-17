/* Service-account setup UI. Private JSON and the admin key never enter S/DB/backups. */
let vertexConfigMetadata=null,vertexConfigScope='',vertexConfigBusy=false;
const VERTEX_REGIONS=['global','us-central1','us-east4','us-west1','europe-west1','europe-west4','asia-east1','asia-northeast1','asia-southeast1'];
function vertexConfigMount(){
 if($('#vertexConfigPanel'))return;
 const panel=document.createElement('div');panel.id='vertexConfigPanel';panel.className='card glass';panel.hidden=true;
 panel.innerHTML=`<h3>Google Vertex AI 配置</h3><p class="hint">完整版本 · Service Account</p><p id="vertexAccountStatus" class="hint" role="status">尚未读取后台配置。首次使用请先填写下方的后台地址和访问密钥。</p>
 <div class="field"><label for="vertexJson">Service Account JSON 内容</label><textarea id="vertexJson" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="粘贴 JSON，或点击下方导入文件" style="min-height:110px"></textarea></div>
 <div class="btns"><button type="button" class="btn" id="vertexImportJson">导入 JSON 文件</button><button type="button" class="btn" id="vertexValidateJson">检查 JSON 格式</button></div><input type="file" id="vertexJsonFile" accept=".json,application/json" hidden>
 <div class="field"><label for="vertexRegion">地区</label><select id="vertexRegion">${VERTEX_REGIONS.map(v=>`<option value="${v}">${v}</option>`).join('')}<option value="custom">其他地区（手填）</option></select><input id="vertexCustomRegion" placeholder="如 europe-west9" hidden autocapitalize="none"></div>
 <p class="hint">模型在下方选择或手填。保存时会把当前模型加入后台允许列表；列表不代表 Google 已验证其可用性。</p>
 <div class="field"><label for="vertexAdminKey">配置管理密钥（仅保存配置时使用）</label><input id="vertexAdminKey" type="password" autocomplete="off" placeholder="与日常访问密钥不同，保存后清空"></div>
 <p class="hint" id="vertexSaveDestination"></p><div class="btns"><button type="button" class="btn" id="vertexLoadConfig">连接 · 读取已保存配置</button><button type="button" class="btn" id="vertexSaveConfig">验证身份并保存</button><button type="button" class="btn" id="vertexTestConfig">发送测试消息</button></div>
 <p class="hint">保存会将 JSON 发送到你填写的后台，由后台保管并刷新令牌。测试消息会实际调用 Google，可能产生少量费用。地区与账号对使用同一后台的角色共同生效。</p>`;
 $('#vertexHelp').after(panel);
 $('#vertexImportJson').onclick=()=>$('#vertexJsonFile').click();
 $('#vertexJsonFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>65536)throw Error('JSON 文件超过 64KB');$('#vertexJson').value=await f.text();vertexValidateLocal();}catch(err){vertexConfigStatus(err.message)}finally{e.target.value=''}};
 $('#vertexValidateJson').onclick=()=>{try{vertexValidateLocal()}catch(e){vertexConfigStatus(e.message)}};
 $('#vertexRegion').onchange=()=>{$('#vertexCustomRegion').hidden=$('#vertexRegion').value!=='custom';vertexConfigStatus('地区尚未保存，点击「验证身份并保存」后生效。')};
 $('#vertexLoadConfig').onclick=()=>vertexLoadConfig();$('#vertexSaveConfig').onclick=()=>vertexSaveConfig();$('#vertexTestConfig').onclick=()=>vertexTestConfig();
 for(const field of ['baseUrl','apiKey'])$('[data-s="'+field+'"]').addEventListener('change',()=>{vertexConfigMetadata=null;vertexConfigScope='';vertexConfigStatus('连接配置已改变，请重新读取后台配置。');vertexConfigRender()});
}
function vertexConfigStatus(text){$('#vertexAccountStatus').textContent=text}
function vertexValidateLocal(){
 let json;try{json=JSON.parse($('#vertexJson').value)}catch{throw Error('JSON 格式不正确，请导入完整的服务账号文件')}
 if(json.type!=='service_account'||!json.project_id||!json.client_email||typeof json.private_key!=='string'||!json.private_key.includes('PRIVATE KEY'))throw Error('需要包含 project_id、client_email、private_key 的 service_account JSON');
 vertexConfigStatus('JSON 格式正确 · 项目：'+json.project_id+' · 账号：'+json.client_email+'。尚未验证 Google 身份或保存。');return json;
}
function vertexConfigConnection(){
 const base=$('[data-s="baseUrl"]').value.trim().replace(/\/+$/,''),key=$('[data-s="apiKey"]').value.trim();
 if(!base||!key)throw Error('请先填写下方的后台地址与访问密钥');let u;try{u=new URL(base)}catch{throw Error('后台地址不是有效网址')}
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname.replace(/\/+$/,'')!=='/v1')throw Error('后台地址需为 HTTPS，以 /v1 结尾，不含用户名、参数或片段');
 return {base,key,scope:JSON.stringify([base,key])};
}
function vertexConfigRender(){
 vertexConfigMount();const active=S.settings.apiFormat==='vertex';$('#vertexConfigPanel').hidden=!active;
 const endpoint=$('[data-s="baseUrl"]'),key=$('[data-s="apiKey"]');endpoint.closest('.field').querySelector('label').textContent=active?'后台地址（首次部署后填写）':'API 地址';key.closest('.field').querySelector('label').textContent=active?'后台访问密钥':'API 密钥';
 endpoint.closest('.field').querySelector('.hint').textContent=active?'填写你自己的后台 HTTPS 地址，以 /v1 结尾；不是 Google 官方网址。':'填 OpenAI 兼容格式的地址，一般以 /v1 结尾。';
 endpoint.placeholder=active?'https://你的后台域名/v1':'https://api.deepseek.com/v1';
 $('#vertexSaveDestination').textContent='保存目标：'+(endpoint.value.trim()||'请先填写后台地址')+'。管理密钥只用于这一次保存，不会写入备份。';
}
function vertexConfigShow(meta,connection){
 vertexConfigMetadata=meta;vertexConfigScope=connection.scope;
 const location=meta.location||'global';$('#vertexRegion').value=VERTEX_REGIONS.includes(location)?location:'custom';$('#vertexCustomRegion').hidden=VERTEX_REGIONS.includes(location);$('#vertexCustomRegion').value=location;
 vertexConfigStatus(meta.ready?`已保存 · 项目：${meta.project} · 账号：${meta.account} · 地区：${location}。模型可用性请发送测试消息验证。`:'后台已连接，尚未保存服务账号，请导入 JSON。');
}
async function vertexConfigFetch(connection,method='GET',payload,admin){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{const r=await fetch(connection.base+'/config',{method,signal:controller.signal,headers:{Authorization:'Bearer '+connection.key,...(payload?{'Content-Type':'application/json','X-Vertex-Admin-Token':admin}:{})},...(payload?{body:JSON.stringify(payload)}:{})});let json;try{json=await r.json()}catch{throw Error('后台返回格式不正确，请检查地址和后台版本')}
 if(!r.ok)throw Error(r.status===404?'后台尚不支持网页配置管理，请先升级 VPS 后台':json.error?.message||'后台请求失败 '+r.status);return json;}catch(e){if(e.name==='AbortError')throw Error('后台请求超时，请检查连接；不要重复提交，请先读取已保存配置');throw e}finally{clearTimeout(timer)}
}
async function vertexConfigAction(fn){if(vertexConfigBusy)return;vertexConfigBusy=true;for(const id of ['vertexLoadConfig','vertexSaveConfig','vertexTestConfig'])$('#'+id).disabled=true;
 try{await fn()}catch(e){vertexConfigStatus(e.message);toast(e.message,6000)}finally{vertexConfigBusy=false;for(const id of ['vertexLoadConfig','vertexSaveConfig','vertexTestConfig'])$('#'+id).disabled=false}}
function vertexLoadConfig(){return vertexConfigAction(async()=>{const c=vertexConfigConnection();vertexConfigStatus('正在读取后台配置…');const meta=await vertexConfigFetch(c);if(c.scope!==vertexConfigConnection().scope)return;vertexConfigShow(meta,c)})}
function vertexSaveConfig(){return vertexConfigAction(async()=>{
 const c=vertexConfigConnection(),admin=$('#vertexAdminKey').value.trim();if(!admin)throw Error('保存配置需要填写配置管理密钥');
 try{
  const location=$('#vertexRegion').value==='custom'?$('#vertexCustomRegion').value.trim():$('#vertexRegion').value;
  const jsonText=$('#vertexJson').value.trim(),credentials=jsonText?vertexValidateLocal():undefined;
  if(!credentials&&!(vertexConfigScope===c.scope&&vertexConfigMetadata?.ready))throw Error('请先导入 JSON，或读取后台已有账号');
  const model=$('[data-s="model"]').value.trim();if(!/^gemini-[a-zA-Z0-9_.-]+$/.test(model))throw Error('请先在下方填写 Gemini 模型 ID');
  const models=[...new Set([...(vertexConfigScope===c.scope?vertexConfigMetadata?.models||[]:[]),model])];
  vertexConfigStatus('正在验证 Google 身份并保存…');const meta=await vertexConfigFetch(c,'POST',{...(credentials?{credentials}:{}),location,models},admin);
  if($('#vertexJson').value.trim()===jsonText)$('#vertexJson').value='';if(c.scope!==vertexConfigConnection().scope)return;vertexConfigShow(meta,c);toast('身份验证成功，配置已保存；请测试模型连接');
 }finally{$('#vertexAdminKey').value=''}
})}
function vertexTestConfig(){return vertexConfigAction(async()=>{
 const c=vertexConfigConnection(),model=$('[data-s="model"]').value.trim();if(!model)throw Error('请先填写模型');
 vertexConfigStatus('正在发送测试消息…');const result=await vertexCall([{role:'user',content:'只回复：连接成功'}],{stream:false},{base:c.base,key:c.key,model},.1,256);
 if(c.scope===vertexConfigConnection().scope)vertexConfigStatus('模型测试成功：'+result.slice(0,100));
})}
const vertexConfigOriginalRender=vertexRender;
vertexRender=function(){vertexConfigOriginalRender();vertexConfigRender()};
vertexConfigMount();
