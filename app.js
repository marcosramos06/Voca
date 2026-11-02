/* ---------- state ---------- */
const KEY="voca-v1",IV=[0,1,3,7,16,35,80],NEW_DAY=8,GOAL_C=15,GOAL_T=6;
const blank=()=>({v:1,updated:0,lead:"auto",lisbon:"2027-06-01",cards:{},custom:[],log:{},errs:{},slow:false,auto:false,ff:{r:0,t:0}});
let S=blank();
try{const l=localStorage.getItem(KEY);if(l)S={...blank(),...JSON.parse(l)}}catch(e){}
const pad=n=>String(n).padStart(2,"0");
const dayKey=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const dayNum=k=>{const[y,m,d]=k.split("-").map(Number);return Date.UTC(y,m-1,d)/864e5};
const today=()=>dayKey();
const lg=()=>{const k=today();return S.log[k]||(S.log[k]={c:0,t:0,n:0})};
const lead=()=>S.lead==="auto"?(today()>="2027-05-01"?"pt":"br"):S.lead;
const other=v=>v==="br"?"pt":"br";
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $=s=>document.querySelector(s);

function save(){S.updated=Date.now();try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}

/* ---------- speech ---------- */
let voices=[];
function loadVoices(){try{voices=speechSynthesis.getVoices()||[]}catch(e){voices=[]}}
if("speechSynthesis" in window){loadVoices();try{speechSynthesis.onvoiceschanged=()=>{loadVoices();if(tab==="sons")render()}}catch(e){}}
const voiceFor=v=>{const t=v==="pt"?"pt-pt":"pt-br";return voices.find(x=>x.lang.toLowerCase().replace("_","-")===t)};
function speak(text,v){if(!("speechSynthesis" in window)){toast("This browser has no speech voices.");return}
  try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=v==="pt"?"pt-PT":"pt-BR";const vc=voiceFor(v);if(vc)u.voice=vc;u.rate=S.slow?.72:.95;speechSynthesis.speak(u)}catch(e){toast("Audio could not play here.")}}
const ICON='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.5h2.5L9 2.5v11l-3.5-3H3zM11 5a4 4 0 0 1 0 6l-.9-.9a2.7 2.7 0 0 0 0-4.2z"/></svg>';
const say=(t,v)=>`<button class="say" data-act="say" data-t="${esc(t)}" data-v="${v}" aria-label="Listen in ${v==="pt"?"Portugal":"Brazil"} Portuguese: ${esc(t)}" title="${v==="pt"?"Portugal":"Brazil"} voice">${ICON}</button>`;

/* forms: both varieties, with the lead one first */
function forms(br,pt,audio=true){
  if(!pt||pt===br)return `<div class="forms"><div class="line">${audio?say(br,lead()):""}<span><span class="chip both">BR+PT</span>${esc(br)}</span></div></div>`;
  const a=lead(),b=other(a),m={br,pt};
  const row=(v,c)=>`<div class="line ${c}">${audio?say(m[v],v):""}<span><span class="chip ${v}">${v.toUpperCase()}</span>${esc(m[v])}</span></div>`;
  return `<div class="forms">${row(a,"")}${row(b,"sec")}</div>`;
}

