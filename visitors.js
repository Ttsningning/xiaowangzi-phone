/* 万界来客：独立星球、明确入境与返回；交易和聊天不能自行改变位置。 */
DEFAULTS.visitors={inside:false,place:'port',companion:'',journals:{},drafts:{},epoch:0};
const VISITOR_PLACES={port:{name:'来客星港',kind:'通行枢纽',desc:'穿过抵达大厅，霓虹航线延伸进城市。返乡通道只通向各自的原生世界。'},promenade:{name:'霓虹商贸街',kind:'商务与面基',desc:'会谈室、实体商铺与跨界企业聚集。线上杂货铺仍是线上平台；这里的实体生意另行发生。'},cafe:{name:'悬空咖啡馆',kind:'公共会面',desc:'在环城轨道旁找一张桌子，第一次把聊天框里的声音听在耳边。'},park:{name:'穹顶公园',kind:'城市日常',desc:'人造晨昏照过树梢，来客和当地居民在公共步道散步。'},residence:{name:'生活居住区',kind:'短住与定居',desc:'旅舍、住宅与社区服务让这颗星球也能成为长期生活的家。'}};
const VISITOR_WORLD_RULES=`【万界杂货铺与万界来客·世界规则】
万界法则禁止各个原生小世界彼此连通，防止强者前往普通小世界作威作福。弥隙星是一颗位于这项隔离法则灰色地带的高度发达赛博星球；「万界来客」仅为访问星球的APP名称。弥隙星允许不同世界的旅人抵达同一颗星球，但不能借此进入别人的原生世界；返乡只能返回自己的原生世界。
星球规则会把所有外来者的力量压制为普通人或略强于普通人的水平，大能也不得保留原世界的压倒性力量或用化身、法器、代理等方式绕过限制，因此这里至今安详。来客以做生意和面基为主，也有人定居、结婚生子、度过一生。外来男性与外来女性都可以来访弥隙星，限制针对育成设施的准入，不按性别限制星球入境。
星球普通原住公民诞生于母星自带的人造子宫：这是一座巨型育成与教育建筑，原住民从出生到大学毕业都在其中生活，毕业后进入星球各行业工作，福利待遇极佳。外来男性不得靠近或进入这座设施，不能通过赴约、找工作、伪装居民或邀请绕过限制。外来女性在得到母星许可后可以进入参观，未获许可不得进入。准入以明确填写的身份资料与母星许可记录为准，不能仅凭角色台词获得许可。设施不是约会地点。成年居民在设施之外正常生活；不得把设施内的未成年人安排为恋爱对象。
星球规则使原本存在生殖隔离的物种（例如鲛人与人）以及生育艰难的修真界大能都能正常生育；生育不会自动发生，须尊重人物意愿与用户明确推进。为防利用规则骗婚，在弥隙星出生的孩子终生只能留在这颗星球，不能被父母、法术或任何通道带往其他世界。不得暗示孩子获得任何跨界例外。
外来者彼此可以在此结婚生子。外来者与本地居民的婚育组合只允许外来女性与本地男性；本地女性终生不婚不育，在本人自愿的前提下可以谈恋爱。不得以恋爱剧情、特殊身份或能力改写这条规则。出生于这里的外来者子女同样受星球边界约束，不擅自设定必须交由原住民育成设施抚养。
万界杂货铺完全存在于线上：商品页、收物应单、留言、交易、加好友均为远程操作；商品通过跨界物流或物品传送交付，人不随包裹抵达。不得描写用户与卖家当面站立、靠近、触碰、递手中物品。加好友只建立线上通讯，不产生同处关系。
万界来源好友不能通过普通“见面”进入用户或对方原生世界，只能通过万界来客APP进入弥隙星。普通同世界好友沿用原有线下见面。聊天提及见面仅显示可选入口，必须由用户点击才改变场景。入境、当前位置、同行者与返乡以程序保存的状态为准，旧聊天中误写的面对面动作不构成真实见面。关闭页面不自动推进重大人生事件。`;
const visitorsBusy=new Set();
function visitorEnsure(){S.visitors||=structuredClone(DEFAULTS.visitors);S.visitors.epoch||=0;S.visitors.journals||={};S.visitors.drafts||={};if(!VISITOR_PLACES[S.visitors.place]&&S.visitors.place!=='incubator')S.visitors.place='port';return S.visitors}
function visitorIsChar(c){return !!(c?.marketOrigin||c?.marketPersonId||c?.visitorOrigin)}
function visitorIsThread(T){return !!T?.members?.some(id=>visitorIsChar(charById(id)))}
function visitorRoute(T){return visitorIsThread(T)?'visitors':'story'}
function visitorSave(){return save('visitors')}
function visitorJournal(cid){const V=visitorEnsure();return V.journals[cid||'solo']||=([])}
function visitorInit(){
 visitorEnsure();
 if(!S.home.visitorsV1){if(!S.home.pages.flat().some(x=>x.app==='visitors'))S.home.pages.at(-1).push({id:uid(),type:'app',app:'visitors'});S.home.visitorsV1=true;save('home')}
 if(!S.world.books.some(b=>/^builtin:visitors-v[12]$/.test(b.src))){S.world.books.push({id:uid(),name:'万界法则 · 杂货铺与来客星球',src:'builtin:visitors-v1',enabled:true,entries:[{id:uid(),keys:['万界','杂货铺','来客','跨界','星球'],content:VISITOR_WORLD_RULES,constant:false,enabled:true,comment:'平台边界与星球规则',order:100}]});save('world')}
}
function visitorChatRules(T,mode){
 if(!visitorIsThread(T))return '';
 const V=visitorEnsure(),history=T.members.flatMap(id=>visitorJournal(id).filter(m=>!T.resetAt||m.at>=T.resetAt).slice(-6)).slice(-8).map(m=>`${m.role==='event'?'场景':m.role==='user'?S.user.name:'对方'}：${m.text}`).join('\n');
 return '\n'+VISITOR_WORLD_RULES+'\n【此刻通讯】'+(mode==='online'?'当前仍是手机线上消息；即使已在来客星球，也只是在通过手机联系，不得直接产生身体接触。':'跨界好友的面对面剧情只能在万界来客 APP 内进行，不得写到原生世界。')+'\n星球状态：'+(V.inside?'用户已在'+VISITOR_PLACES[V.place].name:'用户未在来客星球内')+'。同行者：'+(charById(V.companion)?.name||'无')+'。\n【万界来客中已发生的最近经历，仅供记忆，不改变当前线上场景】\n'+history;
}
function visitorMeetingHTML(T){
 const last=T.msgs.filter(m=>m.mode==='online'&&['user','assistant'].includes(m.role)&&(!T.resetAt||m.ts>=T.resetAt)).slice(-4);
 const mentioned=last.filter(m=>/(见面|面基|赴约|约会|碰面|当面|一起吃|一起喝|meet(?:\s+up)?|date)/i.test(m.content||'')).at(-1);
 const mentions=mentioned&&!/(不想|不要|不方便|不能|不打算|别|取消|拒绝).{0,8}(见面|面基|赴约|约会|碰面|meet|date)|(见面|面基|约会).{0,6}(取消|算了)|(?:do not|don't|cannot|can't).{0,12}(meet|date)/i.test(mentioned.content||'');
 if(!mentions)return '';
 const cross=visitorIsThread(T);return `<div class="visitor-invite"><b>${cross?'跨界赴约 · 万界来客':'线下见面'}</b><p>${cross?'在来客星球会面，各自的原生世界仍然隔离。':'继续到原有的线下见面场景。'} 点击后才进入。</p><button class="btn" data-visitor="meet" data-tid="${esc(T.id)}">${cross?'前往万界来客':'进入线下见面'}</button></div>`;
}
async function visitorMeet(tid){
 const T=S.threads.find(t=>t.id===tid);if(!T)return;
 S.state.cur=T.id;await save('state');
 if(!visitorIsThread(T)){openApp('story');return}
 if(isGroup(T)){openApp('visitors');toast('先在来客名单里选择一位同行者');return}
 await visitorEnter(T.members[0]);openApp('visitors');
}
async function visitorEnter(cid=''){
 const c=charById(cid);if(cid&&(!c||!visitorIsChar(c)))throw Error('请从万界来源联系人中选择同行者');
 const V=visitorEnsure();if(visitorsBusy.size)throw Error('等当前剧情写完，再切换同行或返乡');
 const previous=V.companion,wasInside=V.inside;V.inside=true;V.companion=c?.id||'';V.epoch++;
 if(previous&&previous!==V.companion)visitorJournal(previous).push({role:'event',text:'本次同行结束。',at:Date.now()});
 visitorJournal(V.companion).push({role:'event',text:(wasInside?'用户主动开始新的同行':'用户主动进入万界来客')+'，地点：'+VISITOR_PLACES[V.place].name+'。'+(c?'同行者：'+c.name+'；仅在这颗星球会面。':'独自探索城市。'),at:Date.now()});
 await visitorSave();visitorRender();
}
function visitorButton(a,label,extra=''){return `<button class="btn" data-visitor="${a}" ${extra}>${esc(label)}</button>`}
function visitorRender(){
 const root=$('#visitorsBody');if(!root)return;const V=visitorEnsure(),c=charById(V.companion),busy=visitorsBusy.size>0,people=S.chars.filter(visitorIsChar),logs=visitorJournal(V.companion),place=VISITOR_PLACES[V.place];
 root.innerHTML=`<div class="visitor-hero"><span class="visitor-orbit">✧</span><small>跨世界会面 · 赛博母星</small><h2>万界来客</h2><p>各自世界之外，也有一处可以相见的地方。</p><span class="visitor-tag">${V.inside?'已入境 · '+esc(place.name):'尚未入境'}</span></div><details class="visitor-rules"><summary>星球法则与居民生活</summary><div>${esc(VISITOR_WORLD_RULES)}</div></details><section class="visitor-panel"><h3>${V.inside?'当前同行与行程':'选择你的第一段旅程'}</h3><label>万界来客<select id="visitorCompanion" ${busy?'disabled':''}><option value="">独自探索</option>${people.map(p=>`<option value="${esc(p.id)}" ${c?.id===p.id?'selected':''}>${esc(p.name)} · ${esc(p.marketOrigin?.world||p.visitorOrigin?.world||'万界来源')}</option>`).join('')}</select></label><div class="btns">${visitorButton('enter',V.inside?'开始所选同行':'确认入境',busy?'disabled':'')}${V.inside?visitorButton('leave','结束旅程 · 返回原生世界',busy?'disabled':''):''}</div>${!people.length?'<p class="hint">在万界杂货铺添加好友后，对方会出现在这里。你也可以先独自入境。</p>':''}</section>${V.inside?`<section class="visitor-districts">${Object.entries(VISITOR_PLACES).map(([id,p])=>`<button class="visitor-place ${id===V.place?'selected':''}" data-visitor="place" data-place="${id}" ${busy?'disabled':''}><small>${esc(p.kind)}</small><b>${esc(p.name)}</b><span>${esc(p.desc)}</span></button>`).join('')}<div class="visitor-restricted"><b>母星人造子宫综合体</b><p>原住公民的育成与教育设施，生活延续至大学毕业。外来客人不得接近；此处不提供进入按钮。</p></div></section><section class="visitor-panel"><h3>${esc(place.name)} · ${c?esc(c.name):'独自旅行'}</h3><div class="visitor-log">${logs.map(m=>m.role==='event'?`<p class="visitor-event">${esc(m.text)}</p>`:`<div class="visitor-message ${m.role==='user'?'mine':''}"><b>${esc(m.role==='user'?S.user.name:m.name||'星球见闻')}</b><p>${esc(m.text)}</p></div>`).join('')}</div><label>写下行动或对话<textarea id="visitorInput" placeholder="走进街区、和同行者说句话，或者看看这座城市…" ${busy?'disabled':''}>${esc(V.drafts[V.companion||'solo']||'')}</textarea></label><div class="btns">${visitorButton('send',busy?'故事正在继续…':'继续这段旅程',busy?'disabled':'')}</div><p class="hint">推进剧情会使用当前 AI 接口。只在你点击时续写，书写内容与旅程保存在当前设备，也包含在完整备份里。</p></section>`:''}`;
}
function visitorMessages(V,c,text){
 const T=c?threadOf(c.id):null,online=T?T.msgs.filter(m=>m.mode==='online'&&['user','assistant'].includes(m.role)).slice(-10).map(m=>`${m.role==='user'?S.user.name:c.name}：${m.content}`).join('\n'):'';
 const logs=visitorJournal(V.companion).filter(m=>!T?.resetAt||m.at>=T.resetAt).slice(-24).map(m=>({role:m.role==='assistant'?'assistant':'user',content:(m.role==='event'?'[已确认场景] ':'')+m.text}));
 return [{role:'system',content:VISITOR_WORLD_RULES+'\n【已确认当前场景】用户已入境；地点：'+VISITOR_PLACES[V.place].name+'；同行者：'+(c?.name||'无，用户独自旅行')+'。'+(c?'你扮演这位成年同行者，并描写当前城市环境。\n'+cardBlock(c):'你描写城市日常和公共场所的成年居民。不得擅自增加已确立的恋爱关系。')+'\n世界书补充：'+worldInfo('万界来客','')+'\n用户设定：'+(S.user.persona||'未设置')+'\n最近线上联系仅供背景，不改变当前地点：\n'+online+'\n用小说式中文叙述，约'+(S.settings.storyLength||400)+'字。不替用户说话、决定行动、同意婚育或改变地点。只写正文，不输出支付、背包、通行或家庭状态指令。'},...logs,{role:'user',content:text||'看看此刻身边的城市与同行者，让故事自然继续。'}];
}
async function visitorGenerate(){
 const V=visitorEnsure();if(!V.inside)throw Error('先确认入境');if(visitorsBusy.size)return;
 const cid=V.companion,c=charById(cid),key=cid||'solo',text=(V.drafts[key]||'').trim(),logs=visitorJournal(cid),epoch=V.epoch;
 if(!ownAPI(c)&&!apiReady())throw Error('先在设置或同行者角色页填写 AI 接口');
 const messages=visitorMessages(V,c,text);visitorsBusy.add(key);visitorRender();
 try{const out=clean(await callAPI(messages,{char:c||undefined,max_tokens:1800,temperature:.9}));if(S.visitors!==V||V.epoch!==epoch||!V.inside)return;if(!out)throw Error('这次没有生成正文，输入已保留');if(text)logs.push({role:'user',text,at:Date.now()});logs.push({role:'assistant',text:out,name:typeof visitorCoPresent==='function'&&!visitorCoPresent(V)?'弥隙星见闻':c?.name||'星球见闻',at:Date.now()});V.drafts[key]='';await visitorSave()}
 finally{visitorsBusy.delete(key);if(S.visitors===V)visitorRender()}
}
document.addEventListener('click',async e=>{const el=e.target.closest('[data-visitor]');if(!el||el.disabled)return;try{
 const a=el.dataset.visitor,V=visitorEnsure();
 if(a==='meet')return await visitorMeet(el.dataset.tid);
 if(visitorsBusy.size)return;
 if(a==='enter')await visitorEnter($('#visitorCompanion').value);
 if(a==='leave'){visitorJournal(V.companion).push({role:'event',text:'同行结束，各自返回自己的原生世界。孩子不能随返乡通道离开星球。',at:Date.now()});V.inside=false;V.companion='';V.epoch++;await visitorSave();visitorRender()}
 if(a==='place'){if(!V.inside||!VISITOR_PLACES[el.dataset.place])return;V.place=el.dataset.place;V.epoch++;visitorJournal(V.companion).push({role:'event',text:'用户主动前往 '+VISITOR_PLACES[V.place].name+'。',at:Date.now()});await visitorSave();visitorRender()}
 if(a==='send')await visitorGenerate();
 }catch(err){toast(err.message||String(err),5000)}});
document.addEventListener('input',e=>{if(e.target.id==='visitorInput'){const V=visitorEnsure();V.drafts[V.companion||'solo']=e.target.value;visitorSave().catch(err=>toast(err.message,5000))}});
