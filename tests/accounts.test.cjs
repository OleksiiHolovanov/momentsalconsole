const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
function harness(fetcher=async()=>({ok:true,json:async()=>({siteEntry:[]})}),storage=new Map(),tabStorage=new Map()){
  const elements=new Map();const timers=[];let oauth;
  function element(selector){if(!elements.has(selector))elements.set(selector,{value:selector==='#period'?'28':selector==='#sort'?'clicks':'',hidden:false,disabled:false,style:{},classList:{toggle(){}},addEventListener(){},focus(){},textContent:'',innerHTML:'',showModal(){this.open=true},close(){this.open=false}});return elements.get(selector)}
  const ctx={document:{querySelector:element,querySelectorAll:()=>[]},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},sessionStorage:{getItem:k=>tabStorage.get(k)||null,setItem:(k,v)=>tabStorage.set(k,v)},window:{MOMENTAL_CONFIG:{googleClientId:'public.apps.googleusercontent.com'}},location:{origin:'https://oleksiiholovanov.github.io'},crypto:{randomUUID:()=> 'new-group'},setTimeout:f=>{timers.push(f)},Date,Math,Map,Number,String,JSON,Blob,URL,AbortController,fetch:fetcher};
  ctx.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient(config){oauth={config};return{requestAccessToken(options){oauth.options=options}}}}}};ctx.window.google=ctx.google;
  vm.createContext(ctx);vm.runInContext(app,ctx);
  return{ctx,element,storage,tabStorage,run:code=>vm.runInContext(code,ctx),oauth:()=>oauth};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const account=(id,email=id+'@example.com')=>({id,email,name:id,token:'token-'+id,expires:Date.now()+3600000,sites:[]});