/* ---------- grading ---------- */
const strip=s=>s.normalize("NFD").replace(/[̀-ͯ]/g,"");
const clean=s=>s.toLowerCase().normalize("NFC").replace(/[.,!?¿¡…"“”]/g," ").replace(/\s+/g," ").trim();
const core=s=>clean(s).replace(/^(eu|o|a|os|as|um|uma|to) /,"");
function grade(ans,accepted){const a=core(ans);if(!a)return "bad";
  const list=accepted.filter(Boolean).map(core);
  if(list.includes(a))return "good";
  if(list.map(strip).includes(strip(a)))return "accent";
  return "bad"}

/* ---------- spaced review ---------- */
const all=()=>CARDS.concat(S.custom||[]);
const st=id=>S.cards[id]||{b:0,d:0};
function queue(){const t=dayNum(today()),cs=all();
  const due=cs.filter(c=>{const s=st(c.id);return s.b>0&&s.d<=t}).sort((a,b)=>st(a.id).d-st(b.id).d);
  const room=Math.max(0,NEW_DAY-lg().n);
  const fresh=cs.filter(c=>st(c.id).b===0).sort((a,b)=>(b.custom?1:0)-(a.custom?1:0)).slice(0,room);
  return due.concat(fresh)}
function mark(c,right){const t=dayNum(today()),s=st(c.id);
  if(s.b===0)lg().n++;
  S.cards[c.id]=right?{b:Math.min(s.b+1,6),d:t+IV[Math.min(s.b+1,6)]}:{b:1,d:t};
  lg().c++;save()}
let R=null;
function startReview(){const q=queue();if(!q.length){toast("Nothing is due. Come back tomorrow, or have a conversation.");return}
  R={q:q.slice(0,GOAL_C+5),i:0,done:0,right:0,rev:null,val:""};render();focusCard()}
const focusCard=()=>setTimeout(()=>$("#card-input")?.focus(),0);
function checkCard(){const c=R.q[R.i],v=$("#card-input").value;R.val=v;
  const g=grade(v,[c.br,c.pt].concat(c.alt||[]));const prev={...st(c.id)},seen=lg().n;
  mark(c,g!=="bad");if(g!=="bad")R.right++;else R.q.push(c);
  R.rev={g,prev,seen};R.done++;render();setTimeout(()=>$("#next-card")?.focus(),0)}
function overrideCard(){const c=R.q[R.i];S.cards[c.id]=R.rev.prev;lg().n=R.rev.seen;mark(c,true);lg().c--;R.q.pop();R.right++;R.rev.g="good";R.rev.over=true;save();render()}
function nextCard(){R.i++;R.rev=null;R.val="";if(R.i>=R.q.length){R={summary:true,right:R.right,done:R.done}}render();focusCard()}

/* ---------- AI ---------- */
const ai=Promise.resolve(sample);
const errCopy=e=>{switch(e&&e.code){
 case"offline":return "You're offline. Cards, Ponte and Sons still work. Reconnect to talk to your partner.";
 case"needs_passcode":return "Enter your app passcode to turn on the partner.";
 case"bad_passcode":return "That passcode doesn't match. Update it in Hoje, under Settings.";
 case"not_configured":return "The server isn't set up yet. Add ANTHROPIC_API_KEY and APP_PASSCODE in Vercel, then redeploy.";
 case"rate_limited":return "You've hit a usage limit for now. Try again in a little while.";
 case"too_large":return "That was too long. Restart the scene or paste less text.";
 case"invalid_json":return "That reply came back unreadable. Press Send again.";
 case"refused":return "Claude declined that message. Try rewording it.";
 default:return "The connection dropped. Press Send again."}};

const C={sc:"intro",accent:null,turns:[],busy:false,ctl:null,draft:"",debrief:"",dbBusy:false,err:"",custom:""};
const sc=()=>SCENARIOS.find(s=>s.id===C.sc);
const accent=()=>C.accent||lead();
function startScenario(id){C.sc=id;C.turns=[{role:"assistant",content:sc()[accent()]}];C.debrief="";C.err="";}
startScenario("intro");
function rulesText(){const s=sc(),pt=accent()==="pt";
  const top=Object.entries(S.errs||{}).sort((a,b)=>b[1]-a[1]).slice(0,2).map(e=>ERR[e[0]]).filter(Boolean).join(", ");
  return `You are a speaking partner in a role-play for Marcos, a young man who speaks English and Spanish and is around A2 in Portuguese. He is taking a Brazilian-based Portuguese class and will study in Lisbon next summer. He is typing or dictating, so ignore capitalization and missing punctuation.
Role: ${s.who}.${C.sc==="livre"&&C.custom?` Topic he chose: ${C.custom.slice(0,200)}.`:""}
Speak ${pt?"European Portuguese as heard in Lisbon: tu with second-person verbs, estar a + infinitive, pronouns after the verb in affirmative sentences, Portugal vocabulary and AO90 spelling":"Brazilian Portuguese: você, the gerund, pronouns before the verb, Brazil vocabulary"}.
Reply in 1 to 3 short sentences at A2 to B1 level, stay in character, and end with a question or something he must react to. Never switch to English or Spanish in "reply".
Check his latest message. Give at most 2 fixes, choosing what matters most for being understood and sounding natural. Skip tiny accent slips unless they change the word.${top?` His recent weak areas: ${top}.`:""}
If he used a Spanish or English word, give him the Portuguese word as a fix. Forms valid in Brazil or Portugal are never errors, even when they mismatch the speaking variety: note the other country's form in "variety" instead.
Reply with only this JSON:
{"reply":"your line in Portuguese","en":"its English translation","fixes":[{"said":"his exact words","better":"corrected form in the speaking variety","other":"the same fix in the other variety, or empty if identical","why":"one short English sentence, comparing with Spanish when Spanish caused it","tag":"spanish|gender|verb|prep|vocab|spelling"}],"variety":"one short English note on how the other country says something he used, or empty","try":["a short possible next line for him","another"]}`}
async function sendChat(){const box=$("#chat-input"),text=(box?.value||"").trim();if(!text||C.busy)return;
  const sample=await ai;
  C.turns.push({role:"user",content:text});C.draft="";C.err="";C.busy=true;C.ctl=new AbortController();lg().t++;save();box.value="";renderChat();
  try{const hist=C.turns.slice(-14).map(t=>({role:t.role,content:t.content}));
    const d=await sample.json([{role:"user",content:rulesText()},...hist],{modelTier:"quick",cache:false,signal:C.ctl.signal});
    if(!d||typeof d.reply!=="string"||!d.reply.trim())throw{code:"invalid_json"};
    const fixes=Array.isArray(d.fixes)?d.fixes.filter(f=>f&&f.better).slice(0,2):[];
    fixes.forEach(f=>{const t=ERR[f.tag]?f.tag:"vocab";S.errs[t]=(S.errs[t]||0)+1});
    const u=C.turns[C.turns.length-1];u.fixes=fixes;u.variety=typeof d.variety==="string"?d.variety:"";
    C.turns.push({role:"assistant",content:d.reply,en:String(d.en||""),tries:Array.isArray(d.try)?d.try.slice(0,3).map(String):[]});
    save();if(S.auto)speak(d.reply,accent());
  }catch(e){if(e&&e.code==="cancelled"){C.err=""}else C.err=errCopy(e);C.turns.pop();C.draft=text;lg().t=Math.max(0,lg().t-1);save()}
  C.busy=false;C.ctl=null;renderChat();$("#chat-input")?.focus()}
async function debrief(){const sample=await ai;
  const lines=C.turns.filter(t=>t.role==="user");if(!lines.length){toast("Send a message first.");return}
  C.dbBusy=true;C.debrief="Thinking...";renderChat();
  const data=lines.map(t=>`- ${t.content}${(t.fixes||[]).map(f=>`\n  fix: ${f.said} -> ${f.better}`).join("")}`).join("\n").slice(0,6000);
  try{await sample(`A Portuguese learner (A2, Spanish speaker) just finished a role-play: ${sc().t}. Variety: ${accent()==="pt"?"Portugal":"Brazil"}. His lines and fixes:\n${data}\n\nWrite feedback in plain English with no markdown, in exactly three short lines:\nWent well: one specific thing.\nFix next: the single most useful pattern to work on.\nReuse: one natural Portuguese sentence he should use next time.`,{onText:({text})=>{C.debrief=text;const el=$("#debrief");if(el)el.textContent=text}})}
  catch(e){C.debrief=e&&e.text?e.text:errCopy(e)}
  C.dbBusy=false;renderChat()}
function addFix(i,j){const f=C.turns[i].fixes[j];const id="f"+Date.now();
  S.custom.push({id,fix:true,custom:true,en:f.said||"(fix this)",es:"",br:f.other&&accent()==="pt"?f.other:f.better,pt:accent()==="pt"?f.better:(f.other||""),note:f.why||"",tag:"mine",alt:[f.better]});
  f.added=true;save();renderChat();toast("Added to your cards")}
async function importClass(){const box=$("#import-text"),text=(box?.value||"").trim();if(!text)return;
  const sample=await ai;
  const btn=$("#import-btn");btn.disabled=true;btn.textContent="Building cards...";
  try{const d=await sample.json(`Turn this Portuguese class material into flashcards for an English and Spanish speaker. His class is Brazilian-based and he will live in Lisbon. Use at most 30 cards, one per useful word or phrase. If the text describes a grammar topic, write short example sentences.
Reply with only a JSON array of {"en":"English prompt","es":"Spanish equivalent","br":"Brazilian Portuguese","pt":"European Portuguese, or empty if identical","note":"short tip, or empty"}. Use AO90 spelling.

Material:
${text.slice(0,6000)}`,{modelTier:"default"});
    if(!Array.isArray(d))throw{code:"invalid_json"};
    const seen=new Set(all().map(c=>clean(c.br)));let n=0;
    d.slice(0,30).forEach((x,i)=>{if(!x||!x.en||!x.br||seen.has(clean(x.br)))return;seen.add(clean(x.br));
      S.custom.push({id:"c"+Date.now()+i,custom:true,en:String(x.en),es:String(x.es||""),br:String(x.br),pt:String(x.pt||""),note:String(x.note||""),tag:"class",alt:[]});n++});
    save();box.value="";toast(n?`Added ${n} cards. They come up first.`:"Those words are already in your deck.");render();
  }catch(e){toast(errCopy(e));btn.disabled=false;btn.textContent="Build cards"}}

/* ---------- views ---------- */
const TABS=[["hoje","Hoje","Today"],["conversa","Conversa","Speak"],["cartoes","Cartões","Recall"],["ponte","Ponte","Bridges"],["sons","Sons","Sounds"]];
let tab="hoje",pSeg="es",restoreArmed=false;
const fromHash=()=>{const h=location.hash.slice(1);return TABS.some(t=>t[0]===h)?h:"hoje"};
tab=fromHash();
window.addEventListener("hashchange",()=>{tab=fromHash();render();scrollTo(0,0)});
function renderChrome(){
  $("#nav").innerHTML=TABS.map(t=>`<a href="#${t[0]}" ${t[0]===tab?'aria-current="page"':""}>${t[1]}<span>${t[2]}</span></a>`).join("");
  const opts=[["auto",`Auto (${today()>="2027-05-01"?"Portugal":"Brasil"})`],["br","Brasil"],["pt","Portugal"]];
  $("#lead-seg").innerHTML=opts.map(o=>`<button data-act="lead" data-v="${o[0]}" aria-pressed="${S.lead===o[0]}">${o[1]}</button>`).join("")}

function hoje(){const h=new Date().getHours(),hi=h<12?"Bom dia":h<19?"Boa tarde":"Boa noite";
  const cs=all(),lv=cs.map(c=>Math.min(st(c.id).b,5)),mast=lv.filter(x=>x>=5).length,learn=lv.filter(x=>x>0&&x<5).length;
  const q=queue(),l=lg(),dT=dayNum(S.lisbon||"2027-06-01")-dayNum(today());
  const dayI=dayNum(today()),br=BRIDGES[dayI%BRIDGES.length],sn=SCENARIOS[dayI%(SCENARIOS.length-1)];
  const tiles=lv.map(x=>`<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#t${x}"/></svg>`).join("");
  const days=[...Array(14)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-13+i);const k=dayKey(d),o=S.log[k];return `<i class="${o&&(o.c||o.t)?"on":""} ${i===13?"now":""}" title="${k}"></i>`}).join("");
  const t=today(),ph=[["Now to January","Build the bridge","Sound rules, false friends and core words. Use the 102 forms first.",t<"2027-01-01"],
   ["PORTUGUE 102","Keep up in class","Your class runs entirely in Portuguese. Paste each week's vocabulary into Cartões and rehearse in Aula de Português.",t>="2027-01-01"&&t<"2027-05-01"],
   ["May to departure","Switch your ear","Portugal forms move to the top. Practice with the Lisbon voice, tu, and the swallowed vowels.",t>="2027-05-01"&&t<S.lisbon],
   ["Em Lisboa","Use it for real","Rehearse a scene here, then go do it at the pastelaria that day.",t>=S.lisbon]];
  const errs=Object.entries(S.errs||{}).sort((a,b)=>b[1]-a[1]),max=errs[0]?errs[0][1]:1;
  return `<section class="hero">
    <div class="stack"><h1>${hi}, Marcos.</h1>
      <p class="muted">${dT>0?`<b>${dT} days</b> to Lisbon, based on the date below.`:"You're in Lisbon. Boa sorte."} Today's session takes about 15 minutes.</p>
      <div class="row"><a class="btn" href="#cartoes" style="text-decoration:none">Recall ${Math.min(q.length,GOAL_C)} cards</a><a class="btn ghost" href="#conversa" style="text-decoration:none">Start speaking</a></div></div>
    <div class="stack"><div class="wall" role="img" aria-label="${mast} of ${cs.length} tiles complete">${tiles}</div>
      <div class="legend"><span><b>${mast}</b> complete</span><span><b>${learn}</b> in progress</span><span><b>${cs.length-mast-learn}</b> empty</span><span>Each tile is one word or phrase.</span></div></div>
  </section>
  <div class="grid2">
   <section class="card"><h2>Hoje</h2>
    <div class="step" style="margin-top:6px"><div class="tick ${l.c>=GOAL_C?"on":""}">${l.c>=GOAL_C?"✓":""}</div><div><b>Recall ${GOAL_C} cards</b><div class="muted small">${l.c} done today. You type the Portuguese from memory.</div></div><a class="btn tiny ghost" href="#cartoes" style="text-decoration:none">Open</a></div>
    <div class="step"><div class="tick ${l.t>=GOAL_T?"on":""}">${l.t>=GOAL_T?"✓":""}</div><div><b>Say ${GOAL_T} things in a conversation</b><div class="muted small">${l.t} sent today. Suggested scene: ${esc(sn.t)}.</div></div><button class="btn tiny ghost" data-act="go-scene" data-id="${sn.id}">Open</button></div>
    <div class="step"><button class="tick ${l.b?"on":""}" data-act="bridge" aria-label="Mark today's bridge as read" aria-pressed="${!!l.b}" style="background-color:${l.b?"":"transparent"}">${l.b?"✓":""}</button><div class="stack" style="gap:5px"><b>Today's bridge: ${esc(br.t)}</b>
      <div class="small"><span class="chip es">ES</span>${esc(br.es)}</div><div class="small">${forms(br.br,br.pt||"")}</div><div class="muted small">${esc(br.n)}</div></div><span></span></div>
   </section>
   <div class="stack" style="gap:20px">
    <section class="card stack"><div class="row between"><h3>Last 14 days</h3></div><div class="days">${days}</div>
      <h3 style="margin-top:6px">What trips you up</h3>
      ${errs.length?errs.slice(0,5).map(e=>`<div class="bar"><span>${ERR[e[0]]||e[0]}</span><span style="text-align:right">${e[1]}</span><div class="track"><i style="width:${Math.round(e[1]/max*100)}%"></i></div></div>`).join(""):`<p class="muted small">Your conversation corrections build this chart, and your partner uses it to focus on your weak spots.</p>`}
    </section>
   </div>
  </div>
  <section class="card"><h2>The road to Lisbon</h2><div style="margin-top:8px">${ph.map(p=>`<div class="phase ${p[3]?"now":""}"><span class="eyebrow">${p[0]}</span><div><b>${p[1]}.</b> <span class="muted">${p[2]}</span></div></div>`).join("")}</div></section>
  <section class="card stack"><h3>Settings</h3>
    <div class="grid-eq"><label class="stack" style="gap:4px"><span class="small muted">Lisbon arrival. June 1 is a placeholder, so set your real date.</span><input type="date" id="lisbon-date" value="${esc(S.lisbon)}"></label>
    <div class="small muted">Forms: "Auto" shows Brasil first until May 1, 2027, then Portugal first.</div></div>
    <div class="grid-eq" style="margin-top:6px">
     <div class="stack" style="gap:6px"><label for="pass-settings"><b>App passcode</b></label><p class="small muted">It connects this phone to your server. It's stored only on this device.</p><div class="row"><input type="password" id="pass-settings" autocomplete="off" value="${esc(getPass())}" style="flex:1;min-width:0"><button class="btn tiny" data-act="save-pass" data-src="pass-settings">Save and test</button></div></div>
     <div class="stack" style="gap:6px"><label for="backup-text"><b>Backup</b></label><p class="small muted">Progress lives only on this device. Copy a backup now and then, and paste it to restore or move to a new phone.</p><textarea id="backup-text" rows="2" autocomplete="off" spellcheck="false" placeholder="Backup text appears here"></textarea><div class="row"><button class="btn tiny ghost" data-act="backup">Copy backup</button><button class="btn tiny ghost" data-act="restore">${restoreArmed?"Tap again to replace this device's progress":"Restore"}</button></div></div>
    </div></section>`}

