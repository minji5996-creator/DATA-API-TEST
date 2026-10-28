import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {buildUrl,parsePayload,TYPES} from './api.mjs';
import {createParkingStore,coordinates} from './parking.mjs';
const parking=createParkingStore(process.env.VERCEL?pathToFileURL(path.join(tmpdir(),'paw-trip-cache')+path.sep):new URL('./.cache/',import.meta.url),{seed:new URL('./data/parking.json.gz',import.meta.url),blocking:Boolean(process.env.VERCEL)});
const ROOT=path.dirname(fileURLToPath(import.meta.url));const cache=new Map();
async function env(){try{const text=await readFile(path.join(ROOT,'.env'),'utf8');return Object.fromEntries(text.split(/\r?\n/).filter(x=>/^\w+=/.test(x)).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).trim().replace(/^"|"$/g,'')];}));}catch{return {};}}
async function tour(op,params,config){
 const key=config.TOUR_API_KEY||process.env.TOUR_API_KEY;if(!key)throw Object.assign(new Error('터미널에서 API 키를 등록하면 실제 여행지를 검색할 수 있어요.'),{status:503,code:'KEY_REQUIRED'});
 const cacheKey=JSON.stringify([op,params,key]);const hit=cache.get(cacheKey);if(hit&&hit.exp>Date.now())return hit.value;
 let res;try{res=await fetch(buildUrl(op,params,key),{signal:AbortSignal.timeout(15000)});}catch{throw Object.assign(new Error('관광정보 서버 연결이 지연되고 있습니다. 다시 시도해 주세요.'),{status:502});}
 if(!res.ok)throw Object.assign(new Error('관광정보 서버가 요청을 처리하지 못했습니다.'),{status:502});
 const value=parsePayload(await res.text());if(cache.size>300)cache.clear();cache.set(cacheKey,{value,exp:Date.now()+300000});return value;
}
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
function checked(value,pattern){if(value&&!pattern.test(value))throw Object.assign(new Error('검색 조건을 확인해 주세요.'),{status:400});return value;}
export async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' https://tong.visitkorea.or.kr; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 try{
  if(req.method!=='GET')return json(res,405,{error:'지원하지 않는 요청입니다.'});
  const u=new URL(req.url,'http://localhost');const config=await env();const get=k=>u.searchParams.get(k)||'';
  if(u.pathname==='/api/status')return json(res,200,{configured:Boolean(config.TOUR_API_KEY||process.env.TOUR_API_KEY),parkingConfigured:Boolean(config.PARKING_API_KEY||process.env.PARKING_API_KEY)});
  if(u.pathname==='/api/parking'){
   const radius=Number(get('radius')||3);
   if(!coordinates(get('lat'),get('lng'))||![1,3,5].includes(radius)||!['','0','1'].includes(get('free')))throw Object.assign(new Error('여행지 좌표와 검색 반경을 확인해 주세요.'),{status:400});
   const data=await parking.nearby({key:config.PARKING_API_KEY||process.env.PARKING_API_KEY,lat:Number(get('lat')),lng:Number(get('lng')),radius,freeOnly:get('free')==='1'});return json(res,data.ready?200:202,data);
  }
  if(u.pathname==='/api/regions'){return json(res,200,await tour('ldongCode2',{numOfRows:'100',lDongListYn:'N',...(get('region')?{lDongRegnCd:checked(get('region'),/^\d{2}$/)}:{})},config));}
  if(u.pathname==='/api/places'){
   const params={pageNo:checked(get('page')||'1',/^[1-9]\d{0,3}$/),arrange:checked(get('sort')||'C',/^[ACD]$/)};
   if(get('region'))params.lDongRegnCd=checked(get('region'),/^\d{2}$/);
   if(get('city')){if(!params.lDongRegnCd)throw Object.assign(new Error('지역을 먼저 선택해 주세요.'),{status:400});params.lDongSignguCd=checked(get('city'),/^\d{3}$/);}
   if(get('category')){const type=(TYPES[config.TOUR_CONTENT_TYPES]||TYPES.legacy)[get('category')];if(!type)throw Object.assign(new Error('분류를 확인해 주세요.'),{status:400});params.contentTypeId=type;}
   const keyword=get('keyword').trim();if(keyword.length>80)throw Object.assign(new Error('검색어는 80자 이내로 입력해 주세요.'),{status:400});if(keyword)params.keyword=keyword;
   return json(res,200,await tour(keyword?'searchKeyword2':'areaBasedList2',params,config));
  }
  if(/^\/api\/places\/\d+$/.test(u.pathname)){
   const contentId=u.pathname.split('/').pop();
   const results=await Promise.allSettled([tour('detailCommon2',{contentId},config),tour('detailPetTour2',{contentId},config)]);
   if(results.every(r=>r.status==='rejected'))throw results[0].reason;
   return json(res,200,{common:results[0].status==='fulfilled'?results[0].value.items[0]||{}:{},pet:results[1].status==='fulfilled'?results[1].value.items[0]||{}:{},partial:results.some(r=>r.status==='rejected')});
  }
  const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/hero.svg':'hero.svg'};const file=files[u.pathname];
  if(!file)return json(res,404,{error:'페이지를 찾을 수 없습니다.'});
  const data=await readFile(path.join(ROOT,'public',file));res.writeHead(200,{'Content-Type':({'html':'text/html','js':'text/javascript','css':'text/css','svg':'image/svg+xml'})[file.split('.').pop()]+'; charset=utf-8'});res.end(data);
 }catch(e){json(res,e.status||500,{error:e.status?e.message:'요청을 처리하지 못했습니다.',...(['KEY_REQUIRED','PARKING_KEY_REQUIRED'].includes(e.code)?{code:e.code}:{})});}
}
const server=http.createServer(handler);
const config=await env();const port=Number(process.env.PORT||config.PORT||3000);if(!process.env.VERCEL)server.listen(port,'127.0.0.1',()=>console.log(`Paw Trip: http://localhost:${port}`));
export {server};
