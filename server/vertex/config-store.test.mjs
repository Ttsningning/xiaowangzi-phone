import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createConfigStore,validateAccount} from './config-store.mjs';
import {createBridge} from './server.mjs';
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{format:'pem',type:'pkcs8'},publicKeyEncoding:{format:'pem',type:'spki'}});
const account={type:'service_account',project_id:'test-project',client_email:'phone@test-project.iam.gserviceaccount.com',private_key:privateKey,token_uri:'https://evil.example/token'};
const env={VERTEX_MODELS:'gemini-test'};
const goodAuth=()=>({getAccessToken:async()=>({token:'short-lived-test-token'})});
test('validates expected account fields and drops externally supplied OAuth URL',()=>{const c=validateAccount(account);assert.ok(!('token_uri' in c));assert.throws(()=>validateAccount({...account,type:'external_account'}));assert.throws(()=>validateAccount({...account,private_key:'bad'}))});
test('bootstrap, auth-before-save, restart, atomic failure and credential snapshot isolation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vx-store-'));const e={...env,VERTEX_CONFIG_FILE:join(dir,'account.json')};let rejectAuth=false;
 try{
 const store=await createConfigStore(e,{authFactory:()=>({getAccessToken:async()=>{if(rejectAuth)throw Error('sensitive-upstream-error');return {token:'token'}}})});
 assert.equal(store.snapshot().ready,false);await store.save({credentials:account,location:'global',models:['gemini-test']});
 assert.equal((await stat(e.VERTEX_CONFIG_FILE)).mode&0o777,0o600);const disk=await readFile(e.VERTEX_CONFIG_FILE,'utf8');assert.ok(!disk.includes('evil.example'));
 assert.ok(!JSON.stringify(store.snapshot()).includes('PRIVATE KEY'));assert.equal(store.snapshot().account,account.client_email);
 const snapshot=store.capture();rejectAuth=true;await assert.rejects(store.save({credentials:{...account,project_id:'new-project'},location:'us-central1',models:['gemini-next']}),/身份验证失败/);
 assert.equal(await readFile(e.VERTEX_CONFIG_FILE,'utf8'),disk);assert.equal(store.snapshot().project,'test-project');assert.equal(snapshot.project,'test-project');
 const reopened=await createConfigStore(e,{authFactory:goodAuth});assert.equal(reopened.snapshot().location,'global');assert.equal(await reopened.capture().getToken(),'short-lived-test-token');
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('config write needs separate admin key; responses never reveal JSON or access tokens',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vx-api-'));const e={...env,VERTEX_CONFIG_FILE:join(dir,'account.json')};const store=await createConfigStore(e,{authFactory:goodAuth});
 const config={project:'pending-project',location:'global',models:[],token:'b'.repeat(40),adminToken:'a'.repeat(40),origins:['https://phone.example']};let calls=0;
 const server=createBridge(config,{store,fetcher:async(url)=>{calls++;assert.ok(url.includes('/locations/us-central1/'));return new Response('{}')}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,headers={Origin:config.origins[0],Authorization:'Bearer '+config.token,'Content-Type':'application/json'};
 try{
 let r=await fetch(base+'/v1/config',{headers});assert.equal((await r.json()).ready,false);
 const body=JSON.stringify({credentials:account,location:'us-central1',models:['gemini-test']});
 r=await fetch(base+'/v1/config',{method:'POST',headers,body});assert.equal(r.status,403);
 r=await fetch(base+'/v1/config',{method:'POST',headers:{...headers,'X-Vertex-Admin-Token':config.adminToken},body});assert.equal(r.status,200);const raw=await r.text();assert.ok(!raw.includes('PRIVATE KEY')&&!raw.includes('short-lived-test-token'));assert.equal(JSON.parse(raw).location,'us-central1');
 r=await fetch(base+'/v1/models',{headers});assert.equal((await r.json()).data[0].id,'gemini-test');
 r=await fetch(base+'/v1/generate',{method:'POST',headers,body:JSON.stringify({model:'gemini-test',request:{contents:[{role:'user',parts:[{text:'hello'}]}],generationConfig:{temperature:.1,maxOutputTokens:10}}})});assert.equal(r.status,200);assert.equal(calls,1);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
});
