import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {normalizeKey} from './api.mjs';
export const PARKING_URL='https://api.data.go.kr/openapi/tn_pubr_prkplce_info_api';
export function coordinates(lat,lng){return String(lat??'').trim()!==''&&String(lng??'').trim()!==''&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))&&Number(lat)>=32&&Number(lat)<=40&&Number(lng)>=124&&Number(lng)<=132;}
export function distanceKm(a,b,c,d){const rad=n=>n*Math.PI/180;const x=Math.sin(rad(c-a)/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));}
export function nearest(items,lat,lng,radius=3,freeOnly=false){return items.filter(p=>coordinates(p.latitude,p.longitude)&&(!freeOnly||p.parkingchrgeInfo==='무료')).map(p=>({...p,distanceKm:distanceKm(lat,lng,Number(p.latitude),Number(p.longitude))})).filter(p=>p.distanceKm<=radius).sort((a,b)=>a.distanceKm-b.distanceKm||String(a.prkplceNo).localeCompare(String(b.prkplceNo))).slice(0,8);}
function failure(code){const text={'20':'주차장 API 활용신청 승인 상태를 확인해 주세요.','22':'주차장 API의 오늘 호출 한도에 도달했습니다.','30':'주차장 API 인증키 또는 활용신청 상태를 확인해 주세요.','31':'주차장 API 이용 기간이 만료되었습니다.'}[code]||'주차장 데이터 서버의 응답을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';return Object.assign(new Error(text),{status:502});}
export function parseParking(raw){let data;try{data=JSON.parse(raw);}catch{throw failure(raw.match(/<returnReasonCode>([^<]+)</)?.[1]);}const r=data.response??data;if(!r||!['00','0000','0'].includes(String(r.header?.resultCode)))throw failure(r?.header?.resultCode);const b=r.body||{};const rows=Array.isArray(b.items)?b.items:b.items?.item;const items=rows?(Array.isArray(rows)?rows:[rows]):[];const total=Number(b.totalCount);if(!Number.isInteger(total)||total<0)throw failure();return {items,total};}
const fields=['prkplceNo','prkplceNm','prkplceSe','prkplceType','rdnmadr','lnmadr','prkcmprt','operDay','weekdayOperOpenHhmm','weekdayOperColseHhmm','satOperOperOpenHhmm','satOperCloseHhmm','holidayOperOpenHhmm','holidayCloseOpenHhmm','parkingchrgeInfo','basicTime','basicCharge','addUnitTime','addUnitCharge','dayCmmtkt','metpay','spcmnt','institutionNm','phoneNumber','latitude','longitude','pwdbsPpkZoneYn','referenceDate'];
export function createParkingStore(directory,{fetcher=(...args)=>fetch(...args),pause=ms=>new Promise(r=>setTimeout(r,ms)),seed=null,blocking=false}={}){
 const file=new URL('./parking.json',directory);let snapshot=null,loading=null,loaded=false,lastError='',retryAt=0,progress={received:0,total:0};
 async function restore(){if(loaded)return;loaded=true;for(const source of [file,seed].filter(Boolean)){try{const raw=await readFile(source);const d=JSON.parse(source===seed?gunzipSync(raw).toString('utf8'):raw.toString('utf8'));if(d.version===1&&Array.isArray(d.items)&&d.complete===true&&Number.isFinite(Date.parse(d.updatedAt))){snapshot=d;break;}}catch{}}}
 async function sync(key){
  const rows=[];let total=0,page=1;
  do{
   if(page>500)throw Object.assign(new Error('전국 데이터가 수집 한도를 초과했습니다. 전체 수집을 완료하지 못했습니다.'),{status:502});
   const url=new URL(PARKING_URL);url.search=new URLSearchParams({serviceKey:normalizeKey(key),pageNo:String(page),numOfRows:'1000',type:'json'});
   let response;try{response=await fetcher(url,{signal:AbortSignal.timeout(25000)});}catch{throw Object.assign(new Error('주차장 데이터 서버 연결이 지연되고 있습니다.'),{status:502});}
   if(!response.ok)throw failure();const data=parseParking(await response.text());
   if(page>1&&data.total!==total)throw Object.assign(new Error('수집 중 원본 데이터 건수가 변경됐습니다. 잠시 후 다시 시도해 주세요.'),{status:502});
   total=data.total;if(!data.items.length&&rows.length<total)throw Object.assign(new Error('일부 주차장 데이터를 받지 못했습니다. 전체 수집을 다시 시도해 주세요.'),{status:502});
   rows.push(...data.items);progress={received:rows.length,total};page++;if(rows.length<total)await pause(350);
  }while(rows.length<total);
  const unique=new Map();let excluded=0;
  for(const row of rows){if(!coordinates(row.latitude,row.longitude)){excluded++;continue;}const p=Object.fromEntries(fields.map(k=>[k,String(row[k]??'').trim()]));const id=p.prkplceNo||[p.prkplceNm,p.latitude,p.longitude].join('|');const previous=unique.get(id);if(!previous||p.referenceDate>=previous.referenceDate)unique.set(id,p);}
  const next={version:1,complete:true,updatedAt:new Date().toISOString(),sourceTotal:total,excluded,items:[...unique.values()]};
  await mkdir(directory,{recursive:true});await writeFile(new URL('./parking.tmp.json',directory),JSON.stringify(next));await rename(new URL('./parking.tmp.json',directory),file);snapshot=next;lastError='';
 }
 return {async nearby({key,lat,lng,radius,freeOnly}){
  if(!key)throw Object.assign(new Error('터미널에서 주차장 API 키를 등록해 주세요.'),{status:503,code:'PARKING_KEY_REQUIRED'});
  await restore();const stale=!snapshot||Date.now()-Date.parse(snapshot.updatedAt)>86400000;
  if(stale&&!loading&&Date.now()>=retryAt){progress={received:0,total:0};lastError='';loading=sync(key).catch(e=>{lastError=e.status?e.message:'주차장 데이터 저장에 실패했습니다.';retryAt=Date.now()+15000;}).finally(()=>{loading=null;});}
  if(blocking&&loading)await loading;
  if(!snapshot){if(lastError&&!loading)throw Object.assign(new Error(lastError),{status:502});return {ready:false,syncing:Boolean(loading),progress};}
  return {ready:true,syncing:Boolean(loading),stale:Date.now()-Date.parse(snapshot.updatedAt)>86400000,warning:lastError||null,updatedAt:snapshot.updatedAt,sourceTotal:snapshot.sourceTotal,excluded:snapshot.excluded,indexed:snapshot.items.length,items:nearest(snapshot.items,lat,lng,radius,freeOnly),radius};
 }};
}
