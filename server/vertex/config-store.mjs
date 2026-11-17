import {readFile,writeFile,mkdir,rename,unlink,chmod} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createPrivateKey,randomUUID} from 'node:crypto';
import {JWT} from 'google-auth-library';
export const validLocation=v=>v==='global'||/^[a-z]+(?:-[a-z0-9]+)*\d$/.test(v||'');
export function validateAccount(raw){
 if(!raw||raw.type!=='service_account'||!/^[a-z][a-z0-9-]{4,62}$/.test(raw.project_id||'')||!/^[-a-zA-Z0-9_.]+@[-a-zA-Z0-9.]+\.iam\.gserviceaccount\.com$/.test(raw.client_email||''))throw Error('JSON 需要有效的 service_account、project_id 和 client_email');
 if(typeof raw.private_key!=='string'||raw.private_key.length>20000)throw Error('JSON 缺少有效私钥');
 let key;try{key=createPrivateKey(raw.private_key)}catch{throw Error('JSON 私钥不是有效的 PEM 格式')}
 if(key.asymmetricKeyType!=='rsa'||key.asymmetricKeyDetails.modulusLength<2048)throw Error('服务账号需要至少 2048 位 RSA 私钥');
 // Do not trust OAuth URLs or arbitrary credential types from uploaded JSON.
 return {type:'service_account',project_id:raw.project_id,client_email:raw.client_email,private_key:raw.private_key};
}
const defaultAuth=c=>new JWT({email:c.client_email,key:c.private_key,scopes:['https://www.googleapis.com/auth/cloud-platform']});
export async function createConfigStore(env,{authFactory=defaultAuth}={}){
 const file=env.VERTEX_CONFIG_FILE||'/var/lib/xiaowangzi/vertex-config.json';
 let credentials=null,location=env.VERTEX_LOCATION||'global',models=(env.VERTEX_MODELS||'').split(',').map(s=>s.trim()).filter(Boolean),auth=null,busy=false;
 try{const saved=JSON.parse(await readFile(file,'utf8'));credentials=validateAccount(saved.credentials);location=saved.location;models=saved.models;await chmod(file,0o600)}catch(e){if(e.code!=='ENOENT')throw Error('无法读取已保存的 Vertex 配置')}
 if(!credentials&&env.GOOGLE_APPLICATION_CREDENTIALS)credentials=validateAccount(JSON.parse(await readFile(env.GOOGLE_APPLICATION_CREDENTIALS,'utf8')));
 const validate=()=>{if(!validLocation(location)||!Array.isArray(models)||models.length>100||models.some(m=>!/^gemini-[a-zA-Z0-9_.-]+$/.test(m)))throw Error('地区或模型配置无效')};validate();
 if(credentials)auth=authFactory(credentials);
 const snapshot=()=>({ready:!!credentials,project:credentials?.project_id||null,location,models:[...models],account:credentials?.client_email||null});
 async function save(input){
  if(busy)throw Object.assign(Error('配置正在保存，请稍后重试'),{status:409});busy=true;let temp;
  try{
   const nextCred=input.credentials===undefined?credentials:validateAccount(input.credentials),nextLocation=input.location??location;
   const nextModels=input.models===undefined?models:[...new Set(input.models)];
   if(!nextCred)throw Error('请先导入服务账号 JSON');
   if(!validLocation(nextLocation)||!Array.isArray(nextModels)||!nextModels.length||nextModels.length>100||nextModels.some(m=>typeof m!=='string'||!/^gemini-[a-zA-Z0-9_.-]+$/.test(m)))throw Error('请选择有效地区，并填写至少一个 Gemini 模型 ID');
   const nextAuth=authFactory(nextCred);let timer;
   try{const result=await Promise.race([nextAuth.getAccessToken(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),20000)})]);if(!result.token)throw Error('auth')}catch{throw Object.assign(Error('Google 身份验证失败，旧配置已保留；请检查 JSON 密钥是否有效及服务器网络'),{status:422})}finally{clearTimeout(timer)}
   await mkdir(dirname(file),{recursive:true,mode:0o700});temp=file+'.'+randomUUID()+'.tmp';
   await writeFile(temp,JSON.stringify({v:1,credentials:nextCred,location:nextLocation,models:nextModels}),{mode:0o600,flag:'wx'});await rename(temp,file);temp=null;
   // Switch active credentials only after validation and durable write both succeed.
   credentials=nextCred;location=nextLocation;models=nextModels;auth=nextAuth;return snapshot();
  }finally{if(temp)await unlink(temp).catch(()=>{});busy=false}
 }
 return {snapshot,save,capture(){const currentAuth=auth;return {...snapshot(),getToken:async()=>{if(!currentAuth)throw Error('not configured');const result=await currentAuth.getAccessToken();if(!result.token)throw Error('auth');return result.token}}}};
}
