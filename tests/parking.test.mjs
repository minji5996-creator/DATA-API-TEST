import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {nearest,coordinates,distanceKm,parseParking,createParkingStore} from '../parking.mjs';
test('distance sorting handles free-only, radius, missing coordinates and duplicate distances',()=>{
 const rows=[{prkplceNo:'B',latitude:'37.51',longitude:'127',parkingchrgeInfo:'무료'},{prkplceNo:'A',latitude:'37.5',longitude:'127',parkingchrgeInfo:'유료'},{prkplceNo:'C',latitude:'',longitude:'127',parkingchrgeInfo:'무료'},{prkplceNo:'D',latitude:'36',longitude:'127',parkingchrgeInfo:'무료'}];
 assert.deepEqual(nearest(rows,37.5,127,3).map(p=>p.prkplceNo),['A','B']);assert.deepEqual(nearest(rows,37.5,127,3,true).map(p=>p.prkplceNo),['B']);assert.equal(distanceKm(37,127,37,127),0);assert.equal(coordinates('',127),false);assert.equal(coordinates(0,0),false);
});
test('standard API array body, item wrapper and sanitized errors',()=>{assert.equal(parseParking(JSON.stringify({response:{header:{resultCode:'00'},body:{items:[{prkplceNm:'a'}],totalCount:1}}})).items.length,1);assert.throws(()=>parseParking('<returnReasonCode>30</returnReasonCode>SECRET'),e=>e.message.includes('인증키')&&!e.message.includes('SECRET'));assert.throws(()=>parseParking('{}'));});
test('national index collects every page before exposing nearest, filters coordinates and deduplicates',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'paw-parking-'));let count=0;
 try{const store=createParkingStore(pathToFileURL(folder+path.sep),{pause:async()=>{},fetcher:async u=>{count++;const page=Number(u.searchParams.get('pageNo'));const items=page===1?[{prkplceNo:'1',latitude:'37.5',longitude:'127',referenceDate:'2025-01-01'},{prkplceNo:'2',latitude:'',longitude:''}]:[{prkplceNo:'1',latitude:'37.5',longitude:'127',referenceDate:'2026-01-01'}];return new Response(JSON.stringify({response:{header:{resultCode:'00'},body:{items,totalCount:3}}}));}});
 const params={key:'test-only-key',lat:37.5,lng:127,radius:3,freeOnly:false};assert.equal((await store.nearby(params)).ready,false);
 let result;for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,10));result=await store.nearby(params);if(result.ready)break;}
 assert.equal(result.ready,true);assert.equal(count,2);assert.equal(result.sourceTotal,3);assert.equal(result.excluded,1);assert.equal(result.indexed,1);assert.equal(result.items[0].referenceDate,'2026-01-01');
 const restored=createParkingStore(pathToFileURL(folder+path.sep),{fetcher:()=>{throw Error('must use cache');}});assert.equal((await restored.nearby(params)).ready,true);
 }finally{assert.equal(path.dirname(path.resolve(folder)),path.resolve(tmpdir()));assert.ok(path.basename(folder).startsWith('paw-parking-'));await rm(folder,{recursive:true,force:true});}
});

test('live standard API supports top-level header and body without response wrapper',()=>{const d=parseParking(JSON.stringify({header:{resultCode:'00'},body:{items:{item:[{prkplceNo:'live-shape'}]},totalCount:'1'}}));assert.equal(d.items[0].prkplceNo,'live-shape');assert.equal(d.total,1);});
