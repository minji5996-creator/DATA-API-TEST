export const BASE='https://apis.data.go.kr/B551011/KorPetTourService2/';
export function normalizeKey(key){try{return decodeURIComponent(key.trim());}catch{return key.trim();}}
export function parsePayload(raw){
 let data;try{data=JSON.parse(raw);}catch{
  const code=raw.match(/<returnReasonCode>([^<]+)</)?.[1];
  throw apiError(code);
 }
 const r=data.response;
 if(!r || !['0000','00','0'].includes(String(r.header?.resultCode)))throw apiError(r?.header?.resultCode);
 const b=r.body||{};const items=b.items?.item;
 return {items:items?(Array.isArray(items)?items:[items]):[],total:Number(b.totalCount)||0};
}
function apiError(code){const messages={'20':'해당 서비스의 활용신청 승인 상태를 확인해 주세요.','22':'오늘의 API 호출 한도에 도달했습니다.','23':'요청이 많습니다. 잠시 후 다시 시도해 주세요.','30':'인증키 또는 서비스 활용신청 상태를 확인해 주세요.','31':'API 이용 기간이 만료되었습니다.','10':'검색 조건을 처리하지 못했습니다.','12':'API 서비스 주소를 확인해야 합니다.'};return Object.assign(new Error(messages[code]||'관광정보 제공 서버의 응답을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'),{status:502});}
export function buildUrl(operation,params,key){const u=new URL(operation,BASE);u.search=new URLSearchParams({MobileOS:'ETC',MobileApp:'PawTrip',_type:'json',numOfRows:'12',pageNo:'1',...params,serviceKey:normalizeKey(key)});return u;}
export const TYPES={legacy:{nature:'12',culture:'14',stay:'32',food:'39',sports:'28',shop:'38',festival:'15'},modern:{nature:'76',culture:'78',stay:'80',food:'82',sports:'75',shop:'79',festival:'85'}};
