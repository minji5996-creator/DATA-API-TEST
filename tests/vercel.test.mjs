import {test} from 'node:test';import assert from 'node:assert/strict';
process.env.VERCEL='1';
const {default:endpoint}=await import('../api/index.mjs');const {server}=await import('../server.mjs');
async function invoke(url){let status,body;const headers={};await endpoint({method:'GET',url},{setHeader(k,v){headers[k]=v;},writeHead(s,h){status=s;Object.assign(headers,h);},end(data){body=JSON.parse(String(data));}});return {status,body,headers};}
test('Vercel entry does not start a long-running listener',()=>assert.equal(server.listening,false));
test('Vercel rewrite delegates API path while preserving query validation',async()=>{const r=await invoke('/api/index?route=parking&lat=bad&lng=127');assert.equal(r.status,400);assert.ok(r.body.error);});
test('Vercel rewrite routes status and does not expose secrets',async()=>{const r=await invoke('/api/index?route=status');assert.equal(r.status,200);assert.equal(typeof r.body.configured,'boolean');assert.deepEqual(Object.keys(r.body).sort(),['configured','parkingConfigured']);});