function conversaView(){const dictation=`Speak instead of typing: tap the microphone on your iPhone keyboard, with Portuguese added as a keyboard language.`;
  return `<div class="grid2 convo">
   <aside class="stack">
    <div class="card stack" style="padding:12px"><div class="row between"><span class="eyebrow">Accent</span>
       <div class="seg" role="group" aria-label="Partner accent"><button data-act="accent" data-v="br" aria-pressed="${accent()==="br"}">Brasil</button><button data-act="accent" data-v="pt" aria-pressed="${accent()==="pt"}">Lisboa</button></div></div>
     <div class="sc-list">${SCENARIOS.map(s=>`<button class="sc" data-act="scene" data-id="${s.id}" aria-pressed="${s.id===C.sc}"><b>${esc(s.t)}</b><span>${esc(s.s)}</span></button>`).join("")}</div>
     ${C.sc==="livre"?`<input type="text" id="free-topic" placeholder="Topic, such as music or Boston" value="${esc(C.custom)}" aria-label="Conversation topic">`:""}
    </div>
    <div class="card" style="padding:12px"><div class="eyebrow" style="margin-bottom:6px">Useful phrases</div>${sc().ph.map(p=>`<div class="phrase"><div class="small muted">${esc(p[0])}</div>${forms(p[1],p[2])}</div>`).join("")}</div>
   </aside>
   <section class="chat" aria-label="Conversation">
    <div class="msgs" id="msgs" aria-live="polite"></div>
    <div class="composer">
      ${getPass()?"":`<div class="notice stack" style="gap:7px"><label for="pass-inline">Enter your app passcode to turn on the partner.</label><div class="row"><input type="password" id="pass-inline" autocomplete="off" style="flex:1;min-width:0"><button class="btn tiny" data-act="save-pass" data-src="pass-inline">Save</button></div></div>`}
      <div id="chat-err" class="notice" hidden></div>
      <textarea id="chat-input" rows="2" placeholder="Responda em português. Stuck on a word? Write it in Spanish." aria-label="Your reply in Portuguese">${esc(C.draft)}</textarea>
      <div class="row between"><div class="row" id="chat-btns"></div>
        <label class="small muted row" style="gap:5px"><input type="checkbox" id="auto-say" ${S.auto?"checked":""}> Read replies aloud</label></div>
      <p class="small muted">${dictation}</p>
    </div>
   </section></div>`}
