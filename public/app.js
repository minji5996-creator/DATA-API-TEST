const $=s=>document.querySelector(s);
const regionNames=[['11','서울'],['26','부산'],['27','대구'],['28','인천'],['29','광주'],['30','대전'],['31','울산'],['36','세종'],['41','경기'],['51','강원'],['43','충북'],['44','충남'],['52','전북'],['46','전남'],['47','경북'],['48','경남'],['50','제주']];
const typeNames={12:'관광지',14:'문화시설',15:'축제·행사',28:'레포츠',32:'숙소',38:'쇼핑',39:'음식점',75:'레포츠',76:'관광지',77:'교통',78:'문화시설',79:'쇼핑',80:'숙소',82:'음식점',85:'축제·행사'};
let page=1,total=0,category='',savedView=false,requestId=0,detailId=0,cityId=0;
let favorites;try{favorites=JSON.parse(localStorage.getItem('paw-trip-saved')||'[]');if(!Array.isArray(favorites))favorites=[];}catch{favorites=[];}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function option(code,name){const o=el('option','',name);o.value=code;return o;}
regionNames.forEach(([code,name])=>$('#region').append(option(code,name)));
function plain(value){const d=new DOMParser().parseFromString(String(value||''),'text/html');return (d.body.textContent||'').trim();}
function photo(src){try{const u=new URL(src);if(u.hostname==='tong.visitkorea.or.kr'){u.protocol='https:';return u.href;}}catch{}return '';}
function image(src,title,cls){const url=photo(src);if(!url){const n=el('div',`${cls} image-placeholder`);n.append(el('span','','♧'),el('small','','등록된 사진이 없어요'));return n;}const img=el('img',cls);img.src=url;img.alt=title;img.loading='lazy';img.addEventListener('error',()=>img.replaceWith(image('',title,cls)),{once:true});return img;}
async function api(url){const r=await fetch(url);const d=await r.json();if(!r.ok)throw Object.assign(new Error(d.error||'요청에 실패했습니다.'),{code:d.code});return d;}
function state(title,message,{retry=false,error=false}={}){const box=el('div','state'+(error?' error':''));box.append(el('span','state-icon',error?'!':'✿'),el('h4','',title),el('p','',message));if(retry){const b=el('button','','다시 시도');b.onclick=load;box.append(b);}$('#status').replaceChildren(box);}
function updateSaveCount(){$('#save-count').textContent=favorites.length;$('#saved').setAttribute('aria-pressed',String(savedView));}
function toggleSave(item){const i=favorites.findIndex(p=>p.contentid===item.contentid);if(i>=0)favorites.splice(i,1);else favorites.push(item);try{localStorage.setItem('paw-trip-saved',JSON.stringify(favorites));}catch{state('저장 공간을 사용할 수 없어요','현재 화면에서는 저장 목록을 유지하지만 브라우저를 닫으면 사라질 수 있습니다.');}updateSaveCount();}
function render(items){$('#cards').replaceChildren();items.forEach(item=>{const card=el('article','card');const main=el('button','card-main');main.type='button';main.setAttribute('aria-label',`${plain(item.title)} 상세 정보`);main.append(image(item.firstimage||item.firstimage2,plain(item.title),'card-image'));const content=el('div','card-content');content.append(el('span','badge',typeNames[item.contenttypeid]||'동반 여행지'),el('h4','',plain(item.title)),el('p','',plain(item.addr1)||'주소 정보 미제공'));main.append(content);main.onclick=()=>openDetail(item);const save=el('button','save-place');save.type='button';const paint=()=>{const yes=favorites.some(p=>p.contentid===item.contentid);save.textContent=yes?'♥':'♡';save.setAttribute('aria-label',`${plain(item.title)} ${yes?'저장 취소':'저장'}`);save.setAttribute('aria-pressed',String(yes));};paint();save.onclick=()=>{toggleSave(item);paint();if(savedView)load();};const bottom=el('div','card-bottom');bottom.append(el('span','','동반 조건 확인하기'),el('span','','↗'));card.append(main,save,bottom);$('#cards').append(card);});}
function paging(){$('#page-label').textContent=savedView?'저장 목록':`${page} 페이지`;$('#prev').disabled=savedView||page<=1;$('#next').disabled=savedView||page*12>=total;}
async function load(){const id=++requestId;$('#cards').replaceChildren();$('#total').textContent='';$('#results-title').textContent=savedView?'저장한 여행지':'함께 떠나는 여행지';$('#prev').disabled=true;$('#next').disabled=true;
 if(savedView){$('#status').replaceChildren();total=favorites.length;render(favorites);$('#total').textContent=`${total}곳`;if(!total)state('마음에 드는 곳을 모아보세요','여행지 카드의 하트를 누르면 이곳에 저장돼요.');paging();return;}
 state('함께 갈 여행지를 찾고 있어요','관광공사에서 여행 정보를 불러오는 중입니다.');
 const q=new URLSearchParams({page,region:$('#region').value,city:$('#city').value,category,keyword:$('#keyword').value,sort:$('#sort').value});
 try{const data=await api(`/api/places?${q}`);if(id!==requestId)return;total=data.total;$('#status').replaceChildren();render(data.items);$('#total').textContent=`${total.toLocaleString()}곳`;if(!data.items.length)state('조건에 맞는 여행지가 없어요','다른 지역이나 검색어로 새로운 여행지를 찾아보세요.');paging();}
 catch(e){if(id!==requestId)return;total=0;paging();if(e.code==='KEY_REQUIRED')state('여행을 시작할 준비가 됐어요','터미널에서 API 키를 등록한 뒤 아래 버튼을 눌러주세요. 등록 후 실제 여행지가 표시됩니다.',{retry:true});else state('여행지를 불러오지 못했어요',e.message,{retry:true,error:true});}
}
async function cities(){const id=++cityId;$('#city').replaceChildren(option('','전체 지역'));$('#city').disabled=true;const code=$('#region').value;if(!code)return;try{const data=await api(`/api/regions?region=${code}`);if(id!==cityId)return;data.items.forEach(i=>$('#city').append(option(i.code,i.name)));$('#city').disabled=false;}catch{if(id===cityId)$('#city').replaceChildren(option('','시군구 조회 불가'));}}
async function openDetail(item){const id=++detailId;const dialog=$('#detail');$('#detail-body').replaceChildren(el('div','state','상세 정보를 불러오는 중입니다…'));if(!dialog.open)dialog.showModal();
 try{const data=await api(`/api/places/${encodeURIComponent(item.contentid)}`);if(id!==detailId)return;const common={...item,...data.common},pet=data.pet;const content=el('div','detail-content');content.append(el('span','eyebrow','TRAVEL TOGETHER'),el('h2','',plain(common.title)),el('p','',plain([common.addr1,common.addr2].filter(Boolean).join(' '))),el('p','',plain(common.overview)||'장소 소개 정보가 제공되지 않았습니다.'));
 const info=el('section','pet-info');info.append(el('h3','','함께 가기 전에 확인해요'));const dl=el('dl');const fields=[['동반 가능 동물','acmpyPsblCpam'],['동반 구역·유형','acmpyTypeCd'],['필수 준비사항','acmpyNeedMtr'],['구비 시설','relaPosesFclty'],['비치 품목','relaFrnshPrdlst'],['대여 품목','relaRntlPrdlst'],['구매 품목','relaPurcPrdlst'],['안전 유의사항','relaAcdntRiskMtr'],['기타 동반 정보','etcAcmpyInfo']];fields.forEach(([label,key])=>dl.append(el('dt','',label),el('dd','',plain(pet[key])||'정보 미제공 · 시설에 문의해 주세요')));info.append(dl);content.append(info);
 if(data.partial)content.append(el('p','notice','일부 상세 정보를 불러오지 못했습니다. 다시 열어 확인해 주세요.'));
 const links=el('div','detail-links');const map=el('a','','네이버 지도에서 찾기 ↗');map.href=`https://map.naver.com/p/search/${encodeURIComponent(plain(common.title)+' '+plain(common.addr1))}`;map.target='_blank';map.rel='noopener noreferrer';links.append(map);
 const phone=plain(common.tel).replace(/[^0-9+\-]/g,'');if(phone){const tel=el('a','',`문의 ${phone}`);tel.href=`tel:${phone}`;links.append(tel);}content.append(links,el('p','notice','동반 조건과 운영 정보는 변경될 수 있습니다. 방문 전 시설에 문의해 주세요. 정보 출처: 한국관광공사 TourAPI.'));
 content.append(parkingSection(common,id));
 $('#detail-body').replaceChildren(image(common.firstimage||common.firstimage2,plain(common.title),'detail-image'),content);
 }catch(e){if(id!==detailId)return;const box=el('div','state error');box.append(el('h4','','상세 정보를 불러오지 못했어요'),el('p','',e.message));const retry=el('button','','다시 시도');retry.onclick=()=>openDetail(item);box.append(retry);$('#detail-body').replaceChildren(box);}}
