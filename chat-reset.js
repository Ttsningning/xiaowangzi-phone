/* Start a character's private conversation again, with recoverable local archives. */
DEFAULTS.chatResets={};
const chatResetLocks=new Set();
function chatResetBlocked(T){
  return chatResetLocks.has(T.id)||busy||summarizing||peekBusy||illBusy||momentBusy||!!$('#dNew')?.disabled||
    (typeof ksBusy!=='undefined'&&ksBusy.size>0)||(typeof photoBusy!=='undefined'&&photoBusy.size>0);
}
function chatResetSnapshot(T){const cid=T.members[0];return structuredClone({at:Date.now(),thread:T,book:S.keepsakes?.books[cid]||{cards:[]},diaries:S.diaries[cid]||[],peek:S.peek[cid]||null,foxHistory:(S.pet?.history||[]).filter(m=>m.identity===cid)})}
async function chatResetWrite(T,snapshot,archives){
  const cid=T.members[0],next=structuredClone(snapshot.thread);next.sessionId=uid();
  const keepsakes=structuredClone(S.keepsakes||{books:{}});keepsakes.books[cid]=structuredClone(snapshot.book);
  const diaries={...S.diaries,[cid]:structuredClone(snapshot.diaries)},peek={...S.peek};
  if(snapshot.peek)peek[cid]=structuredClone(snapshot.peek);else delete peek[cid];
  const pet=S.pet?{...S.pet,history:[...(S.pet.history||[]).filter(m=>m.identity!==cid),...(snapshot.foxHistory||[])]}:null;
  const resets={...(S.chatResets||{}),[cid]:archives};
  const threads=S.threads.map(t=>{const {msgs,mem,...r}=t===T?next:t;return r});
  // All records commit together; quota/storage failure must leave the original conversation intact.
  await new Promise((resolve,reject)=>{const tx=DB.db.transaction('kv','readwrite'),kv=tx.objectStore('kv');
    for(const [key,value] of Object.entries({threads,['msg:'+T.id]:next.msgs,['mem:'+T.id]:next.mem,keepsakes,diaries,peek,chatResets:resets,...(pet?{pet}:{})}))kv.put(value,key);
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('保存中断'));tx.onerror=()=>reject(tx.error||Error('保存失败'));
  });
  for(const key of Object.keys(T))if(!(key in next))delete T[key];Object.assign(T,next);S.keepsakes=keepsakes;S.diaries=diaries;S.peek=peek;S.chatResets=resets;if(pet)S.pet=pet;
  if(typeof fox!=='undefined'&&S.pet?.charId===cid){fox.epoch++;fox.talking=false;foxStopAudio();if($('#foxBubble'))$('#foxBubble').hidden=true}
  if(pending?.T===T)pending=null;replyDrafts.delete(T.id);
  if(diaryCaught?.cid===cid)diaryCaught=null;if(peekCaught?.cid===cid)peekCaught=null;
  syncUnread();updateBadges();renderHome();
  if(curT()===T){renderChat();renderStory()}
}
async function resetCharacterChat(cid,restore=false){
  const c=charById(cid);if(!c)return false;const T=threadOf(cid);
  if(chatResetBlocked(T)){toast('等当前回复或整理完成，再重置聊天吧');return false}
  const archives=structuredClone(S.chatResets?.[cid]||[]),current=chatResetSnapshot(T);
  let next;
  if(restore){if(!archives.length){toast('还没有重置前的存档');return false}next=archives.pop()}
  else{
    const now=Date.now();next={thread:{...structuredClone(T),msgs:[],mem:{summary:'',upTo:0},unread:0,nextPro:0,resetAt:now},book:{cards:[]},diaries:[],peek:null,foxHistory:[]};
    const first=macro(c.first_mes||'',T).trim();
    // Insert literal greeting without token parsing or a paid AI request.
    if(first)next.thread.msgs.push({id:uid(),mode:'online',role:'assistant',who:cid,content:first,ts:now});
  }
  archives.push(current);chatResetLocks.add(T.id);
  try{await chatResetWrite(T,next,archives);toast(restore?'已恢复上次会话，当前会话也已存档':c.first_mes?.trim()?'已重置，从开场白重新开始':'已重置；还没有开场白，可以先在角色页填写');return true}
  catch(e){toast('重置没有保存，原聊天保留：'+e.message,5000);return false}
  finally{chatResetLocks.delete(T.id)}
}
async function requestCharacterReset(cid,restore=false){
  const c=charById(cid);if(!c)return;
  const text=restore?'恢复上次会话？当前聊天会先存档，角色设定使用你现在编辑的版本。':`与「${c.name}」重新开始？线上、线下聊天、长期摘要、记忆册、日记和查手机内容将存档并退出当前记忆。旧朋友圈不再自动带入；角色设定、世界书、相册和物品保留。${c.first_mes?.trim()?'使用当前保存的默认开场白。':'当前没有开场白，将打开空白聊天。'}`;
  if(await actionSheet([{label:restore?'恢复上次会话':'存档并重置聊天',danger:!restore}],text)!==0)return;
  if(await resetCharacterChat(cid,restore)){const T=threadOf(cid);S.state.cur=T.id;await save('state');openApp('chat')}
}
$('#charReset').onclick=()=>{readCharForm();requestCharacterReset(editingChar()?.id)};
