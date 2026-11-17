/* Native-looking Vertex setup. The service address is bundled, not a user setting. */
const VERTEX_NATIVE_BASE='https://xiaowangzi-vertex-auth.gtt137233896.chatgpt.site/v1';
let vertexConfigMetadata=null,vertexConfigBusy=false;
const VERTEX_REGIONS=['global','us-central1','us-east4','us-west1','europe-west1','europe-west4','asia-east1','asia-northeast1','asia-southeast1'];
function vertexConfigMount(){
 if($('#vertexConfigPanel'))return;const p=document.createElement('div');p.id='vertexConfigPanel';p.className='card glass';p.hidden=true;
 p.innerHTML=`<h3>Google Vertex AI 配置</h3><p class="hint">完整版本 · Service Account</p><p id="vertexAccountStatus" class="hint" role="status">导入 JSON 后即可验证账号并拉取模型，无需填写后台地址。</p>
 <div class="field"><label for="vertexJson">Service Account JSON 内容</label><textarea id="vertexJson" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="粘贴 JSON，或点击导入文件" style="min-height:110px"></textarea></div>
 <div class="btns"><button type="button" class="btn" id="vertexImportJson">导入 JSON 文件</button><button type="button" class="btn" id="vertexValidateJson">检查 JSON 格式</button></div><input type="file" id="vertexJsonFile" accept=".json,application/json" hidden>
 <div class="field"><label for="vertexRegion">地区</label><select id="vertexRegion">${VERTEX_REGIONS.map(v=>`<option value="${v}">${v}</option>`).join('')}<option value="custom">其他地区（手填）</option></select><input id="vertexCustomRegion" placeholder="如 europe-west9" hidden autocapitalize="none"></div>
 <div class="btns"><button type="button" class="btn" id="vertexSaveConfig">验证 JSON 并保存</button><button type="button" class="btn" id="vertexLoadConfig">读取已保存账号</button><button type="button" class="btn" id="vertexTestConfig">发送测试消息</button></div>
 <p class="hint">项目和账号从 JSON 自动读取。验证时由小手机内置认证服务处理私钥，只在本设备保存加密凭据，不进入备份。更改地区后请点保存；已有账号无需再次粘贴 JSON。模型目录不保证账号或所选地区具备调用权限，测试消息会实际调用 Google 并可能收费。</p>`;
 $('#vertexHelp').after(p);$('#vertexImportJson').onclick=()=>$('#vertexJsonFile').click();$('#vertexJsonFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>65536)throw Error('JSON 文件超过64KB');$('#vertexJson').value=await f.text();vertexValidateLocal()}catch(err){vertexConfigStatus(err.message)}finally{e.target.value=''}};
 $('#vertexValidateJson').onclick=()=>{try{vertexValidateLocal()}catch(e){vertexConfigStatus(e.message)}};
 $('#vertexRegion').onchange=()=>{$('#vertexCustomRegion').hidden=$('#vertexRegion').value!=='custom';vertexConfigStatus('地区尚未保存，请点击「验证 JSON 并保存」。')};
 $('#vertexSaveConfig').onclick=vertexSaveConfig;$('#vertexLoadConfig').onclick=vertexLoadConfig;$('#vertexTestConfig').onclick=vertexTestConfig;
}
function vertexConfigStatus(t){$('#vertexAccountStatus').textContent=t}
function vertexValidateLocal(){let j;try{j=JSON.parse($('#vertexJson').value)}catch{throw Error('JSON 格式不正确，请导入完整文件')}
 if(j.type!=='service_account'||!j.project_id||!j.client_email||typeof j.private_key!=='string'||!j.private_key.includes('PRIVATE KEY'))throw Error('JSON 需要包含 service_account、project_id、client_email 和 private_key');vertexConfigStatus('格式正确 · 项目：'+j.project_id+' · 账号：'+j.client_email+'。尚未验证 Google 身份。');return j}
function vertexConfigConnection(){if(!S.settings.apiKey?.startsWith('vx1.'))throw Error('请先导入 JSON 并验证保存');return {base:VERTEX_NATIVE_BASE,key:S.settings.apiKey}}
function vertexConfigRender(){vertexConfigMount();const active=S.settings.apiFormat==='vertex';$('#vertexConfigPanel').hidden=!active;
 for(const field of ['baseUrl','apiKey'])$('[data-s="'+field+'"]').closest('.field').hidden=active;
 if(active&&!S.settings.apiKey?.startsWith('vx1.'))vertexConfigStatus('导入 JSON 后即可验证账号并拉取模型，无需填写后台地址。');
}
async function vertexConfigFetch(c,method='GET',payload){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);try{
 const r=await fetch(VERTEX_NATIVE_BASE+'/config',{method,signal:controller.signal,headers:{...(c?.key?{Authorization:'Bearer '+c.key}:{}),...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});let j;try{j=await r.json()}catch{throw Error('认证服务暂时不可用')};if(!r.ok)throw Error(j.error?.message||'认证失败 '+r.status);return j;
 }catch(e){if(e.name==='AbortError')throw Error('认证超时，请检查网络后重试');throw e}finally{clearTimeout(timer)}}
function vertexConfigShow(meta){vertexConfigMetadata=meta;const region=meta.location||'global';$('#vertexRegion').value=VERTEX_REGIONS.includes(region)?region:'custom';$('#vertexCustomRegion').hidden=VERTEX_REGIONS.includes(region);$('#vertexCustomRegion').value=region;vertexConfigStatus(`已保存 · 项目：${meta.project} · 账号：${meta.account} · 地区：${region}。可拉取模型或发送测试消息。`)}
async function vertexConfigAction(fn){if(vertexConfigBusy)return;vertexConfigBusy=true;for(const id of ['vertexSaveConfig','vertexLoadConfig','vertexTestConfig'])$('#'+id).disabled=true;try{await fn()}catch(e){vertexConfigStatus(e.message);toast(e.message,6000)}finally{vertexConfigBusy=false;for(const id of ['vertexSaveConfig','vertexLoadConfig','vertexTestConfig'])$('#'+id).disabled=false}}
function vertexLoadConfig(){return vertexConfigAction(async()=>vertexConfigShow(await vertexConfigFetch(vertexConfigConnection())))}
function vertexSaveConfig(){return vertexConfigAction(async()=>{
 const text=$('#vertexJson').value.trim(),credentials=text?vertexValidateLocal():undefined,c=credentials?null:vertexConfigConnection(),location=$('#vertexRegion').value==='custom'?$('#vertexCustomRegion').value.trim():$('#vertexRegion').value,model=$('[data-s="model"]').value.trim();
 vertexConfigStatus('正在验证 Google 身份…');const meta=await vertexConfigFetch(c,'POST',{...(credentials?{credentials}:{}),location,models:/^gemini-[a-zA-Z0-9_.-]+$/.test(model)?[model]:[]});
 if(typeof meta.ticket!=='string'||!meta.ticket.startsWith('vx1.'))throw Error('认证服务没有返回有效凭据');
 S.settings.baseUrl=VERTEX_NATIVE_BASE;S.settings.apiKey=meta.ticket;await save('settings');$('[data-s="baseUrl"]').value=VERTEX_NATIVE_BASE;$('[data-s="apiKey"]').value=meta.ticket;
 if($('#vertexJson').value.trim()===text)$('#vertexJson').value='';vertexConfigShow(meta);toast('账号已验证保存，可以拉取模型啦');
})}
function vertexTestConfig(){return vertexConfigAction(async()=>{const c=vertexConfigConnection(),model=$('[data-s="model"]').value.trim();if(!/^gemini-/.test(model))throw Error('请先选择或填写 Gemini 模型');vertexConfigStatus('正在测试模型…');const result=await vertexCall([{role:'user',content:'只回复：连接成功'}],{stream:false},{...c,model},.1,256);vertexConfigStatus('模型测试成功：'+result.slice(0,100))})}
const vertexConfigOriginalRender=vertexRender;vertexRender=function(){vertexConfigOriginalRender();vertexConfigRender()};vertexConfigMount();
