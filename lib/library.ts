import { env } from "cloudflare:workers";
import { createHash } from "node:crypto";
import { AccountError, currentUser, readJSON, reply } from "./account";
const MAX_FILE = 10 * 1024 * 1024;
const MIME:Record<string,string>={pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",txt:"text/plain; charset=utf-8",md:"text/plain; charset=utf-8"};
type DocumentRow={id:string;user_id:string;client_id:string;name:string;ext:string;size:number;storage_key:string;content_hash:string;practice:string|null;revision:number;created_at:number};
function stores(){if(!env.DB||!env.BUCKET)throw new AccountError("unavailable",503);return {db:env.DB,bucket:env.BUCKET}}
async function owner(request:Request,write=false){const user=await currentUser(request);if(!user)throw new AccountError("sign_in_required",401);if(write&&request.headers.get("x-moc-account")!==user.id)throw new AccountError("account_changed",409);return user}
function safeOrigin(request:Request){if(request.headers.get("origin")!==new URL(request.url).origin||request.headers.get("sec-fetch-site")==="cross-site")throw new AccountError("forbidden",403)}
function expose(row:DocumentRow){return {id:row.id,clientId:row.client_id,name:row.name,ext:row.ext,size:row.size,revision:row.revision,createdAt:row.created_at,practice:row.practice?JSON.parse(row.practice):null,remote:true}}
async function rowFor(request:Request,id:string,write=false){const user=await owner(request,write);const row=await stores().db.prepare("SELECT * FROM documents WHERE id = ? AND user_id = ?").bind(id,user.id).first<DocumentRow>();if(!row)throw new AccountError("not_found",404);return row}
export async function listDocuments(request:Request){const user=await owner(request);const result=await stores().db.prepare("SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC, id").bind(user.id).all<DocumentRow>();return reply({files:result.results.map(expose)})}
async function boundedBody(request:Request,max:number){if(Number(request.headers.get("content-length"))>max)throw new AccountError("file_too_large",413);const reader=request.body?.getReader();if(!reader)throw new AccountError("invalid_request");const parts:Uint8Array[]=[];let total=0;while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw new AccountError("file_too_large",413)}parts.push(value)}reader.releaseLock();const bytes=new Uint8Array(total);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length}return bytes}
function validateContent(ext:string,bytes:Uint8Array){
 if(ext==='pdf')return new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
 if(ext==='png')return bytes.length>8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
 if(ext==='jpg'||ext==='jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(ext==='webp')return new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
 try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);return !bytes.includes(0)}catch{return false}
}
export async function uploadDocument(request:Request){
 const bytes=await boundedBody(request,MAX_FILE+16384);
 safeOrigin(request);const user=await owner(request,true);const {db,bucket}=stores();
 const form=await new Request(request.url,{method:'POST',headers:{'content-type':request.headers.get('content-type')||''},body:bytes}).formData();
 const file=form.get('file'),clientId=form.get('clientId');
 if(!(file instanceof File)||typeof clientId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(clientId))throw new AccountError('invalid_request');
 const name=file.name.trim().slice(0,200),ext=name.split('.').pop()?.toLowerCase()||'';
 if(!MIME[ext])throw new AccountError('invalid_file',415);if(!file.size||file.size>MAX_FILE)throw new AccountError('file_too_large',413);
 const content=new Uint8Array(await file.arrayBuffer());if(!validateContent(ext,content))throw new AccountError('invalid_file',415);
 const hash=createHash('sha256').update(content).digest('hex');
 const existing=await db.prepare('SELECT * FROM documents WHERE user_id = ? AND client_id = ?').bind(user.id,clientId).first<DocumentRow>();
 if(existing){if(existing.content_hash!==hash)throw new AccountError('conflict',409);return reply({file:expose(existing)})}
 const id=crypto.randomUUID(),key=`library/${user.id}/${id}`;
 await bucket.put(key,content,{httpMetadata:{contentType:MIME[ext]}});
 try{
  const result=await db.prepare('INSERT INTO documents (id,user_id,client_id,name,ext,size,content_hash,storage_key,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM documents WHERE user_id = ?) < 100 AND (SELECT COALESCE(SUM(size),0) FROM documents WHERE user_id = ?) + ? <= 209715200 ON CONFLICT(user_id,client_id) DO NOTHING').bind(id,user.id,clientId,name,ext,file.size,hash,key,Date.now(),user.id,user.id,file.size).run();
  if(!result.meta.changes){await bucket.delete(key);const concurrent=await db.prepare('SELECT * FROM documents WHERE user_id = ? AND client_id = ?').bind(user.id,clientId).first<DocumentRow>();if(concurrent&&concurrent.content_hash===hash)return reply({file:expose(concurrent)});throw new AccountError('library_full',409)}
 }catch(error){await bucket.delete(key);throw error}
 const row=await db.prepare('SELECT * FROM documents WHERE id = ?').bind(id).first<DocumentRow>();return reply({file:expose(row!)},201);
}
export async function getDocument(request:Request,id:string){const row=await rowFor(request,id);const object=await stores().bucket.get(row.storage_key);if(!object)throw new AccountError('not_found',404);return new Response(object.body,{headers:{'Content-Type':MIME[row.ext],'Content-Length':String(row.size),'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(row.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
export async function deleteDocument(request:Request,id:string){safeOrigin(request);const row=await rowFor(request,id,true);const {db,bucket}=stores();await bucket.delete(row.storage_key);await db.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?').bind(id,row.user_id).run();return reply({ok:true})}
export async function updatePractice(request:Request,id:string){
 const body=await readJSON(request,256*1024);const row=await rowFor(request,id,true);const plan=body.practice;
 if(!plan||typeof plan!=='object'||Array.isArray(plan)||!Number.isInteger(body.revision))throw new AccountError('invalid_request');
 const value=plan as Record<string,unknown>;
 if(value.version===2){
  if(!['2/4','3/4','4/4','6/8'].includes(String(value.meter))||typeof value.tempo!=='number'||value.tempo<40||value.tempo>180||!Array.isArray(value.sections)||!value.sections.length||value.sections.length>100||value.reviewed!==true)throw new AccountError('invalid_request');
  let events=0;
  for(const section of value.sections){
   if(!section||typeof section!=='object'||typeof section.name!=='string'||section.name.length>100||!Number.isInteger(section.repeat)||section.repeat<1||section.repeat>8||!Array.isArray(section.bars)||section.bars.length>256)throw new AccountError('invalid_request');
   for(const bar of section.bars){
    if(!bar||!Array.isArray(bar.events)||!bar.events.length||bar.events.length>16)throw new AccountError('invalid_request');
    let sum=0;
    for(const event of bar.events){events++;if(events>512||typeof event.chord!=='string'||!/^([A-G](#|b)?[a-zA-Z0-9]*(\/[A-G](#|b)?)?|-)$/.test(event.chord)||typeof event.beats!=='number'||!Number.isFinite(event.beats)||event.beats<=0||event.beats>6)throw new AccountError('invalid_request');sum+=event.beats;}
    if(Math.abs(sum-Number(String(value.meter).split('/')[0]))>.001)throw new AccountError('invalid_request');
   }
  }
 }else if(!Array.isArray(value.sequence)||!value.sequence.length||value.sequence.length>256)throw new AccountError('invalid_request');
 const json=JSON.stringify(plan);if(json.length>240000)throw new AccountError('invalid_request',413);
 const result=await stores().db.prepare('UPDATE documents SET practice = ?, revision = revision + 1 WHERE id = ? AND user_id = ? AND revision = ?').bind(json,id,row.user_id,body.revision).run();
 if(!result.meta.changes)throw new AccountError('conflict',409);return reply({revision:row.revision+1});
}