function renderChat(){const box=$("#msgs");if(!box)return;const a=accent();let h="";
  C.turns.forEach((t,i)=>{
   if(t.role==="assistant"){h+=`<div class="m a"><div class="line">${say(t.content,a)}<span>${esc(t.content)}</span></div>${t.en?`<details><summary>Translation</summary>${esc(t.en)}</details>`:""}</div>`;
     if(i===C.turns.length-1&&t.tries&&t.tries.length&&!C.busy)h+=`<div class="try">${t.tries.map(x=>`<button data-act="try" data-t="${esc(x)}">${esc(x)}</button>`).join("")}</div>`}
   else{h+=`<div class="m u">${esc(t.content)}</div>`;
     (t.fixes||[]).forEach((f,j)=>{h+=`<div class="fix">${f.said?`<s>${esc(f.said)}</s> → `:""}<strong>${esc(f.better)}</strong>${f.other&&f.other!==f.better?` <span class="chip ${other(a)}">${other(a).toUpperCase()}</span>${esc(f.other)}`:""}<div class="muted small">${esc(f.why||"")}</div>${f.added?`<span class="small muted">In your cards</span>`:`<button class="btn link small" data-act="add-fix" data-i="${i}" data-j="${j}">Add to my cards</button>`}</div>`});
     if(t.variety)h+=`<div class="note"><span class="chip ${other(a)}">${other(a).toUpperCase()}</span>${esc(t.variety)}</div>`}
  });
  if(C.turns.length===1&&!C.busy)h+=`<div class="eyebrow ex-tag">Example of a correction</div><div class="m u">Yo voy a comer con mi amigo</div><div class="fix"><s>Yo voy a comer</s> → <strong>Eu vou comer</strong><div class="muted small">Spanish carryover: ir takes no a before the verb.</div></div>`;
  if(C.busy)h+=`<div class="m a muted">Thinking...</div>`;
  if(C.debrief)h+=`<div class="notice" id="debrief" style="white-space:pre-wrap">${esc(C.debrief)}</div>`;
  box.innerHTML=h;box.scrollTop=box.scrollHeight;
  const e=$("#chat-err");if(e){e.hidden=!C.err;e.textContent=C.err}
  const b=$("#chat-btns");if(b)b.innerHTML=C.busy?`<button class="btn" data-act="stop">Stop</button>`:`<button class="btn" data-act="send">Send</button><button class="btn ghost" data-act="debrief" ${C.dbBusy?"disabled":""}>Finish and get feedback</button><button class="btn ghost" data-act="restart">Restart</button>`;
  const inp=$("#chat-input");if(inp&&C.draft&&!inp.value)inp.value=C.draft}

