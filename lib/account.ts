import { env } from "cloudflare:workers";
import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";

const COOKIE = "moc_session";
const WEEK = 7 * 24 * 60 * 60;
const LESSONS = ["first", "rhythm", "song"];
export class AccountError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
function database() {
  if (!env.DB) throw new AccountError("unavailable", 503);
  return env.DB;
}
export function reply(data: unknown, status = 200, cookie?: string) {
  const headers = new Headers({"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff"});
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(JSON.stringify(data), { status, headers });
}
export function failure(error: unknown) {
  if (error instanceof AccountError) return reply({error:error.code},error.status);
  console.error("Account request failed");
  return reply({error:"unavailable"},503);
}
function tokenFrom(request: Request) {
  const value = request.headers.get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
function sessionCookie(request: Request, token: string, maxAge = WEEK) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export async function readJSON(request: Request, maxBytes = 4096): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  const sameOrigin = origin === new URL(request.url).origin && request.headers.get("sec-fetch-site") !== "cross-site";
  const jsonContent = request.headers.get("content-type")?.startsWith("application/json");
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError("invalid_request");
  let size=0;const parts: Uint8Array[]=[];
  while (true) {
    const {done,value}=await reader.read();if(done)break;
    size+=value.length;
    if(size>maxBytes){await reader.cancel();throw new AccountError("invalid_request",413)}
    parts.push(value);
  }
  reader.releaseLock();
  if(!sameOrigin)throw new AccountError("forbidden",403);
  if(!jsonContent)throw new AccountError("invalid_request",415);
  const bytes=new Uint8Array(size);let offset=0;
  for(const part of parts){bytes.set(part,offset);offset+=part.length}
  try { const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=="object"||Array.isArray(body))throw Error();return body; }
  catch { throw new AccountError("invalid_request"); }
}
let runningHashes = 0;
async function passwordKey(password: string, salt: string): Promise<Buffer> {
  // scrypt N=32768, r=8, p=3: ~32 MiB; fits the Workers memory limit.
  if(runningHashes >= 2)throw new AccountError("busy",429);
  runningHashes++;
  try {
    return await new Promise<Buffer>((resolve,reject)=>scrypt(password, Buffer.from(salt,"hex"),64,{N:32768,r:8,p:3,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
  } finally { runningHashes--; }
}
export async function currentUser(request: Request) {
  const token=tokenFrom(request);if(!token)return null;
  const user=await database().prepare("SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?").bind(digest(token),Date.now()).first<{id:string;username:string}>();
  return user || null;
}
async function completed(userId: string) {
  const rows=await database().prepare("SELECT lesson_id FROM progress WHERE user_id = ?").bind(userId).all<{lesson_id:string}>();
  return rows.results.map(row=>row.lesson_id).filter(x=>LESSONS.includes(x));
}
export async function me(request: Request) {
  const user=await currentUser(request);
  return reply({user,completed:user?await completed(user.id):[]});
}
async function rateLimit(key: string, limit: number, seconds: number) {
  const now=Date.now();
  const row=await database().prepare("INSERT INTO auth_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END, expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING count").bind(key,now+seconds*1000,now,now).first<{count:number}>();
  if(!row||row.count>limit)throw new AccountError("too_many_attempts",429);
}
export async function authenticate(request: Request, create: boolean) {
  const body=await readJSON(request);
  const username=typeof body.username==="string"?body.username.trim().toLowerCase():"";
  const password=typeof body.password==="string"?body.password:"";
  if(!/^[a-z0-9_]{3,24}$/.test(username))throw new AccountError("invalid_username");
  if(password.length<8||password.length>128)throw new AccountError("invalid_password");
  const ip=request.headers.get("cf-connecting-ip")||"local";
  await rateLimit(`ip:${digest(ip)}:${create?"register":"login"}`,create?5:50,create?3600:900);
  if(!create)await rateLimit(`user:${username}`,15,900);
  const db=database();
  let user: {id:string;username:string};
  const pending: D1PreparedStatement[]=[];
  if(create){
    const exists=await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
    if(exists)throw new AccountError("username_taken",409);
    user={id:crypto.randomUUID(),username};
    const salt=randomBytes(32).toString("hex");
    const hash=(await passwordKey(password,salt)).toString("hex");
    pending.push(db.prepare("INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)").bind(user.id,username,`scrypt-v1:${hash}`,salt,Date.now()));
  }else{
    const row=await db.prepare("SELECT id, username, password_hash, salt FROM users WHERE username = ?").bind(username).first<{id:string;username:string;password_hash:string;salt:string}>();
    const expected=row?.password_hash?.startsWith("scrypt-v1:")?Buffer.from(row.password_hash.slice(10),"hex"):Buffer.alloc(64);
    const key=await passwordKey(password,row?.salt||"00".repeat(32));
    if(!row||expected.length!==key.length||!timingSafeEqual(key,expected))throw new AccountError("invalid_credentials",401);
    user={id:row.id,username:row.username};
  }
  const token=randomBytes(32).toString("hex");const old=tokenFrom(request);
  if(old)pending.push(db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(digest(old)));
  pending.push(db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(digest(token),user.id,Date.now()+WEEK*1000));
  pending.push(db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Date.now()));
  pending.push(db.prepare("DELETE FROM auth_limits WHERE expires_at <= ?").bind(Date.now()));
  try{await db.batch(pending)}catch(error){
    if(create && await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first())throw new AccountError("username_taken",409);
    throw error;
  }
  return reply({user,completed:create?[]:await completed(user.id)},create?201:200,sessionCookie(request,token));
}
export async function logout(request: Request) {
  await readJSON(request);
  const token=tokenFrom(request);
  if(token)await database().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(digest(token)).run();
  return reply({ok:true},200,sessionCookie(request,"",0));
}
export async function saveProgress(request: Request) {
  const body=await readJSON(request);
  const user=await currentUser(request);if(!user)throw new AccountError("sign_in_required",401);
  if(body.accountId!==user.id)throw new AccountError("account_changed",409);
  if(typeof body.lessonId!=="string"||!LESSONS.includes(body.lessonId))throw new AccountError("invalid_request");
  await database().prepare("INSERT INTO progress (user_id, lesson_id) VALUES (?, ?) ON CONFLICT DO NOTHING").bind(user.id,body.lessonId).run();
  return reply({completed:await completed(user.id)});
}
