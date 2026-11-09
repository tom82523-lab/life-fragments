import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:4173';
const url=origin+'/api/letter';
async function req(action,data={},cookie='',admin=false,source=origin){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:source,...(cookie?{Cookie:cookie}:{}),...(admin?{'oai-authenticated-user-email':'tom82523@gmail.com'}:{})},body:JSON.stringify({action,...data})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function get(action='',cookie='',admin=false){const r=await fetch(url+'?action='+action,{headers:{...(cookie?{Cookie:cookie}:{}),...(admin?{'oai-authenticated-user-email':'tom82523@gmail.com'}:{})}});return {status:r.status,data:await r.json()};}
assert.equal((await req('session',{},'',false,'https://attacker.example')).status,403);
assert.equal((await req('submit')).status,401);
assert.equal((await get('admin')).status,403);
const a=await req('session'), b=await req('session');assert.equal(a.status,200);assert.ok(a.cookie);assert.ok(b.cookie);
const story={title:'自動測試文章，結束即刪除',body:'這是一篇測試資料，用來驗證投稿與權限流程。這段內容不是真實使用者的經歷，測試完成後將刪除。',era:'測試日期',source:'recollection',adult:true,privacy:true,share:true};
assert.equal((await req('submit',{...story,body:'太短'},a.cookie)).status,400);
assert.equal((await req('submit',{...story,adult:false},a.cookie)).status,400);
const s=await req('submit',story,a.cookie);assert.equal(s.status,200);const id=s.data.id;
assert.ok(!(await get()).data.stories.some(x=>x.id===id));
assert.ok((await get('mine',a.cookie)).data.stories.some(x=>x.id===id));
assert.ok(!(await get('mine',b.cookie)).data.stories.some(x=>x.id===id));
assert.equal((await req('withdraw',{id},b.cookie)).status,404);
assert.equal((await req('moderate',{id,status:'approved'},a.cookie)).status,403);
assert.equal((await req('moderate',{id,status:'approved'},'',true)).status,200);
assert.ok((await get()).data.stories.some(x=>x.id===id));
assert.equal((await req('feedback',{story:id,kind:'resonate',note:'測試'},b.cookie)).status,200);
const privateStory=await req('submit',{...story,share:false},a.cookie);assert.equal(privateStory.status,200);
assert.equal((await req('moderate',{id:privateStory.data.id,status:'approved'},'',true)).status,400);
assert.equal((await req('withdraw',{id},a.cookie)).status,200);
assert.ok(!(await get()).data.stories.some(x=>x.id===id));
assert.equal((await req('feedback',{story:id,kind:'resonate',note:''},b.cookie)).status,404);
const before=(await get('admin','',true)).data.metrics;
for(const type of ['past','present']){
 const attempt=crypto.randomUUID();assert.equal((await req('start',{id:attempt,letterType:type},a.cookie)).status,200);
 const payload={...story,title:'',body:'今天有點累',letterType:type,attempt,mood:type==='present'?'疲倦':'',reflection:type==='past'?'現在還不明白':'',share:false};
 assert.equal((await req('submit',payload,b.cookie)).status,400);
 if(type==='present')assert.equal((await req('submit',{...payload,mood:''},a.cookie)).status,400);
 const result=await req('submit',payload,a.cookie);assert.equal(result.status,200,JSON.stringify(result));
 assert.equal((await req('submit',payload,a.cookie)).status,409);
 const own=(await get('mine',a.cookie)).data.stories.find(x=>x.id===result.data.id);assert.equal(own.letterType,type);assert.equal(own.mood,payload.mood);assert.equal(own.reflection,payload.reflection);assert.ok(own.created);assert.ok(own.title);
 const metric=(await get('admin','',true)).data.metrics.find(x=>x.letterType===type);const old=before.find(x=>x.letterType===type);assert.equal(metric.starts,(old?.starts||0)+1);assert.equal(metric.completions,(old?.completions||0)+1);
}
// Opt-in reader feedback and site research must persist privately and erase fully.
const sample='career-1';
assert.equal((await req('feedback',{story:sample,kind:'resonate',note:''},b.cookie)).status,400);
for(const kind of ['read_view','read_next','resonate','neutral']) assert.equal((await req('feedback',{story:sample,kind,note:'',consent:true},b.cookie)).status,200);
const survey=JSON.stringify({page:'read',category:'操作或畫面有問題',purpose:'只是好奇看看',situation:'',message:'測試回饋，結束即刪除'});
assert.equal((await req('feedback',{story:'site',kind:'site_feedback',note:survey,consent:true},b.cookie)).status,200);
assert.equal((await req('feedback',{story:'site',kind:'site_feedback',note:'{}',consent:true},b.cookie)).status,400);
assert.equal((await req('feedback',{story:'site',kind:'read_next',note:'',consent:true},b.cookie)).status,400);
assert.equal((await req('feedback',{story:'unknown-letter',kind:'resonate',note:'',consent:true},b.cookie)).status,404);
const adminData=(await get('admin','',true)).data;
assert.ok(adminData.feedback.some(f=>f.story==='site'&&f.note===survey));
assert.ok(adminData.reading.some(f=>f.story===sample&&f.kind==='read_next'&&f.events>=1));
assert.equal((await get()).data.feedback,undefined);
assert.equal((await req('erase',{},a.cookie)).status,200);assert.equal((await req('erase',{},b.cookie)).status,200);
assert.ok(!(await get('admin','',true)).data.stories.some(x=>x.title===story.title));
assert.ok(!(await get('admin','',true)).data.feedback.some(f=>f.note===survey));
console.log('PASS: opt-in, sample feedback, site survey, private metrics, erase, cross-origin rejection, auth, validation, isolation, moderation, private consent, durable reads, feedback, withdrawal, cleanup');
