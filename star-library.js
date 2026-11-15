/* 星页书房：本地共读与三种协作写作；不会改写角色的聊天记忆。 */
DEFAULTS.starLibrary={books:[],trash:[],active:'',partner:'',view:'all',reader:{font:19,tone:'paper'}};
const starJobs=new Set();
const STAR_MODES={relay:'接力创作',outline:'大纲协作',director:'导演模式'};
const STAR_RECTS={home:[0,0,635,620],read:[635,0,405,286],write:[1060,0,360,280],shelf:[645,290,375,270],works:[1025,280,400,295],empty:[420,555,710,469]};
function starArt(kind,size=80){const [x,y,w,h]=STAR_RECTS[kind]||STAR_RECTS.home;return `<span class="star-art star-art-${kind}" style="width:${size}px;aspect-ratio:${w}/${h}" aria-hidden="true"><img src="themes/prince/star-library/materials.png" alt="" style="width:${1536/w*100}%;left:${-x/w*100}%;top:${-y/h*100}%"></span>`}
function starButton(action,label,extra=''){return `<button class="btn" data-star="${action}" ${extra}>${esc(label)}</button>`}
function starEnsure(){const L=S.starLibrary||=(structuredClone(DEFAULTS.starLibrary));L.books||=[];L.trash||=[];L.reader={font:19,tone:'paper',...L.reader};for(const b of L.books){b.chapters||=[];b.discussion||=[];b.bookmarks||=[];b.drafts||={};b.writeMode=STAR_MODES[b.writeMode]?b.writeMode:'outline';b.chapter=Math.max(0,Math.min(b.chapter||0,b.chapters.length-1));}return L}
function starBook(){const L=starEnsure();return L.books.find(b=>b.id===L.active)}
function starSave(){return DB.set('starLibrary',S.starLibrary)}
function starTouch(b){b.updatedAt=Date.now()}
function starInit(){
 starEnsure();
 if(!S.home.starLibraryV1){if(!S.home.pages.flat().some(x=>x.type==='app'&&x.app==='starLibrary'))S.home.pages.at(-1).push({id:uid(),type:'app',app:'starLibrary'});S.home.starLibraryV1=true;save('home')}
 const body=$('#starLibraryBody');body.addEventListener('scroll',()=>{const b=starBook();if(b?.tab==='read'){b.readScroll||={};b.readScroll[b.chapter||0]=body.scrollTop;clearTimeout(starInit.scrollTimer);starInit.scrollTimer=setTimeout(()=>starSave().catch(starError),250)}},{passive:true});
}
function starError(e){toast(e.message||String(e),5000)}
function starSnapshot(c,reason){c.history||=[];c.history.push({id:uid(),at:Date.now(),reason,title:c.title,text:c.text||'',outline:c.outline||''});}
function starLive(b){return starEnsure().books.includes(b)}
function starPartner(b){return charById(b?.partner??starEnsure().partner)||null}
function starContext(b){const c=starPartner(b);return (c?`你以「${c.name}」的身份陪用户读书和写作。搭档性格：${[c.description,c.personality].filter(Boolean).join('\n').slice(0,3500)}`:'你是耐心、具体、尊重作者意图的阅读与小说创作搭档。')+'\n小说正文以本书设定为准，不默认把搭档或用户写成小说人物。保留用户选择的叙事视角、人物性格与语言风格。';}
async function starAI(b,messages,max_tokens=1800){const c=starPartner(b);if(!ownAPI(c)&&!apiReady())throw Error('先在设置或搭档角色页填好 AI 接口');return clean(await callAPI(messages,{char:c||undefined,max_tokens,temperature:.8}))}
function starOptions(b){return `<option value="">独立 AI 搭档</option>`+S.chars.map(c=>`<option value="${esc(c.id)}"${starPartner(b)?.id===c.id?' selected':''}>${esc(c.name)}</option>`).join('')}
function starBaseBook(title,source='write'){return {id:uid(),title:title.slice(0,100)||'未命名故事',source,status:'working',notes:'',ideas:'',chapters:[],chapter:0,tab:source==='write'?'outline':'read',discussion:[],bookmarks:[],drafts:{},writeMode:'outline',partner:starEnsure().partner||'',createdAt:Date.now(),updatedAt:Date.now()}}
function starFileInputs(){return '<input id="starFile" type="file" accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden><input id="starBackupFile" type="file" accept=".json,application/json" hidden>'}
function starShelfHTML(L){const list=L.books.filter(b=>L.view!=='completed'||b.status==='completed').filter(b=>!L.search||b.title.toLowerCase().includes(L.search.toLowerCase())).slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));return `<div class="star-shelf-head"><h3>${L.view==='completed'?'共同作品':'我的书架'}</h3><span>${list.length} 本</span></div><input class="star-search" id="starSearch" aria-label="搜索书名" placeholder="找一本书…" value="${esc(L.search||'')}"><div class="star-book-grid">${list.map(b=>`<button class="star-book" data-star="open" data-id="${esc(b.id)}">${starArt(b.status==='completed'?'works':b.source==='write'?'write':'read',66)}<b>${esc(b.title)}</b><small>${b.source==='write'?'共同创作':'一起读'} · ${b.chapters.length} 章${b.status==='completed'?' · 已完成':''}</small><span>${b.chapters.length?'读到第 '+((b.chapter||0)+1)+' 章':'等待第一章'}</span></button>`).join('')}</div>${list.length?'':`<div class="star-empty">${starArt('empty',230)}<p>${L.search?'没有找到这本书':'空着的位置，留给下一段故事。'}</p></div>`}`;}
function starRender(){
 const root=$('#starLibraryBody');if(!root)return;const L=starEnsure(),b=starBook();
 if(!b){root.innerHTML=`<div class="star-hero">${starArt('home',155)}<div><small>和喜欢的人，把故事读下去</small><h2>星页书房</h2><p>一起读，一起写，装订属于我们的故事。</p></div></div><div class="star-entry-grid"><button data-star="import">${starArt('read',72)}<b>一起读</b><small>带一本 TXT / Word 来</small></button><button data-star="create">${starArt('write',72)}<b>一起写</b><small>接力 · 大纲 · 导演</small></button><button data-star="shelf">${starArt('shelf',72)}<b>我的书架</b><small>继续上次的那一页</small></button><button data-star="completed">${starArt('works',72)}<b>共同作品</b><small>收好已经完成的故事</small></button></div><div id="starShelf">${starShelfHTML(L)}</div><div class="btns">${starButton('importBackup','恢复作品备份')}${starButton('trash',`找回删除的书（${L.trash.length}）`)}</div><p class="hint">书稿、阅读进度和讨论保存在这台设备；可导出作品备份，也随小手机总备份保存。Word 支持 .docx；旧 .doc 请先另存为 .docx。</p>${starFileInputs()}`;return;}
 const chapter=b.chapters[b.chapter||0],job=starJobs.has(b.id);
 root.innerHTML=`<div class="star-book-head"><div class="btns">${starButton('back','‹ 书架')}${starButton('book-menu','作品管理')}</div><div class="star-title-row">${starArt(b.source==='write'?'write':'read',64)}<div><small>${b.source==='write'?'我们正在写':'我们正在读'}${b.status==='completed'?' · 已完成':''}</small><h2>${esc(b.title)}</h2></div></div><label class="star-partner">共读 / 写作搭档<select id="starPartner" ${job?'disabled':''}>${starOptions(b)}</select></label><div class="star-tabs"><button data-star="tab" data-tab="read" aria-pressed="${b.tab==='read'}">一起读</button><button data-star="tab" data-tab="outline" aria-pressed="${b.tab!=='read'}">一起写</button></div>${job?'<p class="star-status" role="status">搭档正在准备内容，原稿已收好…</p>':''}</div>`+(b.tab==='read'?starReadHTML(b,chapter):starWriteHTML(b));
 if(b.tab==='read')requestAnimationFrame(()=>{if(starBook()===b&&b.tab==='read')root.scrollTop=b.readScroll?.[b.chapter||0]||0});
}
function starReadHTML(b,c){const L=starEnsure(),i=b.chapter||0,posts=b.discussion.filter(x=>x.chapter===i),font=Math.max(16,Math.min(26,+L.reader.font||19)),tone=['paper','lilac','night'].includes(L.reader.tone)?L.reader.tone:'paper';
 return `<div class="star-reader-tools"><label>章节<select id="starChapter" ${!b.chapters.length?'disabled':''}>${b.chapters.map((x,j)=>`<option value="${j}"${j===i?' selected':''}>${esc(x.title)}</option>`).join('')}</select></label><small>${b.chapters.length?`${i+1} / ${b.chapters.length} 章`:'尚无正文'}</small><div class="btns">${starButton('prev','上一章',i===0?'disabled':'')}${starButton('next','下一章',i>=b.chapters.length-1?'disabled':'')}${starButton('bookmark','收藏这一页')}${starButton('marks',`书签 ${b.bookmarks.length}`)}</div><div class="star-reading-options"><label>字号<select id="starFont">${[16,19,22,26].map(v=>`<option${font===v?' selected':''}>${v}</option>`).join('')}</select></label><label>纸张<select id="starTone">${[['paper','奶油纸'],['lilac','淡紫'],['night','夜读']].map(([v,t])=>`<option value="${v}"${tone===v?' selected':''}>${t}</option>`).join('')}</select></label></div></div><article id="starArticle" class="star-reader star-tone-${tone}" style="font-size:${font}px"><h3>${esc(c?.title||'这一页还空着')}</h3><div>${esc(c?.text||'先到「一起写」添加章节，再来读给彼此听。')}</div></article><div class="btns">${starButton('quote','选中一句，和搭档聊聊')}${starButton('chat',b.chatOpen?'收起讨论':'展开章节讨论')}</div>${b.chatOpen?`<section class="star-discussion"><h3>这一章，想和你聊</h3><p class="hint">只带入当前及之前的章节，保留本章最近的讨论，不发送后续章节。</p><div class="star-discussion-log">${posts.map(x=>`<div class="star-dialog ${x.role==='user'?'mine':''}"><b>${esc(x.role==='user'?S.user.name:x.name||'搭档')}</b><p>${esc(x.text)}</p></div>`).join('')||'<p class="hint">喜欢哪一句，或者哪里没看懂，都可以说。</p>'}</div><label>想聊的话<textarea id="starQuestion" placeholder="聊聊人物、伏笔，或刚才选中的句子…">${esc(b.drafts.question||'')}</textarea></label><div class="btns">${starButton('ask',starJobs.has(b.id)?'正在回应…':'发送讨论',starJobs.has(b.id)?'disabled':'')}</div></section>`:''}`;
}
function starWriteHTML(b){const mode=b.writeMode||'outline',disabled=starJobs.has(b.id)?'disabled':'',i=b.chapter||0;
 return `<section class="star-panel"><h3>一起写，选一种默契</h3><label>创作方式<select id="starWriteMode" ${disabled}>${Object.entries(STAR_MODES).map(([v,n])=>`<option value="${v}"${mode===v?' selected':''}>${n}${v==='relay'?' · 一人一段':v==='outline'?' · 一起构思':' · 你来决定剧情'}</option>`).join('')}</select></label><p class="hint">三种方式可以随时切换，设定、正文和输入草稿会保留。</p><label>正在创作的章节<select id="starWritingChapter">${b.chapters.map((c,j)=>`<option value="${j}"${j===i?' selected':''}>${esc(c.title)}</option>`).join('')}</select></label>${mode!=='outline'?`<label>${mode==='relay'?'我的这一段':'下一段剧情指令'}<textarea id="${mode==='relay'?'starRelayText':'starDirectorText'}" placeholder="${mode==='relay'?'写下你的段落，搭档会接着写…':'希望发生什么、谁来叙述、停在哪里…'}">${esc(b.drafts[mode]||'')}</textarea></label>${starButton(mode==='relay'?'relay':'direct',mode==='relay'?'让搭档接着写':'按我的指令写',disabled)}`:''}${b.pendingDraft?starButton('review','查看上次生成的草稿',disabled)+starButton('regenerate','暂存这份，重新生成',disabled):''}${b.savedDrafts?.length?starButton('candidates',`草稿夹 ${b.savedDrafts.length}`,disabled):''}</section><section class="star-panel"><h3>故事设定</h3><label>世界观、人物、关系与语言风格<textarea id="starNotes" placeholder="故事发生在哪里？哪些设定一定要遵守？">${esc(b.notes||'')}</textarea></label><label>共同构思与章节安排<textarea id="starIdeas" placeholder="把讨论过的大纲放在这里…">${esc(b.ideas||'')}</textarea></label><div class="btns">${starButton('brainstorm','✦ 和搭档一起构思',disabled)}${starButton('chapter','＋ 新增章节')}</div><p class="hint">AI 建议和正文都先交给你审核，确认后才保存；不会自动覆盖原稿。</p></section><h3>章节 · ${b.chapters.length}</h3>${b.chapters.map((c,j)=>`<section class="star-chapter ${j===i?'selected':''}"><small>第 ${j+1} 章 · ${(c.text||'').length} 字${j===i?' · 当前写作章节':''}</small><h3>${esc(c.title)}</h3>${c.outline?`<p>${esc(c.outline)}</p>`:''}<div class="btns">${starButton('edit','编辑正文 / 大纲',`data-index="${j}"`)}${starButton('draft','AI 续写草稿',`data-index="${j}" ${disabled}`)}${starButton('readChapter','阅读',`data-index="${j}"`)}${starButton('history',`历史版本 ${(c.history||[]).length}`,`data-index="${j}"`)}</div></section>`).join('')||`<div class="star-empty">${starArt('empty',180)}<p>先给第一章起个名字吧。</p></div>`}`;
}
function starDownload(name,content,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name.replace(/[\\/:*?"<>|]/g,'_');a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
async function starReview(b){const p=b.pendingDraft;if(!p)return;const c=b.chapters[p.chapter],before=c?.text||'',ideasBefore=b.ideas||'';
 if(p.kind!=='ideas'&&!c)throw Error('草稿对应的章节已不存在');
 const r=await formSheet(p.kind==='ideas'?'构思建议 · 确认后加入':'正文草稿 · 确认后加入',[{k:'draft',t:'textarea',l:'可以修改，再决定是否收入'}],{draft:p.text},{hint:p.kind==='ideas'?'确认后追加到共同构思，已有内容会保留。':'确认后追加到当前章节；取消会保留候选草稿，不改动正文。',saveLabel:'确认加入'});
 if(!r||!starLive(b)||b.pendingDraft!==p)return;
 const text=String(r.draft||'').trim();if(!text)throw Error('草稿为空，原稿保持不变');
 if(p.kind==='ideas'){if((b.ideas||'')!==ideasBefore)throw Error('构思刚刚有修改，候选草稿已保留，请重新打开确认');b.ideas=[ideasBefore,text].filter(Boolean).join('\n\n')}
 else {if(b.chapters[p.chapter]!==c||(c.text||'')!==before)throw Error('正文刚刚有修改，候选草稿已保留，请重新打开确认');starSnapshot(c,STAR_MODES[p.mode]||'AI 草稿确认前');c.text=[before,text].filter(Boolean).join('\n\n');b.chapter=p.chapter;if(p.mode==='relay'&&b.drafts.relay===p.input)b.drafts.relay='';}
 delete b.pendingDraft;starTouch(b);await starSave();if(starBook()===b)starRender();toast('已加入作品');
}
async function starGenerate(b,kind,el){
 if(starJobs.has(b.id))return;const i=kind==='draft'?+el.dataset.index:b.chapter||0,c=b.chapters[i],mode=kind==='relay'?'relay':kind==='direct'?'director':'outline',input=b.drafts[mode]||'';
 if(kind!=='brainstorm'&&!c)throw Error('先新增一个章节，再开始写');
 if(['relay','direct'].includes(kind)&&!input.trim())throw Error('先写下你的段落或剧情指令');
 if(b.pendingDraft){toast('先确认或修改上次草稿，再生成新的内容');await starReview(b);return}
 starJobs.add(b.id);if(starBook()===b)starRender();
 try{
  const sys=kind==='brainstorm'?'根据设定提出人物、冲突和章节安排建议。只提出候选建议，不擅自确定结局。':kind==='relay'?'紧接用户新写的段落续写约500字，不重述已有内容，不重复用户段落。':kind==='direct'?'严格按导演指令写约600字小说正文，遵守叙事视角、人物与停笔要求。':'依据本章大纲和已有正文续写约600字，只输出新正文，不重复已有段落。';
  const prompt=`作品：${b.title}\n设定：${(b.notes||'').slice(0,10000)}\n共同构思：${(b.ideas||'').slice(-6000)}\n${c?`本章：${c.title}\n本章大纲：${c.outline||''}\n前文：${b.chapters.slice(0,i+1).map(x=>x.title+'\n'+x.text).join('\n').slice(-8000)}`:''}\n${kind==='relay'?'用户新段落：':kind==='direct'?'导演指令：':''}${input}`;
  const draft=await starAI(b,[{role:'system',content:starContext(b)+'\n'+sys},{role:'user',content:prompt}]);if(!starLive(b))return;
  b.pendingDraft={id:uid(),kind:kind==='brainstorm'?'ideas':'text',generationKind:kind,mode,chapter:i,input,text:kind==='relay'?input+'\n\n'+draft:draft};starTouch(b);await starSave();
 }finally{starJobs.delete(b.id);if(starBook()===b)starRender()}
 if(starLive(b)&&starBook()===b)await starReview(b);
}
async function starAsk(b){
 if(starJobs.has(b.id))return;const q=(b.drafts.question||'').trim(),i=b.chapter||0;if(!q)throw Error('先写一句想聊的话');if(!b.chapters[i])throw Error('先导入或写下一章正文');
 const partner=starPartner(b),request={id:uid(),chapter:i,role:'user',text:q,at:Date.now()};b.discussion.push(request);b.drafts.question='';starJobs.add(b.id);await starSave();starRender();
 try{const history=b.discussion.filter(x=>x.chapter===i&&x!==request&&x.status!=='failed').slice(-12).map(x=>({role:x.role,content:x.text}));const text=await starAI(b,[{role:'system',content:starContext(b)+'\n只依据当前和之前章节讨论，不发送也不猜测未读章节；不确定时说明依据不足。\n已读正文：\n'+b.chapters.slice(0,i+1).map(c=>c.title+'\n'+c.text).join('\n').slice(-14000)},...history,{role:'user',content:q}],1200);if(!starLive(b))return;b.discussion.push({id:uid(),chapter:i,role:'assistant',text,name:partner?.name||'搭档',at:Date.now()});request.status='done';starTouch(b);await starSave()}
 catch(e){request.status='failed';if(starLive(b)){b.drafts.question||=q;await starSave()}throw e}
 finally{starJobs.delete(b.id);if(starBook()===b)starRender()}
}
async function starEditChapter(b,i){const c=b.chapters[i];if(!c)return;const before=JSON.stringify(c);const r=await formSheet('编辑章节',[{k:'title',t:'text',l:'章节标题'},{k:'outline',t:'textarea',l:'本章大纲'},{k:'text',t:'textarea',l:'正文'}],{title:c.title,outline:c.outline||'',text:c.text||''});if(!r||!starLive(b)||b.chapters[i]!==c)return;if(JSON.stringify(c)!==before)throw Error('这一章已有更新，请重新打开编辑');starSnapshot(c,'手动编辑前');Object.assign(c,{title:String(r.title||'').trim().slice(0,100)||c.title,text:r.text||'',outline:r.outline||''});b.chapter=i;starTouch(b);await starSave();starRender()}
async function starAction(action,el){
 const L=starEnsure(),b=starBook();
 if(action==='create'){const r=await formSheet('开始一个新故事',[{k:'title',t:'text',l:'故事名字'}],{title:''},{hint:'先写一个暂定名，以后随时可以改。'});if(!r)return;const x=starBaseBook((r.title||'').trim());L.books.unshift(x);L.active=x.id;await starSave();starRender();return}
 if(action==='import'){$('#starFile').click();return}if(action==='importBackup'){$('#starBackupFile').click();return}
 if(action==='open'){L.active=el.dataset.id;await starSave();starRender();return}
 if(action==='back'){L.active='';await starSave();starRender();return}
 if(action==='shelf'||action==='completed'){L.active='';L.view=action==='completed'?'completed':'all';await starSave();starRender();return}
 if(action==='trash'){if(!L.trash.length)return toast('没有删除的书');const n=await actionSheet(L.trash.map(x=>({label:'找回 · '+x.title})),'删除的书会在这里保留');if(n<0||!L.trash[n])return;L.books.unshift(L.trash.splice(n,1)[0]);await starSave();starRender();return}
 if(!b)return;
 if(action==='tab'){b.tab=el.dataset.tab;await starSave();starRender();return}
 if(action==='book-menu'){const n=await actionSheet([{label:'修改书名'},{label:b.status==='completed'?'改回创作中':'标记为共同完成作品'},{label:'导出 TXT 正文'},{label:'导出作品备份（含历史与讨论）'},{label:'移入已删除的书',danger:true}],b.title);if(n===0){const r=await formSheet('修改书名',[{k:'title',t:'text',l:'书名'}],{title:b.title});if(r?.title?.trim())b.title=r.title.trim().slice(0,100)}if(n===1)b.status=b.status==='completed'?'working':'completed';if(n===2)starDownload(b.title+'.txt',b.title+'\n\n'+b.chapters.map(c=>c.title+'\n\n'+c.text).join('\n\n'),'text/plain;charset=utf-8');if(n===3)starDownload(b.title+'.starbook.json',JSON.stringify({format:'star-library-book',version:1,book:b},null,2),'application/json');if(n===4){L.trash.unshift(b);L.books=L.books.filter(x=>x!==b);L.active=''}starTouch(b);await starSave();starRender();return}
 if(action==='chapter'){const r=await formSheet('新增章节',[{k:'title',t:'text',l:'章节标题'},{k:'outline',t:'textarea',l:'这一章想写什么'}],{title:'第'+(b.chapters.length+1)+'章',outline:''});if(!r||!starLive(b))return;b.chapters.push({title:(r.title||'').trim().slice(0,100)||'新章节',outline:r.outline||'',text:'',history:[]});b.chapter=b.chapters.length-1;starTouch(b);await starSave();starRender();return}
 if(action==='edit')return starEditChapter(b,+el.dataset.index);
 if(['relay','direct','draft','brainstorm'].includes(action))return starGenerate(b,action,el);
 if(action==='review')return starReview(b);
 if(action==='regenerate'){if(!b.pendingDraft||starJobs.has(b.id))return;const p=b.pendingDraft;b.savedDrafts||=[];b.savedDrafts.push(p);delete b.pendingDraft;await starSave();return starGenerate(b,p.generationKind||(p.kind==='ideas'?'brainstorm':p.mode==='relay'?'relay':p.mode==='director'?'direct':'draft'),{dataset:{index:p.chapter}})}
 if(action==='candidates'){const list=b.savedDrafts||[],n=await actionSheet(list.map((p,i)=>({label:(i+1)+' · '+(p.kind==='ideas'?'构思':b.chapters[p.chapter]?.title||'正文')+' · '+p.text.slice(0,30)})),'打开一份暂存草稿');if(n<0||!list[n])return;const p=list.splice(n,1)[0];if(b.pendingDraft)list.push(b.pendingDraft);b.pendingDraft=p;await starSave();return starReview(b);}
 if(action==='readChapter'||action==='prev'||action==='next'){b.chapter=action==='readChapter'?+el.dataset.index:Math.max(0,Math.min(b.chapters.length-1,(b.chapter||0)+(action==='next'?1:-1)));b.tab='read';await starSave();starRender();return}
 if(action==='history'){const c=b.chapters[+el.dataset.index],H=c?.history||[];if(!H.length)return toast('还没有历史版本');const n=await actionSheet(H.slice().reverse().map(v=>({label:new Date(v.at).toLocaleString()+' · '+v.reason})),'恢复前会保存当前版本');if(n<0||!H[H.length-1-n])return;const v=structuredClone(H[H.length-1-n]);starSnapshot(c,'恢复前自动保存');Object.assign(c,{title:v.title,text:v.text,outline:v.outline||''});await starSave();starRender();return}
 if(action==='chat'){b.chatOpen=!b.chatOpen;await starSave();starRender();return}
 if(action==='ask')return starAsk(b);
 if(action==='quote'){const sel=window.getSelection(),article=$('#starArticle'),text=article?.contains(sel?.anchorNode)?String(sel).trim().slice(0,2500):'';if(!text)return toast('先在正文里选中一句话');b.drafts.question='“'+text+'”\n\n';b.chatOpen=true;await starSave();starRender();return}
 if(action==='bookmark'){if(!b.chapters.length)return;const chapter=b.chapter||0,scroll=$('#starLibraryBody').scrollTop;b.bookmarks.push({id:uid(),chapter,scroll,label:b.chapters[chapter].title,at:Date.now()});await starSave();toast('这一页收进书签啦');starRender();return}
 if(action==='marks'){if(!b.bookmarks.length)return toast('还没有书签');const n=await actionSheet(b.bookmarks.map(m=>({label:m.label+' · '+new Date(m.at).toLocaleDateString()})),'回到哪一页？');const m=b.bookmarks[n];if(!m)return;b.chapter=m.chapter;b.tab='read';b.readScroll||={};b.readScroll[b.chapter]=m.scroll;await starSave();starRender()}
}
const STAR_MAX_FILE=8*1024*1024,STAR_MAX_TEXT=2000000;
function starChapters(text){
 text=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');if(text.length>STAR_MAX_TEXT)throw Error('正文超过 200 万字，请拆成几册导入');if(!text.trim())throw Error('文件里没有可读取的正文');
 const matches=[...text.matchAll(/^[ \t]*(?:第[零〇一二三四五六七八九十百千万两\d]+[章回卷节]|chapter[ \t]+[\divxlc]+)[^\n]{0,100}$/gim)],out=[];
 if(matches.length){let prev=0,title='序言';for(const m of matches){if(m.index>prev&&text.slice(prev,m.index).trim())out.push({title,text:text.slice(prev,m.index).trim()});title=m[0].trim();prev=m.index+m[0].length;}if(text.slice(prev).trim()||title!=='序言')out.push({title,text:text.slice(prev).trim()});}
 else {for(let start=0;start<text.length;){let end=Math.min(text.length,start+12000);if(end<text.length){const p=text.lastIndexOf('\n',end);if(p>start+6000)end=p+1}out.push({title:text.length<=12000?'正文':'阅读分段 '+(out.length+1),text:text.slice(start,end)});start=end;}}
 if(out.length>500)throw Error('章节超过 500 章，请拆成几册导入');return out.map(c=>({...c,outline:'',history:[]}));
}
function starDecodeTXT(bytes){const b=new Uint8Array(bytes);if(b[0]===255&&b[1]===254)return new TextDecoder('utf-16le').decode(b);if(b[0]===254&&b[1]===255)return new TextDecoder('utf-16be').decode(b);const utf=new TextDecoder('utf-8').decode(b);if(utf.includes('\uFFFD')){try{return new TextDecoder('gb18030',{fatal:true}).decode(b)}catch(_){throw Error('TXT 编码无法识别，请另存为 UTF-8 后导入')}}return utf;}
async function starDocxXML(bytes){
 const u=new Uint8Array(bytes),v=new DataView(u.buffer,u.byteOffset,u.byteLength);if(u.length<22)throw Error('Word 文件不完整');let e=u.length-22;
 while(e>=Math.max(0,u.length-65557)&&v.getUint32(e,true)!==0x06054b50)e--;if(e<Math.max(0,u.length-65557))throw Error('不是有效的 DOCX 文件');
 const count=v.getUint16(e+10,true);if(count>4096)throw Error('Word 附件过多，请另存为纯正文文档');let p=v.getUint32(e+16,true);
 for(let i=0;i<count;i++){
  if(p+46>u.length||v.getUint32(p,true)!==0x02014b50)throw Error('Word 文件目录损坏');
  const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),compressed=v.getUint32(p+20,true),size=v.getUint32(p+24,true),n=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true),off=v.getUint32(p+42,true);
  if(p+46+n+extra+comment>u.length)throw Error('Word 文件目录不完整');const name=new TextDecoder().decode(u.slice(p+46,p+46+n));p+=46+n+extra+comment;
  if(name!=='word/document.xml')continue;if(flags&1)throw Error('不支持加密 Word 文档，请先解除密码');if(size>STAR_MAX_FILE||compressed>STAR_MAX_FILE)throw Error('Word 正文过大，请拆成几册导入');
  if(off+30>u.length||v.getUint32(off,true)!==0x04034b50)throw Error('Word 正文损坏');const start=off+30+v.getUint16(off+26,true)+v.getUint16(off+28,true);if(start+compressed>u.length)throw Error('Word 正文不完整');const raw=u.slice(start,start+compressed);
  if(method===0){if(raw.length>STAR_MAX_FILE)throw Error('Word 正文过大');return new TextDecoder().decode(raw)}
  if(method!==8||typeof DecompressionStream==='undefined')throw Error('当前浏览器无法读取这个 Word 文件，可先另存为 TXT');
  let stream;try{stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))}catch(_){throw Error('当前浏览器不支持 Word 解压，请先另存为 TXT')}
  const reader=stream.getReader(),chunks=[];let total=0;try{while(true){const r=await reader.read();if(r.done)break;total+=r.value.length;if(total>STAR_MAX_FILE)throw Error('Word 正文过大');chunks.push(r.value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
  const out=new Uint8Array(total);let pos=0;for(const ch of chunks){out.set(ch,pos);pos+=ch.length}return new TextDecoder().decode(out);
 }
 throw Error('Word 文件没有正文，请使用 .docx 文档');
}
function starDocxParagraphs(xml){
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Word 文档包含不支持的 XML 声明');const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('Word 正文格式损坏');
 return [...doc.getElementsByTagNameNS('*','p')].map(p=>{const walk=n=>n.localName==='t'?n.textContent:n.localName==='br'?'\n':n.localName==='tab'?'\t':[...n.childNodes].map(walk).join('');const text=walk(p);const style=p.getElementsByTagNameNS('*','pStyle')[0];return {text,heading:/^(heading[12]|标题[12])$/i.test(style?.getAttribute('w:val')||style?.getAttribute('val')||'')}}).filter(p=>p.text.trim());
}
async function starImportFile(file){
 if(file.size>STAR_MAX_FILE)throw Error('文件请控制在 8MB 以内');const name=file.name||'导入的书',ext=name.split('.').at(-1).toLowerCase();if(!['txt','docx'].includes(ext))throw Error('支持 TXT 和 Word .docx；旧 .doc 请先另存为 .docx');
 const data=await file.arrayBuffer();let chapters;
 if(ext==='txt')chapters=starChapters(starDecodeTXT(data));
 else {const paras=starDocxParagraphs(await starDocxXML(data)),text=paras.map(p=>p.text).join('\n\n');if(text.length>STAR_MAX_TEXT)throw Error('正文超过 200 万字，请拆成几册导入');if(paras.some(p=>p.heading)){chapters=[];let c={title:'序言',text:''};for(const p of paras){if(p.heading){if(c.text.trim())chapters.push(c);c={title:p.text.slice(0,100),text:''}}else c.text+=(c.text?'\n\n':'')+p.text}if(c.text.trim()||c.title!=='序言')chapters.push(c);if(!chapters.length)throw Error('Word 文件没有可读取的正文');if(chapters.length>500)throw Error('章节超过 500 章，请拆成几册导入')}else chapters=starChapters(text);}
 const b=starBaseBook(name.replace(/\.(txt|docx)$/i,''),'read');b.chapters=chapters.map(c=>({outline:'',history:[],...c}));const L=starEnsure();L.books.unshift(b);L.active=b.id;await starSave();starRender();toast('已放进书架 · '+b.chapters.length+' 章');return b;
}
function starRestoreBook(d){
 if(d.format!=='star-library-book'||d.version!==1||!d.book||!Array.isArray(d.book.chapters))throw Error('不是有效的星页书房作品备份');const s=d.book;
 if(s.chapters.length>500||s.chapters.some(c=>!c||typeof c.title!=='string'||typeof c.text!=='string'))throw Error('备份章节数据异常');
 const b=starBaseBook(String(s.title||'恢复的作品'),s.source==='read'?'read':'write');b.notes=String(s.notes||'').slice(0,40000);b.ideas=String(s.ideas||'').slice(0,80000);b.writeMode=STAR_MODES[s.writeMode]?s.writeMode:'outline';b.status=s.status==='completed'?'completed':'working';b.partner=charById(s.partner)?.id||'';
 b.chapters=s.chapters.map(c=>({title:c.title.slice(0,100),text:c.text,outline:String(c.outline||'').slice(0,12000),history:(Array.isArray(c.history)?c.history:[]).filter(v=>v&&typeof v.text==='string'&&typeof v.title==='string').map(v=>({id:uid(),at:Number(v.at)||Date.parse(v.at)||Date.now(),reason:String(v.reason||'导入历史').slice(0,100),title:v.title.slice(0,100),text:v.text,outline:String(v.outline||'')}))}));
 b.chapter=Math.max(0,Math.min(Number(s.chapter)||0,b.chapters.length-1));b.tab=s.tab==='read'?'read':'outline';b.discussion=(Array.isArray(s.discussion)?s.discussion:[]).filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.text==='string'&&Number.isInteger(x.chapter)&&x.chapter>=0&&x.chapter<b.chapters.length).map(x=>({id:uid(),chapter:x.chapter,role:x.role,text:x.text,name:String(x.name||'搭档'),at:Number(x.at)||Date.now()}));
 b.bookmarks=(Array.isArray(s.bookmarks)?s.bookmarks:[]).filter(m=>Number.isInteger(m?.chapter)&&m.chapter>=0&&m.chapter<b.chapters.length).map(m=>({id:uid(),chapter:m.chapter,label:String(m.label||b.chapters[m.chapter].title),scroll:Math.max(0,Number(m.scroll)||0),at:Number(m.at)||Date.now()}));b.readScroll={};for(let i=0;i<b.chapters.length;i++)if(Number.isFinite(+s.readScroll?.[i]))b.readScroll[i]=Math.max(0,+s.readScroll[i]);b.drafts={};for(const k of ['relay','director','question'])b.drafts[k]=String(s.drafts?.[k]||'').slice(0,20000);const candidate=p=>p&&typeof p.text==='string'&&['text','ideas'].includes(p.kind)&&Number.isInteger(p.chapter)&&p.chapter>=0?{id:uid(),kind:p.kind,generationKind:['relay','direct','draft','brainstorm'].includes(p.generationKind)?p.generationKind:'draft',mode:STAR_MODES[p.mode]?p.mode:'outline',chapter:p.chapter,input:String(p.input||''),text:p.text}:null;b.pendingDraft=candidate(s.pendingDraft)||undefined;b.savedDrafts=(Array.isArray(s.savedDrafts)?s.savedDrafts:[]).map(candidate).filter(Boolean);return b;
}
document.addEventListener('click',e=>{const el=e.target.closest('[data-star]');if(el&&!el.disabled)starAction(el.dataset.star,el).catch(starError)});
document.addEventListener('change',async e=>{const L=starEnsure(),b=starBook(),id=e.target.id;try{
 if(id==='starPartner'&&b){b.partner=e.target.value;L.partner=b.partner;await starSave();return}
 if(id==='starWriteMode'&&b){b.writeMode=e.target.value;await starSave();starRender();return}
 if(['starChapter','starWritingChapter'].includes(id)&&b){b.chapter=+e.target.value;await starSave();starRender();return}
 if(id==='starFont'||id==='starTone'){L.reader[id==='starFont'?'font':'tone']=id==='starFont'?+e.target.value:e.target.value;await starSave();starRender();return}
 if(id==='starFile'){const f=e.target.files?.[0];if(f){e.target.disabled=true;try{await starImportFile(f)}finally{e.target.disabled=false;e.target.value=''}}return}
 if(id==='starBackupFile'){const f=e.target.files?.[0];if(!f)return;if(f.size>64*1024*1024)throw Error('作品备份超过 64MB，请使用小手机完整备份恢复');const x=starRestoreBook(JSON.parse(await f.text()));L.books.unshift(x);L.active=x.id;await starSave();starRender();toast('作品备份已恢复为新副本');}
 }catch(err){starError(err)}});
document.addEventListener('input',e=>{const L=starEnsure(),b=starBook(),id=e.target.id;if(id==='starSearch'){L.search=e.target.value;const shelf=$('#starShelf');if(shelf){const field=e.target,pos=field.selectionStart;shelf.innerHTML=starShelfHTML(L);$('#starSearch').focus();$('#starSearch').setSelectionRange(pos,pos)}return}if(!b)return;const map={starNotes:'notes',starIdeas:'ideas'};if(map[id]){b[map[id]]=e.target.value;starTouch(b)}else{const key={starRelayText:'relay',starDirectorText:'director',starQuestion:'question'}[id];if(!key)return;b.drafts[key]=e.target.value}clearTimeout(starInit.inputTimer);starInit.inputTimer=setTimeout(()=>starSave().catch(starError),250)});
