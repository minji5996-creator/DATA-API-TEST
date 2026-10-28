import {test,after} from 'node:test';
import assert from 'node:assert/strict';
const nativeFetch=globalThis.fetch;let lastUrl;
process.env.PORT='0';process.env.TOUR_API_KEY='fixture-key-for-test-only';
globalThis.fetch=async(url,options)=>{
 if(!String(url).startsWith('https://apis.data.go.kr/'))return nativeFetch(url,options);
 lastUrl=new URL(url);const op=lastUrl.pathname.split('/').pop();
 const item=op==='detailPetTour2'?{contentid:'123',acmpyNeedMtr:'목줄 착용'}:{contentid:'123',title:'검증용 여행지',addr1:'검증용 주소'};
 return new Response(JSON.stringify({response:{header:{resultCode:'0000'},body:{items:{item:[item]},totalCount:1}}}));
};
const {server}=await import('../server.mjs');
if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
after(async()=>{globalThis.fetch=nativeFetch;await new Promise(resolve=>server.close(resolve));});
test('HTTP boundary rejects secret and source paths',async()=>{
 for(const route of ['/.env','/.env.example','/server.mjs','/scripts/register-key.ps1','/../.env']){const r=await nativeFetch(base+route);assert.equal(r.status,404);assert.ok(!(await r.text()).includes('fixture-key'));}
});
test('search forwards region, category and keyword only through server',async()=>{
 const r=await nativeFetch(base+'/api/places?region=11&city=110&category=food&keyword='+encodeURIComponent('산책')+'&page=2&sort=A');assert.equal(r.status,200);
 const body=await r.text();assert.ok(!body.includes('fixture-key'));assert.equal(lastUrl.pathname.split('/').pop(),'searchKeyword2');assert.equal(lastUrl.searchParams.get('lDongRegnCd'),'11');assert.equal(lastUrl.searchParams.get('lDongSignguCd'),'110');assert.equal(lastUrl.searchParams.get('keyword'),'산책');assert.equal(lastUrl.searchParams.get('pageNo'),'2');
});
test('details combine common and pet fields',async()=>{const r=await nativeFetch(base+'/api/places/123');const d=await r.json();assert.equal(d.common.title,'검증용 여행지');assert.equal(d.pet.acmpyNeedMtr,'목줄 착용');assert.equal(d.partial,false);});
test('invalid search is rejected before calling upstream',async()=>{for(const query of ['region=bad','city=110','page=-1','category=unknown','sort=Z'])assert.equal((await nativeFetch(base+'/api/places?'+query)).status,400);});