function cartoes(){let body="";
  if(R&&R.summary){body=`<section class="card flash stack"><h2>${R.right} of ${R.done} correct</h2><p class="muted">Missed words come back tomorrow. Now use a few out loud while they're fresh.</p><div class="row"><a class="btn" href="#conversa" style="text-decoration:none">Start speaking</a><button class="btn ghost" data-act="review">Review more</button></div></section>`}
  else if(R){const c=R.q[R.i],pct=Math.round(R.i/R.q.length*100),r=R.rev;
    body=`<section class="card flash stack"><div class="row between small muted"><span>Card ${R.i+1} of ${R.q.length}</span><button class="btn link small" data-act="quit">End session</button></div><div class="prog"><i style="width:${pct}%"></i></div>
    <div class="eyebrow">${c.fix?"Correct this sentence":c.tag==="class"?"From class":"Say it in Portuguese"}</div><div class="prompt">${esc(c.en)}</div>
    ${c.es?`<div class="muted"><span class="chip es">ES</span>${esc(c.es)}</div>`:""}
    <input type="text" id="card-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type it from memory" value="${esc(R.val)}" ${r?"disabled":""} aria-label="Your answer in Portuguese">
    ${r?`<div class="verdict ${r.g==="good"?"good":r.g==="accent"?"warn":"bad"}">${r.g==="good"?(r.over?"Counted as correct":"Certo!"):r.g==="accent"?"Right, but check the accents":"Not this time"}</div>${forms(c.br,c.pt)}${c.note?`<p class="muted small">${esc(c.note)}</p>`:""}
      <div class="row"><button class="btn" id="next-card" data-act="next">Next</button>${r.g==="bad"?`<button class="btn ghost" data-act="override">I was right</button>`:""}</div>`:`<div class="row"><button class="btn" data-act="check">Check</button><button class="btn ghost" data-act="check">I don't know</button></div>`}
    </section>`}
  else{const q=queue(),t=dayNum(today()),due=all().filter(c=>{const s=st(c.id);return s.b>0&&s.d<=t}).length;
    body=`<section class="card flash stack"><h2>Recall, don't recognize</h2><p class="muted">You type each answer from memory, which is harder than tapping choices and sticks better. Either country's form counts, and you always see both. Words return after 1, 3, 7, 16, 35 and 80 days.</p>
    <div class="legend"><span><b>${due}</b> due</span><span><b>${q.length-due}</b> new today</span><span><b>${all().length}</b> in deck</span></div>
    <div><button class="btn" data-act="review">Start review</button></div></section>`}
  const imp=`<section class="card flash stack"><h3>Add this week's class words</h3><p class="muted small">Paste a vocabulary list or a grammar topic from PORTUGUE 102. Claude adds the Lisbon form beside each Brazilian one, and your new cards come up first.</p>
   <textarea id="import-text" rows="4" placeholder="ônibus, pegar, celular&#10;or: preterite of ir, ser and fazer" aria-label="Class vocabulary or grammar topic"></textarea>
   <div><button class="btn ghost" id="import-btn" data-act="import">Build cards</button></div>
</section>`;
  return body+imp}

let FQ=null,PQ=null;
function nextFF(){const f=FALSE[Math.floor(Math.random()*FALSE.length)];const ds=FALSE.filter(x=>x!==f).sort(()=>Math.random()-.5).slice(0,2).map(x=>x[2]);FQ={f,opts:[f[2],...ds].sort(()=>Math.random()-.5),pick:null}}
function nextPQ(){const pool=RULES_ES.flatMap(r=>r.ex.map(e=>({es:e[0],pt:e[1],r:r.t}))).concat(GENDERS.map(e=>({es:e[0],pt:e[1],r:"Gender flips: use the Portuguese article",art:true})));PQ={...pool[Math.floor(Math.random()*pool.length)],res:null,val:""}}
function ponte(){if(!FQ)nextFF();if(!PQ)nextPQ();
 const seg=`<div class="seg" role="group" aria-label="Bridge type"><button data-act="pseg" data-v="es" aria-pressed="${pSeg==="es"}">From Spanish</button><button data-act="pseg" data-v="bp" aria-pressed="${pSeg==="bp"}">Brasil and Portugal</button></div>`;
 if(pSeg==="es"){return `<div class="stack"><h2>Your Spanish is a head start</h2><p class="muted" style="max-width:62ch">Most Spanish words reach Portuguese through regular sound changes. Learn the changes and you can guess thousands of words. Then learn where the guess fails.</p><div>${seg}</div></div>
 <div class="grid-eq">
  <section class="card stack"><div class="eyebrow">Predict the word</div><div class="prompt">${esc(PQ.es)}</div><input type="text" id="pq-input" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(PQ.val)}" aria-label="Portuguese word" ${PQ.res?"disabled":""}>
   ${PQ.res?`<div class="verdict ${PQ.res==="bad"?"bad":PQ.res==="accent"?"warn":"good"}">${PQ.res==="bad"?"Answer":PQ.res==="accent"?"Check the accent":"Certo!"}: ${esc(PQ.pt)}</div><div class="muted small">${esc(PQ.r)}</div><div><button class="btn" data-act="pq-next">Next word</button></div>`:`<div><button class="btn" data-act="pq-check">Check</button></div>`}</section>
  <section class="card stack"><div class="eyebrow">False friend check</div><div class="prompt">${esc(FQ.f[0])}</div><div class="muted small">In Spanish this looks like: ${esc(FQ.f[1])}. In Portuguese it means:</div>
   <div class="opts">${FQ.opts.map(o=>`<button data-act="ff-pick" data-v="${esc(o)}" class="${FQ.pick?(o===FQ.f[2]?"right":o===FQ.pick?"wrong":""):""}" ${FQ.pick?"disabled":""}>${esc(o)}</button>`).join("")}</div>
   ${FQ.pick?`<div class="muted small">${esc(FQ.f[3])}</div><div><button class="btn" data-act="ff-next">Next</button></div>`:""}<div class="small muted">${S.ff.r} of ${S.ff.t} correct so far</div></section>
 </div>
 <section class="stack"><h3>Eleven sound rules</h3><div class="grid-eq">${RULES_ES.map(r=>`<div class="card stack" style="gap:6px"><b>${esc(r.t)}</b><div class="pairs">${r.ex.map(e=>`<span><i>${esc(e[0])}</i> → ${esc(e[1])}</span>`).join("")}</div><div class="muted small">${esc(r.n)}</div></div>`).join("")}</div></section>
 <section class="card stack"><h3>Gender flips</h3><p class="muted small">These switch gender between the languages, including the bridge itself.</p><div class="pairs">${GENDERS.map(e=>`<span><i>${esc(e[0])}</i> → ${esc(e[1])}</span>`).join("")}</div></section>
 <section class="card stack"><h3>False friends</h3><div class="tablewrap"><table><thead><tr><th>Word</th><th>Spanish reader thinks</th><th>Portuguese means</th><th>What to use</th></tr></thead><tbody>${FALSE.map(f=>`<tr><td><b>${esc(f[0])}</b></td><td>${esc(f[1])}</td><td>${esc(f[2])}</td><td class="muted">${esc(f[3])}</td></tr>`).join("")}</tbody></table></div></section>`}
 const diff=CARDS.filter(c=>c.pt&&c.pt!==c.br&&["city","food","tech","school","sport","talk"].includes(c.tag));
 return `<div class="stack"><h2>One language, two countries</h2><p class="muted" style="max-width:62ch">Use the Brazilian forms in PORTUGUE 102 so your work matches the course, unless your instructor says otherwise. Use the Portugal forms in Lisbon. People in Lisbon will understand Brazilian Portuguese, since they hear it often, so a mix is fine while you switch.</p><div>${seg}</div></div>
 <section class="stack"><h3>Grammar that changes</h3><div class="grid-eq">${BRIDGES.map(b=>`<div class="card stack" style="gap:6px"><b>${esc(b.t)}</b><div class="small"><span class="chip es">ES</span>${esc(b.es)}</div>${forms(b.br,b.pt||"")}<div class="muted small">${esc(b.n)}</div></div>`).join("")}</div></section>
 <section class="card stack"><h3>Words that change meaning</h3><div class="tablewrap"><table><thead><tr><th>Word</th><th>In Brazil</th><th>In Portugal</th><th>Note</th></tr></thead><tbody>${TRAPS.map(t=>`<tr><td><b>${esc(t[0])}</b></td><td>${esc(t[1])}</td><td>${esc(t[2])}</td><td class="muted">${esc(t[3])}</td></tr>`).join("")}</tbody></table></div></section>
 <section class="card stack"><h3>Everyday vocabulary</h3><input type="text" id="vocab-filter" placeholder="Filter, such as bus or café" aria-label="Filter vocabulary" value="${esc(vf)}"><div class="tablewrap"><table><thead><tr><th>English</th><th>Brasil</th><th>Portugal</th></tr></thead><tbody id="vocab-body">${vocabRows(diff)}</tbody></table></div></section>`}
let vf="";
function vocabRows(d){const q=clean(vf);return (d||CARDS.filter(c=>c.pt&&c.pt!==c.br&&["city","food","tech","school","sport","talk"].includes(c.tag))).filter(c=>!q||clean(c.en+" "+c.br+" "+c.pt+" "+c.es).includes(q)).map(c=>`<tr><td>${esc(c.en)}</td><td>${say(c.br,"br")} ${esc(c.br)}</td><td>${say(c.pt,"pt")} ${esc(c.pt)}</td></tr>`).join("")}

function sons(){const vb=voiceFor("br"),vp=voiceFor("pt");
 return `<div class="stack"><h2>Train your mouth and your ear</h2><p class="muted" style="max-width:62ch">Listen, repeat out loud, then compare. Comprehension is the hard part in Lisbon, so play each word in both accents. If you hear nothing, check your iPhone's silent switch.</p>
  <div class="row"><label class="row small" style="gap:5px"><input type="checkbox" id="slow" ${S.slow?"checked":""}> Slower audio</label>
  <span class="small muted">${vb?`Brazil voice: ${esc(vb.name)}.`:"No Brazil voice found on this device."} ${vp?`Portugal voice: ${esc(vp.name)}.`:"No Portugal voice found, so that button may fall back to another accent. Add one in your device's speech settings."}</span></div></div>
 <div class="grid-eq">${SOUNDS.map(s=>`<section class="card stack" style="gap:7px"><h3>${esc(s.t)}</h3><p class="muted small">${esc(s.trap)}</p>
   <div class="small"><span class="chip br">BR</span>${esc(s.br)}</div><div class="small"><span class="chip pt">PT</span>${esc(s.pt)}</div>
   <div class="stack" style="gap:4px;margin-top:3px">${s.w.map(w=>`<div class="line">${say(w,"br")}${say(w,"pt")}<span>${esc(w)}</span></div>`).join("")}</div></section>`).join("")}</div>
 <section class="card stack"><h3>Real speech for your ear</h3><p class="muted small">Synthetic voices are fine for single words, but your ear needs real people. Start in May, ten minutes a day.</p>
  <ul style="margin:0;padding-left:20px;display:grid;gap:5px"><li><a href="https://www.practiceportuguese.com/blog/learn-european-portuguese-free/" rel="noopener">Practice Portuguese</a>: free short dialogues from A1 to C1 and a podcast, in European Portuguese.</li><li><a href="https://www.rtp.pt/play/" rel="noopener">RTP Play</a>: Portugal's public broadcaster, for TV and radio from Lisbon.</li><li><a href="https://www.youtube.com/results?search_query=easy+portuguese" rel="noopener">Easy Portuguese</a>: street interviews on YouTube, with subtitles.</li></ul></section>`}

const VIEWS={hoje,conversa:conversaView,cartoes,ponte,sons};
function render(){document.body.dataset.tab=tab;renderChrome();$("#view").innerHTML=VIEWS[tab]();if(tab==="conversa")renderChat()}
let tt;function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,3200)}

