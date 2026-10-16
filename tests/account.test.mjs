import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

// Run only against a local preview; creates disposable accounts in local D1.
const base = process.env.MOC_TEST_BASE_URL || 'http://127.0.0.1:4173';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname), 'Use a local preview database');
const suffix = randomBytes(5).toString('hex');
const username = 'qa_' + suffix;
const password = randomBytes(18).toString('hex');
const ip = '198.51.100.' + (1 + parseInt(suffix.slice(0,2),16)%250);
async function call(path, body, cookie, origin = base) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type':'application/json', Origin:origin, 'CF-Connecting-IP':ip, ...(cookie ? {Cookie:cookie} : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const responseText = await response.text();
  assert.ok(response.headers.get("content-type")?.includes("application/json"), `${path} returned ${response.status}: ${responseText.slice(0,180)}`);
  const data = JSON.parse(responseText);
  return { status:response.status, data, cookie:response.headers.get('set-cookie')?.split(';')[0], headers:response.headers };
}

test('username/password accounts, session lifecycle and ownership', async t => {
  let first, second;
  await t.test('reject unauthenticated writes and cross-origin requests', async()=>{
    assert.equal((await call('/api/progress',{lessonId:'first'})).status,401);
    assert.equal((await call('/api/auth/register',{username,password},null,'https://untrusted.example')).status,403);
    assert.equal((await call('/api/auth/register',{username:'ab',password})).status,400);
    assert.equal((await call('/api/auth/register',{username,password:'short'})).status,400);
  });
  await t.test('register, normalize username and issue HttpOnly session', async()=>{
    first=await call('/api/auth/register',{username:username.toUpperCase(),password});
    assert.equal(first.status,201);assert.equal(first.data.user.username,username);
    assert.match(first.headers.get('set-cookie'),/HttpOnly/);assert.match(first.headers.get('set-cookie'),/SameSite=Lax/);
    assert.equal(first.headers.get('cache-control'),'no-store');
    assert.equal(first.data.user.password,undefined);assert.equal(first.data.user.password_hash,undefined);
    assert.equal((await call('/api/auth/me',undefined,first.cookie)).data.user.id,first.data.user.id);
    assert.equal((await call('/api/auth/register',{username,password})).status,409);
  });
  await t.test('save progress idempotently and reject account spoofing', async()=>{
    const body={lessonId:'first',accountId:first.data.user.id};
    assert.deepEqual((await call('/api/progress',body,first.cookie)).data.completed,['first']);
    assert.deepEqual((await call('/api/progress',body,first.cookie)).data.completed,['first']);
    assert.equal((await call('/api/progress',{...body,accountId:'someone-else'},first.cookie)).status,409);
    assert.equal((await call('/api/progress',{...body,lessonId:'invented'},first.cookie)).status,400);
  });
  await t.test('keep accounts separate', async()=>{
    second=await call('/api/auth/register',{username:username+'_b',password});
    assert.equal(second.status,201);assert.notEqual(second.data.user.id,first.data.user.id);
    assert.deepEqual((await call('/api/auth/me',undefined,second.cookie)).data.completed,[]);
    assert.deepEqual((await call('/api/auth/me',undefined,first.cookie)).data.completed,['first']);
  });
  await t.test('reject wrong password and rotate sessions on sign-in', async()=>{
    assert.equal((await call('/api/auth/login',{username,password:'wrong-password'})).status,401);
    const login=await call('/api/auth/login',{username,password},first.cookie);
    assert.equal(login.status,200);assert.notEqual(login.cookie,first.cookie);
    assert.equal((await call('/api/auth/me',undefined,first.cookie)).data.user,null);
    assert.deepEqual(login.data.completed,['first']);first=login;
  });
  await t.test('logout invalidates server-side session and forged cookies fail', async()=>{
    assert.equal((await call('/api/auth/logout',{},first.cookie)).status,200);
    assert.equal((await call('/api/auth/me',undefined,first.cookie)).data.user,null);
    assert.equal((await call('/api/progress',{lessonId:'song',accountId:first.data.user.id},first.cookie)).status,401);
    assert.equal((await call('/api/auth/me',undefined,'moc_session='+'a'.repeat(64))).data.user,null);
  });
  await t.test('limit repeated password attempts', async()=>{
    let limited=false;
    for(let i=0;i<16;i++){
      const result=await call('/api/auth/login',{username,password:'wrong-password'});
      if(result.status===429){limited=true;break;}
      assert.equal(result.status,401);
    }
    assert.ok(limited);
  });
});
