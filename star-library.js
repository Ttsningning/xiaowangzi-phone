/* 星页书房 — local books, outline collaboration and contextual reading. */
DEFAULTS.starLibrary={books:[],active:'',partner:'',mode:'character'};
const starEsc=s=>esc(String(s??''));
const starBook=()=>S.starLibrary.books.find(b=>b.id===S.starLibrary.active);
const starBody=()=>$('#starLibraryBody');
function starSave(){return save('starLibrary')}
function starPartner(){return charById(S.starLibrary.partner)||null}
function starContext(){const c=starPartner();return c?'你正在以小说搭档「'+c.name+'」的身份交流。人物设定：'+[c.description,c.personality,c.scenario].filter(Boolean).join('\n').slice(0,3500):'你是耐心、有创意的独立 AI 小说写作助手。'}
function starOptions(){return '<option value="">独立 AI 写作助手</option>'+S.chars.map(c=>'<option value="'+starEsc(c.id)+'">'+starEsc(c.name)+'</option>').join('')}
function starRender(){
  const root=starBody();if(!root)return;
  const b=starBook(),lib=S.starLibrary;
  if(!b){
    root.innerHTML='<div class="card glass"><h2>✦ 星页书房</h2><p>一起读，一起写，把故事装订成书。</p><div class="btns"><button class="btn pri" data-star="create">一起写 · 新故事</button><button class="btn" data-star="import">一起读 · 导入 TXT</button></div><input id="starFile" type="file" accept=".txt,text/plain" hidden></div>'+
    '<div class="card glass"><h3>我的书架</h3>'+lib.books.map(x=>'<button class="btn" style="display:block;width:100%;margin:8px 0;text-align:left" data-star="open" data-id="'+starEsc(x.id)+'">'+starEsc(x.title)+' · '+(x.chapters||[]).length+' 章</button>').join('')+'<p class="hint">作品只保存在这台小手机里，请定期导出备份。</p></div>';
    return;
  }
  const ch=b.chapters[b.chapter||0]||null;
  root.innerHTML='<div class="card glass"><div class="btns"><button class="btn" data-star="back">‹ 书架</button><button class="btn" data-star="export">导出 TXT</button><button class="btn" data-star="delete">删除作品</button></div><h2>'+starEsc(b.title)+'</h2><div class="field"><label>写作或共读搭档</label><select id="starPartner">'+starOptions()+'</select></div><div class="btns"><button class="btn" data-star="tab" data-tab="outline">一起构思</button><button class="btn" data-star="tab" data-tab="read">一起读</button></div></div>'+
    (b.tab==='read'?starReadHTML(b,ch):starOutlineHTML(b));
  $('#starPartner').value=lib.partner||'';
}
function starOutlineHTML(b){
  return '<div class="card glass"><h3>故事设定与章节大纲</h3><div class="field"><label>世界观、人物、冲突与故事方向</label><textarea id="starNotes" rows="6">'+starEsc(b.notes||'')+'</textarea></div><div class="btns"><button class="btn pri" data-star="brainstorm">和搭档一起构思</button><button class="btn" data-star="chapter">新增章节</button></div><p class="hint">AI 只提供构思建议；确认后才写入大纲。不会覆盖你原有的内容。</p><div class="field"><label>讨论与构思草稿</label><textarea id="starIdeas" rows="6">'+starEsc(b.ideas||'')+'</textarea></div></div>'+
    b.chapters.map((c,i)=>'<div class="card glass"><button class="btn" data-star="edit" data-index="'+i+'">第'+(i+1)+'章 · '+starEsc(c.title)+'</button><small> '+(c.text||'').length+' 字</small><div class="btns"><button class="btn pri" data-star="draft" data-index="'+i+'">AI 起草正文</button><button class="btn" data-star="readChapter" data-index="'+i+'">阅读</button></div></div>').join('');
}
function starReadHTML(b,ch){
  return '<div class="card glass"><h3>一起读</h3><div class="field"><label>章节</label><select id="starChapter">'+b.chapters.map((c,i)=>'<option value="'+i+'" '+(i===(b.chapter||0)?'selected':'')+'>'+starEsc(c.title)+'</option>').join('')+'</select></div><article style="white-space:pre-wrap;line-height:2;padding:12px 4px;user-select:text">'+starEsc(ch?.text||'还没有正文。先回到一起构思，写下第一章吧。')+'</article><button class="btn" data-star="chat">💬 '+(b.chatOpen?'收起讨论':'展开聊天')+'</button></div>'+
    (b.chatOpen?'<div class="card glass"><h3>边读边聊</h3><div style="max-height:240px;overflow:auto">'+(b.discussion||[]).filter(x=>x.chapter===(b.chapter||0)).map(x=>'<p><b>'+starEsc(x.role==='user'?'我':'搭档')+'：</b>'+starEsc(x.text)+'</p>').join('')+'</div><textarea id="starQuestion" rows="3" placeholder="聊聊这一章吧…"></textarea><button class="btn pri" data-star="ask">发送讨论</button></div>':'');
}
async function starAI(messages,max_tokens=1600){
  const c=starPartner();
  return clean(await callAPI(messages,{...(c?{char:c}:{}),max_tokens,temperature:.8}));
}
async function starAction(action,el){
  const lib=S.starLibrary,b=starBook();
  if(action==='create'){
    const title=prompt('新故事的名字','未命名故事');if(title===null)return;
    const x={id:uid(),title:title.trim().slice(0,100)||'未命名故事',notes:'',ideas:'',chapters:[],chapter:0,tab:'outline',discussion:[],chatOpen:false};
    lib.books.unshift(x);lib.active=x.id;await starSave();starRender();return;
  }
  if(action==='import'){$('#starFile')?.click();return}
  if(action==='open'){lib.active=el.dataset.id;await starSave();starRender();return}
  if(action==='back'){lib.active='';await starSave();starRender();return}
  if(!b)return;
  if(action==='tab'){b.tab=el.dataset.tab;await starSave();starRender();return}
  if(action==='delete'){if(await actionSheet([{label:'删除作品',danger:true}],'删除后将无法恢复，确定吗？')!==0)return;lib.books=lib.books.filter(x=>x!==b);lib.active='';await starSave();starRender();return}
  if(action==='export'){
    const text=b.title+'\n\n'+b.chapters.map(c=>c.title+'\n\n'+c.text).join('\n\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));a.download=b.title.replace(/[\\/:*?"<>|]/g,'_')+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);return;
  }
  if(action==='chapter'){b.chapters.push({title:'第'+(b.chapters.length+1)+'章',text:''});b.chapter=b.chapters.length-1;await starSave();starEditChapter(b.chapter);return}
  if(action==='edit'){starEditChapter(+el.dataset.index);return}
  if(action==='readChapter'){b.chapter=+el.dataset.index;b.tab='read';await starSave();starRender();return}
  if(action==='draft'){
    const i=+el.dataset.index,c=b.chapters[i];if(!c)return;
    el.disabled=true;toast('正在写章节草稿…',12000);
    try{
      const t=await starAI([{role:'system',content:starContext()+'\n请根据世界观和章节安排，写一段自然流畅的中文小说正文。只输出小说正文，不要代替用户修改或删除已有文本。'},{role:'user',content:'书名：'+b.title+'\n故事设定：'+(b.notes||'')+'\n共同构思：'+(b.ideas||'')+'\n本章标题：'+c.title+'\n已有正文：'+(c.text||'').slice(-5000)+'\n请续写约600字作为待审核草稿。'}],1500);
      if(starBook()!==b||b.chapters[i]!==c)return;
      const result=await formSheet('AI 章节草稿 · 确认后才保存',[{k:'draft',t:'textarea',l:'可编辑的待审核正文'}],{draft:t},{hint:'这是新生成的候选段落。取消则不修改原稿。'});
      if(result&&starBook()===b&&b.chapters[i]===c){c.text=(c.text?c.text+'\n\n':'')+result.draft;b.chapter=i;await starSave();starRender();toast('已加入章节正文')}
    }catch(e){toast(e.message,6000)}finally{el.disabled=false}return;
  }
  if(action==='chat'){b.chatOpen=!b.chatOpen;await starSave();starRender();return}
  if(action==='brainstorm'){
    b.notes=$('#starNotes').value;b.ideas=$('#starIdeas').value;await starSave();
    el.disabled=true;try{const t=await starAI([{role:'system',content:starContext()+'\n你是小说创作搭档。和用户共同构思故事，不擅自决定最终剧情。根据设定提出有创意且逻辑连贯的人物、矛盾、章节大纲建议；不覆盖用户原稿。'},{role:'user',content:'作品：'+b.title+'\n设定：'+b.notes+'\n已有构思：'+b.ideas+'\n请提出下一轮构思建议。'}],1300);
      b.ideas=(b.ideas?b.ideas+'\n\n':'')+'【搭档建议】\n'+t;await starSave();starRender();
    }catch(e){toast(e.message,5000);el.disabled=false}return;
  }
  if(action==='ask'){
    const q=$('#starQuestion').value.trim();if(!q)return;const chapter=b.chapter||0;
    b.discussion.push({chapter,role:'user',text:q});await starSave();el.disabled=true;
    try{const c=b.chapters[chapter],t=await starAI([{role:'system',content:starContext()+'\n你是正在陪用户阅读的搭档。只根据提供的当前章节和之前已读章节讨论，不剧透后续章节。对不确定的信息明确说明。'},{role:'user',content:'作品：'+b.title+'\n已读章节：'+b.chapters.slice(0,chapter+1).map(x=>x.title+'\n'+x.text).join('\n').slice(-14000)+'\n读者问题：'+q}],900);
      b.discussion.push({chapter,role:'assistant',text:t});await starSave();starRender();
    }catch(e){toast(e.message,5000);starRender()}return;
  }
}
async function starEditChapter(i){
  const b=starBook(),c=b?.chapters[i];if(!c)return;
  const result=await formSheet('编辑章节',[{k:'title',t:'text',l:'章节标题'},{k:'text',t:'textarea',l:'正文'}],{title:c.title,text:c.text||''});
  if(!result||starBook()!==b)return;c.title=result.title||c.title;c.text=result.text||'';b.chapter=i;await starSave();starRender();
}
document.addEventListener('click',e=>{const el=e.target.closest('[data-star]');if(el)starAction(el.dataset.star,el).catch(err=>toast(err.message,5000))});
document.addEventListener('change',async e=>{
  if(e.target.id==='starPartner'){S.starLibrary.partner=e.target.value;await starSave()}
  if(e.target.id==='starChapter'){const b=starBook();if(b){b.chapter=+e.target.value;await starSave();starRender()}}
  if(e.target.id==='starFile'){const f=e.target.files?.[0];if(!f)return;if(f.size>8*1024*1024)return toast('TXT 请先控制在 8MB 以内');const t=await f.text();const sections=t.split(/(?=^\s*(?:第[零一二三四五六七八九十百千万\d]+章|Chapter\s+\d+)\s*[^\n]*$)/gim).filter(x=>x.trim());const chapters=sections.length>1?sections.map((text,i)=>({title:text.trim().split(/\r?\n/)[0].slice(0,90)||'第'+(i+1)+'章',text:text.trim()})):[{title:'正文',text:t}];const b={id:uid(),title:f.name.replace(/\.txt$/i,''),notes:'',ideas:'',chapters,chapter:0,tab:'read',discussion:[],chatOpen:false};S.starLibrary.books.unshift(b);S.starLibrary.active=b.id;await starSave();starRender()}
});
document.addEventListener('input',e=>{const b=starBook();if(!b)return;if(e.target.id==='starNotes'){b.notes=e.target.value;starSave()}if(e.target.id==='starIdeas'){b.ideas=e.target.value;starSave()}});