/* ---------- events ---------- */
document.addEventListener("click",e=>{const b=e.target.closest("[data-act]");if(!b)return;const a=b.dataset.act,d=b.dataset;
 const fn={
  lead(){S.lead=d.v;C.accent=null;save();render()},
  say(){speak(d.t,d.v)},
  async "save-pass"(){const v=$("#"+d.src).value.trim();setPass(v);if(!v){toast("Passcode removed");render();return}
    const r=await pingServer();toast(r==="ok"?"Connected. Your partner is ready.":errCopy({code:r}));if(tab==="conversa"&&r==="ok")render()},
  async backup(){const t=JSON.stringify(S);const box=$("#backup-text");box.value=t;box.select();
    try{await navigator.clipboard.writeText(t);toast("Backup copied. Save it in Notes.")}catch(e){toast("Select the text and copy it.")}},
  restore(){const box=$("#backup-text");let o=null;try{o=JSON.parse(box.value)}catch(e){}
    if(!o||typeof o.cards!=="object"||!o.v){restoreArmed=false;toast("Paste a backup into the box first.");return}
    if(!restoreArmed){restoreArmed=true;const v=box.value;render();$("#backup-text").value=v;return}
    S={...blank(),...o};restoreArmed=false;save();render();toast("Progress restored")},
  bridge(){lg().b=!lg().b;save();render()},
  "go-scene"(){C.sc=d.id;startScenario(d.id);location.hash="conversa"},
  accent(){C.accent=d.v;startScenario(C.sc);render()},
  scene(){startScenario(d.id);render()},
  send(){sendChat()},stop(){C.ctl?.abort()},debrief(){debrief()},
  restart(){startScenario(C.sc);render()},
  try(){const i=$("#chat-input");i.value=d.t;i.focus()},
  "add-fix"(){addFix(+d.i,+d.j)},
  review(){startReview()},check(){checkCard()},next(){nextCard()},override(){overrideCard()},
  quit(){R=null;render()},import(){importClass()},
  pseg(){pSeg=d.v;render()},
  "ff-pick"(){FQ.pick=d.v;S.ff.t++;if(d.v===FQ.f[2])S.ff.r++;save();render()},
  "ff-next"(){nextFF();render()},
  "pq-check"(){pqCheck()},"pq-next"(){nextPQ();render();$("#pq-input")?.focus()}
 }[a];if(fn)fn()});
