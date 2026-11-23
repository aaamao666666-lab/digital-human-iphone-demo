import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const ORIGIN='https://xinling-admin.aaamao666666.workers.dev';
function env(overrides={}) {
  return {
    APP_TEST_KEY:'test-secret',
    ASSETS:{fetch:async()=>new Response('Xinling app',{status:200,headers:{'content-type':'text/plain'}})},
    ...overrides
  };
}
async function call(path,method='GET',options={}) {
  const request=new Request('https://xinling.test'+path,{
    method,
    headers:options.headers||{},
    body:options.body
  });
  return worker.fetch(request,env(options.env),{waitUntil(){}});
}

test('01 - homepage serves static app shell',async()=>{
  const response=await call('/');
  assert.equal(response.status,200);
  assert.equal(await response.text(),'Xinling app');
});
test('02 - health endpoint responds without configured storage',async()=>{
  const response=await call('/api/health');
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.ok,true);
  assert.equal(data.cloudStorageConfigured,false);
  assert.equal(data.storageStatus,'not_configured');
});
test('03 - API preflight returns 204 and allows admin origin',async()=>{
  const response=await call('/api/health','OPTIONS',{headers:{Origin:ORIGIN,'Access-Control-Request-Method':'GET'}});
  assert.equal(response.status,204);
  assert.equal(response.headers.get('access-control-allow-origin'),ORIGIN);
  assert.match(response.headers.get('access-control-allow-methods'),/OPTIONS/);
});
test('04 - unknown API route returns JSON 404',async()=>{
  const response=await call('/api/not-a-route');
  assert.equal(response.status,404);
  assert.match((await response.json()).error,/不存在/);
});
test('05 - avatar generation rejects missing access key',async()=>{
  const response=await call('/api/avatar/generate','POST',{headers:{'content-type':'application/json'},body:JSON.stringify({imageUrls:['data:image/jpeg;base64,AA==']})});
  assert.equal(response.status,401);
});
test('06 - avatar generation clearly reports missing Meshy configuration',async()=>{
  const response=await call('/api/avatar/generate','POST',{headers:{'content-type':'application/json','x-app-access-key':'test-secret'},body:JSON.stringify({imageUrls:['data:image/jpeg;base64,AA==']})});
  assert.equal(response.status,503);
  assert.match((await response.json()).error,/MESHY_API_KEY/);
});
test('07 - avatar generation rejects malformed JSON',async()=>{
  const response=await call('/api/avatar/generate','POST',{env:{MESHY_API_KEY:'configured'},headers:{'content-type':'application/json','x-app-access-key':'test-secret'},body:'{'});
  assert.equal(response.status,400);
});
test('08 - avatar generation rejects invalid image payload',async()=>{
  const response=await call('/api/avatar/generate','POST',{env:{MESHY_API_KEY:'configured'},headers:{'content-type':'application/json','x-app-access-key':'test-secret'},body:JSON.stringify({imageUrls:['https://example.com/photo.jpg']})});
  assert.equal(response.status,400);
});
test('09 - invalid avatar task identifier is rejected',async()=>{
  const response=await call('/api/avatar/generate/not-a-valid-id','GET',{headers:{'x-app-access-key':'test-secret'}});
  assert.equal(response.status,400);
});
test('10 - unsupported chat method returns 405',async()=>{
  const response=await call('/api/chat','GET');
  assert.equal(response.status,405);
  assert.match(response.headers.get('allow'),/POST/);
});