function parkingSection(place,detailRequest){
 const section=el('section','parking-section');section.append(el('span','eyebrow','PARK & WALK'),el('h3','','이 여행지 근처, 어디에 주차할까요?'));
 const description=el('p','notice','여행지 좌표에서 직선거리 순으로 최대 8곳을 추천해요. 실제 이동거리와 다르며, 실시간 빈자리 정보는 제공하지 않습니다.');section.append(description);
 const lat=String(place.mapy??'').trim(),lng=String(place.mapx??'').trim();
 if(!lat||!lng||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng))||Number(lat)<32||Number(lat)>40||Number(lng)<124||Number(lng)>132){section.append(el('p','parking-message','여행지 좌표가 제공되지 않아 거리 기준 주차장 추천을 사용할 수 없습니다.'));return section;}
 const controls=el('div','parking-controls');const radiusLabel=el('label','','검색 반경 '),radius=el('select');radius.setAttribute('aria-label','주차장 검색 반경');[1,3,5].forEach(n=>radius.append(option(String(n),`${n} km`)));radius.value='3';radiusLabel.append(radius);
 const freeLabel=el('label','free-label');const free=el('input');free.type='checkbox';freeLabel.append(free,document.createTextNode('무료만 보기'));
 const button=el('button','parking-search','주차장 추천 보기');button.type='button';controls.append(radiusLabel,freeLabel,button);
 const message=el('div','parking-message');message.setAttribute('role','status');message.setAttribute('aria-live','polite');const list=el('div','parking-list');section.append(controls,message,list);
 let sequence=0,started=false;
 async function search(token){if(detailRequest!==detailId||token!==sequence)return;button.disabled=true;list.replaceChildren();message.textContent='전국 주차장 데이터를 확인하고 있어요…';
  try{const data=await api('/api/parking?'+new URLSearchParams({lat,lng,radius:radius.value,free:free.checked?'1':'0'}));if(detailRequest!==detailId||token!==sequence)return;
   if(!data.ready){message.textContent=`첫 조회를 위해 전국 데이터를 준비 중이에요. ${data.progress.received.toLocaleString()} / ${data.progress.total?data.progress.total.toLocaleString():'확인 중'}건 · 준비가 끝나면 자동으로 표시됩니다.`;setTimeout(()=>search(token),3000);return;}
   button.disabled=false;button.textContent='주차장 다시 찾기';
   message.textContent=`${data.items.length}곳 추천 · 직선거리 순 · 전국 ${data.sourceTotal.toLocaleString()}건 수집, 유효 좌표 ${data.indexed.toLocaleString()}곳 기준${data.stale?' · 이전 수집 데이터 사용 중':''}${data.syncing?' · 최신 데이터 갱신 중':''}${data.warning?' · '+data.warning:''}`;
   if(!data.items.length)list.append(el('p','notice',`반경 ${radius.value}km 안에 조건에 맞는 등록 주차장이 없습니다. 반경 또는 무료 조건을 바꿔보세요.`));
   data.items.forEach((p,i)=>{const card=el('article','parking-card'),head=el('div','parking-card-head');head.append(el('h4','',`${i+1}. ${plain(p.prkplceNm)||'이름 미제공'}`),el('span','badge',p.distanceKm<1?`${Math.round(p.distanceKm*1000)}m`:`${p.distanceKm.toFixed(2)}km`));card.append(head,el('p','',plain(p.rdnmadr||p.lnmadr)||'주소 미제공'));
    const dl=el('dl');const fee=p.parkingchrgeInfo==='무료'?'무료':`${plain(p.parkingchrgeInfo)||'요금 구분 미제공'}${p.basicCharge!==''&&p.basicTime!==''?` · 기본 ${p.basicTime}분 ${p.basicCharge}원`:''}${p.addUnitTime!==''&&p.addUnitCharge!==''?` · 추가 ${p.addUnitTime}분 ${p.addUnitCharge}원`:''}`;
    const hours=(a,b)=>a&&b?`${a} ~ ${b}`:'정보 미제공';
    const values=[['주차장',`${p.prkplceSe||'구분 미제공'} · ${p.prkplceType||'유형 미제공'}`],['요금',fee],['1일 주차권',p.dayCmmtkt!==''&&Number(p.dayCmmtkt)>0?`${p.dayCmmtkt}원`:'정보 미제공'],['전체 주차면',p.prkcmprt!==''?`${p.prkcmprt}면 (빈자리 수 아님)`:'정보 미제공'],['운영요일',p.operDay||'정보 미제공'],['평일 운영',hours(p.weekdayOperOpenHhmm,p.weekdayOperColseHhmm)],['토요일 운영',hours(p.satOperOperOpenHhmm,p.satOperCloseHhmm)],['공휴일 운영',hours(p.holidayOperOpenHhmm,p.holidayCloseOpenHhmm)],['결제방법',p.metpay||'정보 미제공'],['특기사항',p.spcmnt||'정보 미제공'],['데이터 기준일',p.referenceDate||'정보 미제공']];values.forEach(([k,v])=>dl.append(el('dt','',k),el('dd','',plain(v))));card.append(dl);
    const links=el('div','detail-links'),map=el('a','','주차장 지도 보기 ↗');map.href='https://map.naver.com/p/search/'+encodeURIComponent([p.prkplceNm,p.rdnmadr||p.lnmadr].filter(Boolean).join(' '));map.target='_blank';map.rel='noopener noreferrer';links.append(map);const phone=String(p.phoneNumber||'').replace(/[^0-9+\-]/g,'');if(phone){const tel=el('a','',`문의 ${phone}`);tel.href=`tel:${phone}`;links.append(tel);}card.append(links);list.append(card);});
   const source=el('a','parking-source','출처: 전국주차장정보표준데이터 ↗');source.href='https://www.data.go.kr/data/15012896/standard.do';source.target='_blank';source.rel='noopener noreferrer';list.append(source,el('p','notice',`서버 수집 시각: ${new Date(data.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} (한국시간). 좌표가 없는 자료는 거리 계산에서 제외됩니다. 운영·요금·출입 가능 여부는 방문 전 확인해 주세요.`));
  }catch(e){if(detailRequest!==detailId||token!==sequence)return;button.disabled=false;button.textContent='다시 시도';message.textContent=e.code==='PARKING_KEY_REQUIRED'?'터미널에서 주차장 API 키를 등록한 뒤 다시 시도해 주세요.':e.message;}
 }
 button.onclick=()=>{started=true;search(++sequence);};radius.onchange=free.onchange=()=>{if(started)search(++sequence);};return section;
}
$('#search-form').onsubmit=e=>{e.preventDefault();savedView=false;page=1;updateSaveCount();load();};
$('#region').onchange=()=>cities();
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;document.querySelectorAll('[data-category]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});savedView=false;page=1;updateSaveCount();load();});
$('#sort').onchange=()=>{page=1;load();};$('#prev').onclick=()=>{page--;load();};$('#next').onclick=()=>{page++;load();};
$('#saved').onclick=()=>{savedView=!savedView;page=1;updateSaveCount();load();$('#explore').scrollIntoView({behavior:'smooth'});};
$('#close-detail').onclick=()=>$('#detail').close();$('#detail').addEventListener('close',()=>{detailId++;});$('#detail').addEventListener('click',e=>{if(e.target===$('#detail')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
updateSaveCount();load();