function pqCheck(){const v=$("#pq-input").value;PQ.val=v;PQ.res=PQ.art?(strip(clean(v))===strip(clean(PQ.pt))?(clean(v)===clean(PQ.pt)?"good":"accent"):"bad"):grade(v,[PQ.pt]);render()}
document.addEventListener("keydown",e=>{const id=e.target.id;
 if(e.key!=="Enter")return;
 if(id==="chat-input"&&!e.shiftKey){e.preventDefault();sendChat()}
 else if(id==="card-input"&&!R.rev){e.preventDefault();checkCard()}
 else if(id==="next-card"){e.preventDefault();nextCard()}
 else if(id==="pq-input"){e.preventDefault();if(!PQ.res)pqCheck()}});
document.addEventListener("change",e=>{const id=e.target.id;
 if(id==="lisbon-date"&&e.target.value){S.lisbon=e.target.value;save();render()}
 if(id==="auto-say"){S.auto=e.target.checked;save()}
 if(id==="slow"){S.slow=e.target.checked;save()}
 if(id==="free-topic"){C.custom=e.target.value}});
document.addEventListener("input",e=>{if(e.target.id==="vocab-filter"){vf=e.target.value;$("#vocab-body").innerHTML=vocabRows()}
 if(e.target.id==="chat-input")C.draft=e.target.value});

render();
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}))}