test('demo renders charts and keeps weighted totals accurate',()=>{
  const h=harness();assert.match(h.element('#sites').innerHTML,/momental.agency/);assert.match(h.element('#chart').innerHTML,/<svg/);
  const t=h.run('totals([{clicks:10,impressions:100,position:2},{clicks:20,impressions:300,position:6}])');assert.equal(t.ctr,.075);assert.equal(t.position,5);
});
test('groups and assignments are isolated between users and survive relogin',()=>{
  const h=harness();h.ctx.a=account('alice');h.ctx.b=account('bob');
  h.run("sessions.set(a.id,a);sessions.set(b.id,b);activateAccount(a);groups=[{id:'alice-group',name:'Private Alice'}];assignments={'live:https://shared.example/':'alice-group'};persistWorkspace();activateAccount(b)");
  assert.equal(h.run('groups.length'),0);assert.equal(h.run('Object.keys(assignments).length'),0);
  h.run("groups=[{id:'bob-group',name:'Private Bob'}];persistWorkspace();activateAccount(a)");assert.equal(h.run('groups[0].name'),'Private Alice');assert.equal(h.run("assignments['live:https://shared.example/']"),'alice-group');
  h.run("removeAccount('alice');sessions.set(a.id,{...a,token:'fresh',expires:Date.now()+10000});activateAccount(sessions.get('alice'))");assert.equal(h.run('groups[0].name'),'Private Alice');
  assert(![...h.storage.values()].some(value=>/token-|@example.com|fresh/.test(value)));
});
test('demo groups never enter a real user workspace',()=>{
  const h=harness();h.ctx.a=account('alice');h.run("groups=[{id:'demo-custom',name:'Demo only'}];persistWorkspace();sessions.set(a.id,a);activateAccount(a)");assert.equal(h.run('groups.length'),0);h.run('setupDemo()');assert.equal(h.run('groups[0].name'),'Demo only');
});
test('OAuth uses configured client ID, account picker and correct renewal hint',()=>{
  const h=harness();h.run('connect()');assert.equal(h.oauth().config.client_id,'public.apps.googleusercontent.com');assert.equal(h.oauth().options.prompt,'select_account');assert.match(h.oauth().config.scope,/webmasters.readonly/);h.run("connect('alice@example.com')");assert.equal(h.oauth().options.login_hint,'alice@example.com');assert.equal(h.oauth().options.prompt,'');
});
test('Google userinfo controls workspace identity and different tokens load distinct properties',async()=>{
  const calls=[];const h=harness(async(url,options)=>{const auth=options.headers.Authorization;calls.push([url,auth]);if(url.includes('/userinfo'))return{ok:true,json:async()=>({sub:auth.endsWith('token-A')?'A':'B',email:auth.endsWith('token-A')?'a@example.com':'b@example.com',name:auth.endsWith('token-A')?'Alice':'Bob'})};if(url.endsWith('/sites'))return{ok:true,json:async()=>({siteEntry:[{siteUrl:auth.endsWith('token-A')?'https://alice.example/':'https://bob.example/',permissionLevel:'siteOwner'}]})};return{ok:true,json:async()=>({rows:[]})}});
  h.run('connect()');await h.oauth().config.callback({access_token:'token-A',expires_in:3600});await flush();assert.equal(h.run('currentAccount.id'),'A');assert.equal(h.run('sites[0].name'),'alice.example');
  h.run('connect()');await h.oauth().config.callback({access_token:'token-B',expires_in:3600});await flush();assert.equal(h.run('currentAccount.id'),'B');assert.equal(h.run('sites[0].name'),'bob.example');assert.equal(h.run('sessions.size'),2);
  h.run("activateAccount(sessions.get('A'))");await flush();assert.equal(h.run('sites[0].name'),'alice.example');assert(!calls.some(([url,auth])=>url.includes('alice.example')&&auth==='Bearer token-B'));
});
test('late sites response cannot overwrite the newly selected account',async()=>{
  let release;const h=harness(async(url,options)=>options.headers.Authorization==='Bearer token-alice'?await new Promise(resolve=>release=resolve):({ok:true,json:async()=>({siteEntry:[]})}));
  h.ctx.a=account('alice');h.ctx.b=account('bob');h.run('sessions.set(a.id,a);sessions.set(b.id,b);activateAccount(a);activateAccount(b)');await flush();release({ok:true,json:async()=>({siteEntry:[{siteUrl:'https://private-alice.example/',permissionLevel:'siteOwner'}]})});await flush();assert.equal(h.run('currentAccount.id'),'bob');assert.equal(h.run('sites.length'),0);assert(!h.element('#sites').innerHTML.includes('private-alice'));
});
test('switch cancels in-flight analytics and prevents stale chart data',async()=>{
  let release;let oldSignal;const h=harness(async(url,options)=>{if(url.endsWith('/sites'))return{ok:true,json:async()=>({siteEntry:options.headers.Authorization==='Bearer token-alice'?[{siteUrl:'https://private-alice.example/',permissionLevel:'siteOwner'}]:[]})};oldSignal=options.signal;return await new Promise(resolve=>release=resolve)});
  h.ctx.a=account('alice');h.ctx.b=account('bob');h.run('sessions.set(a.id,a);sessions.set(b.id,b);activateAccount(a)');await flush();assert(oldSignal);h.run('activateAccount(b)');assert(oldSignal.aborted);await flush();release({ok:true,json:async()=>({rows:[{keys:['2026-01-01'],clicks:999,impressions:1000,ctr:.999,position:1}]})});await flush();assert.equal(h.run('currentAccount.id'),'bob');assert.equal(h.run('Object.keys(data).length'),0);assert.equal(h.run('busy'),false);
});
test('expired account prevents API requests and offers renewal',async()=>{
  let calls=0;const h=harness(async()=>{calls++;throw Error('must not fetch')});h.ctx.a={...account('alice'),expires:Date.now()-100};h.run('sessions.set(a.id,a);activateAccount(a)');await assert.rejects(h.run("api('/sites')"),/Сессия Google истекла/);assert.equal(calls,0);assert.equal(h.run('token'),null);assert.equal(h.element('#connect').innerHTML,'Войти снова');
});
test('logout clears current data and late OAuth callback cannot restore the session',async()=>{
  const h=harness();h.ctx.a=account('alice');h.run("sessions.set(a.id,a);activateAccount(a);groups=[{id:'private',name:'Keep groups'}];persistWorkspace();data={'https://private/':{current:[]}};connect()");const callback=h.oauth().config.callback;h.run("removeAccount('alice')");await callback({access_token:'late-token',expires_in:3600});assert.equal(h.run('currentAccount'),null);assert.equal(h.run('sessions.size'),0);assert.equal(h.run('sites.length'),0);assert.equal(h.run('Object.keys(data).length'),0);assert.equal(h.run('groups.length'),0);assert([...h.storage.values()].some(v=>v.includes('Keep groups')));
});
test('reload restores selected Google account and logout clears tab credentials',async()=>{
  const storage=new Map(),tab=new Map();const h=harness(undefined,storage,tab);h.ctx.a=account('alice');h.run('sessions.set(a.id,a);activateAccount(a)');await flush();
  const reloaded=harness(undefined,storage,tab);assert.equal(reloaded.run('currentAccount.id'),'alice');assert.equal(reloaded.run('demo'),false);assert.equal(reloaded.run('token'),'token-alice');await flush();
  reloaded.run("removeAccount('alice')");const afterLogout=harness(undefined,storage,tab);assert.equal(afterLogout.run('currentAccount'),null);assert.equal(afterLogout.run('sessions.size'),0);assert(![...tab.values()].some(v=>v.includes('token-alice')));
});
test('expired saved credentials retain account label without sending an expired token',()=>{
  const tab=new Map([['momentalconsole:v2:sessions',JSON.stringify({activeId:'alice',demo:false,accounts:[{...account('alice'),expires:Date.now()-1000}]})]]);let calls=0;const h=harness(async()=>{calls++},new Map(),tab);assert.equal(h.run('currentAccount.id'),'alice');assert.equal(h.run('token'),null);assert.equal(calls,0);assert.equal(h.element('#connect').innerHTML,'Войти снова');
});
test('custom dates create an inclusive range and equal-length preceding comparison',()=>{
  const h=harness();h.run("customRange={start:'2026-08-10',end:'2026-08-12'}");h.element('#period').value='custom';const d=h.run('dates()');assert.equal(d.n,3);assert.equal(d.start,'2026-08-10');assert.equal(d.end,'2026-08-12');assert.equal(d.ps,'2026-08-07');assert.equal(d.pe,'2026-08-09');
  const body=h.run("requestBody('2026-08-10','2026-08-12',['date'])");assert.equal(body.dimensionFilterGroups,undefined);
});
test('group picker moves selected sites and removes deselected members',()=>{
  const h=harness();h.run("active='clients'");h.ctx.document.querySelectorAll=selector=>selector==='[data-group-site]:checked'?[{dataset:{groupSite:'https://momental.agency/'}}]:[];h.run('applyGroupSites()');assert.equal(h.run("groupFor(sites.find(s=>s.name==='momental.agency'))"),'clients');assert.equal(h.run("groupFor(sites.find(s=>s.name==='urbanliving.ru'))"),'');assert.equal(h.run('visible().length'),1);
});
test('successful current metrics survive comparison API failure',async()=>{
  let analytics=0;const h=harness(async(url)=>{if(url.endsWith('/sites'))return{ok:true,json:async()=>({siteEntry:[{siteUrl:'https://alice.example/',permissionLevel:'siteOwner'}]})};analytics++;return analytics===1?{ok:true,json:async()=>({rows:[{keys:['2026-09-15'],clicks:42,impressions:420,position:4,ctr:.1}]})}:{ok:false,status:403,json:async()=>({error:{message:'comparison unavailable'}})}});h.ctx.a=account('alice');h.run('sessions.set(a.id,a);activateAccount(a)');await flush();assert.equal(h.run("data['https://alice.example/'].current[0].clicks"),42);assert.equal(h.run("data['https://alice.example/'].comparisonError"),'comparison unavailable');
});
