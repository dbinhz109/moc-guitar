import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';import {zipSync,strToU8} from 'fflate';
const base=process.env.MOC_TEST_BASE_URL||'http://127.0.0.1:4173';assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));const ip='198.51.100.'+(1+Math.floor(Math.random()*249));
async function register(suffix){const r=await fetch(base+'/api/auth/register',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','CF-Connecting-IP':ip},body:JSON.stringify({username:'lib_'+suffix,password:randomBytes(16).toString('hex')})});assert.equal(r.status,201);const body=await r.json();return{cookie:r.headers.get('set-cookie').split(';')[0],id:body.user.id}}
async function call(path,user,options={}){return fetch(base+path,{...options,headers:{Origin:base,...(user?{Cookie:user.cookie,'X-Moc-Account':user.id}:{}),...options.headers}})}
function upload(user,clientId,content='C G Am F',name='practice.txt',origin=base){const body=new FormData();body.append('clientId',clientId);body.append('file',new Blob([content]),name);return call('/api/library',user,{method:'POST',body,headers:{Origin:origin,...(origin!==base?{Connection:'close'}:{})}})}
test('account library stores files and plans with ownership and revision checks',async t=>{
 const suffix=randomBytes(5).toString('hex'),a=await register(suffix),b=await register(suffix+'b');let file;
 await t.test('requires login and rejects cross-origin uploads',async()=>{assert.equal((await call('/api/library')).status,401);assert.equal((await upload(a,'csrf','C G','x.txt','https://untrusted.example')).status,403)});
 await t.test('uploads content, deduplicates imports and lists per account',async()=>{const response=await upload(a,'fixture');assert.equal(response.status,201,await response.clone().text());file=(await response.json()).file;assert.equal(file.name,'practice.txt');assert.equal((await (await upload(a,'fixture')).json()).file.id,file.id);assert.equal((await (await call('/api/library',a)).json()).files.length,1);assert.equal((await (await call('/api/library',b)).json()).files.length,0);});
 await t.test('retrieves the original file and rejects other owners',async()=>{const r=await call('/api/library/'+file.id,a);assert.equal(await r.text(),'C G Am F');assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal((await call('/api/library/'+file.id,b)).status,404);assert.equal((await call('/api/library/'+file.id,b,{method:'DELETE'})).status,404)});
 await t.test('validates file type and content',async()=>{assert.equal((await upload(a,'invalid','<svg/>','fake.png')).status,415);assert.equal((await upload(a,'html','hello','fake.html')).status,415);assert.equal((await upload(a,'fixture','different bytes')).status,409)});
 await t.test('persists a plan and rejects stale edits',async()=>{const practice={version:2,sections:[{name:'Verse',repeat:2,bars:[{events:[{chord:'C',beats:2}]}]}],meter:'2/4',tempo:60,reviewed:true};const options={method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:0,practice})};const r=await call('/api/library/'+file.id+'/practice',a,options);assert.equal(r.status,200);assert.equal((await r.json()).revision,1);assert.equal((await call('/api/library/'+file.id+'/practice',a,options)).status,409);assert.deepEqual((await (await call('/api/library',a)).json()).files[0].practice,practice);assert.equal((await call('/api/library/'+file.id+'/practice',b,options)).status,404)});
 await t.test('stores TAB positions and rejects inconsistent pitches and duplicate strings',async()=>{
  const event={chord:'-',notes:[68,56],tab:[{string:1,fret:4},{string:3,fret:1}],beats:3};
  const practice={version:2,sourceMode:'tab-text',sections:[{name:'Section 1',repeat:1,bars:[{events:[event]}]}],meter:'3/4',tempo:60,reviewed:true};
  const save=revision=>call('/api/library/'+file.id+'/practice',a,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,practice})});
  assert.equal((await save(1)).status,200);
  assert.deepEqual((await (await call('/api/library',a)).json()).files[0].practice.sections[0].bars[0].events[0],event);
  event.notes=[67,56];assert.equal((await save(2)).status,400);event.notes=[68,56];
  event.tab[1]={string:1,fret:5};assert.equal((await save(2)).status,400);
  event.tab[1]={string:3,fret:25};assert.equal((await save(2)).status,400);
 });
 await t.test('stores MusicXML and MXL, validates their content and saves note exercises',async()=>{
  const xml=await readFile(new URL('../public/samples/first-steps.musicxml',import.meta.url),'utf8');
  assert.equal((await upload(a,'wrong-xml','<html/>','wrong.xml')).status,415);
  assert.equal((await upload(a,'broken-xml','<score-partwise><part></score-partwise>','wrong.musicxml')).status,415);
  assert.equal((await upload(a,'wrong-mxl','not a zip','wrong.mxl')).status,415);
  const archive=zipSync({'META-INF/container.xml':strToU8('<container><rootfiles><rootfile full-path="score.musicxml"/></rootfiles></container>'),'score.musicxml':strToU8(xml)});
  for(const [ext,content] of [['musicxml',xml],['mxl',archive]]){
   const response=await upload(a,'score-'+ext,content,'exercise.'+ext);assert.equal(response.status,201,await response.clone().text());const source=(await response.json()).file;
   const practice={version:2,lessonStage:1,sections:[{name:'Section 1',repeat:1,bars:[{events:[{chord:'-',notes:[64],beats:1},{chord:'-',notes:[67],beats:1}]}]}],meter:'2/4',tempo:60,reviewed:true};
   const options={method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:0,practice})};
   assert.equal((await call('/api/library/'+source.id+'/practice',a,options)).status,200);
   practice.sections[0].bars[0].events[0].notes=[999];options.body=JSON.stringify({revision:1,practice});assert.equal((await call('/api/library/'+source.id+'/practice',a,options)).status,400);
   assert.equal((await call('/api/library/'+source.id,b)).status,404);
   const original=await call('/api/library/'+source.id,a);assert.equal((await original.arrayBuffer()).byteLength,ext==='mxl'?archive.length:Buffer.byteLength(xml));
   assert.equal((await call('/api/library/'+source.id,a,{method:'DELETE'})).status,200);
  }
 });
 await t.test('deletes both file and metadata',async()=>{assert.equal((await call('/api/library/'+file.id,a,{method:'DELETE'})).status,200);assert.equal((await call('/api/library/'+file.id,a)).status,404);assert.equal((await (await call('/api/library',a)).json()).files.length,0)});
});
