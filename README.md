# 포트립 Paw Trip

## Vercel 배포

1. Vercel에서 이 GitHub 저장소를 Import합니다. Root Directory는 저장소 루트입니다.
2. Framework Preset은 Other, Output Directory는 `public`을 사용합니다. `vercel.json`에 함수 경로와 API 재작성이 포함됩니다. Node.js는 22.x입니다.
3. Vercel 프로젝트 Settings → Environment Variables에 `TOUR_API_KEY`, `PARKING_API_KEY`를 각각 등록합니다. Production/Preview 중 사용할 환경에 적용하세요. 값은 로컬에 등록한 키를 사용하며 코드나 GitHub에 붙여넣지 않습니다.
4. 필요 시 `TOUR_CONTENT_TYPES=legacy`를 등록합니다. 현재 기본값도 legacy입니다.
5. Deploy 후 여행지 검색과 상세 → 주차장 추천을 확인합니다. 환경변수를 나중에 변경했다면 Redeploy합니다.

GitHub 업로드는 웹서비스의 Vercel 배포 완료를 뜻하지 않습니다. 로컬 `.env`는 GitHub/Vercel로 복사하지 않으며, Vercel에는 환경변수를 별도로 등록해야 합니다. `NEXT_PUBLIC_`/`VITE_` 접두어를 붙이지 마세요.

Vercel용 API 진입점은 `api/index.mjs`입니다. 함수 실행에서는 서버 포트를 열지 않으며 `/tmp`에 임시 캐시를 저장합니다. 데이터 갱신은 응답 전에 대기하여 서버리스 응답 이후 작업 중단에 의존하지 않습니다. 공개 압축 기준 자료가 포함되어 콜드 스타트 시에도 기본 주차장 정보를 사용할 수 있습니다. Vercel 인스턴스 간 캐시는 공유되지 않으므로 큰 서비스로 확대하면 공유 저장소와 정기 수집 작업으로 전환해야 합니다. 현재 함수 최대 실행시간은 60초입니다. 최신 전국 수집이 실패하면 기준 자료와 이전 데이터 안내를 제공합니다.

`.gitignore`와 `.vercelignore` 양쪽에서 `.env`를 제외합니다. 업로드 전 `npm run check:secrets`로 스테이징 파일과 실제 등록한 키(인코딩 변형 포함)를 검사합니다. `.env.example`은 빈 설정 예시만 포함합니다.

## 주변 주차장 추천 추가

여행지 상세 화면 아래의 **주차장 추천 보기**에서 반경 1·3·5km를 선택하고 무료 주차장만 골라볼 수 있습니다. 여행지 좌표 기준 직선거리 순으로 최대 8곳을 표시합니다. 실제 보행·주행 경로와 실시간 빈자리 수는 제공하지 않습니다. 주차면수는 전체 수용 규모입니다.

주차장 키를 등록하려면 다음을 실행하세요. 기존 관광공사 키와 나머지 `.env` 설정은 보존됩니다.

```powershell
Set-Location -LiteralPath 'D:\[진행중]관광자원 분류 조사\MINJI DATA\paw-trip'
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\register-parking-key.ps1
```

프롬프트에 **키만** 붙여넣고 Enter를 누릅니다. `PARKING_API_KEY=`를 직접 입력하지 않습니다. 입력은 숨겨지고 `.env`의 `PARKING_API_KEY`로 저장됩니다. 서버는 요청마다 설정을 읽으므로 키 저장 후 재시작 없이 사용할 수 있습니다. 서버 소스 변경 시에는 서버 재시작이 필요합니다.

공식 활용신청·명세: https://www.data.go.kr/data/15012896/standard.do

서버는 `https://api.data.go.kr/openapi/tn_pubr_prkplce_info_api`를 페이지당 1,000건씩 호출합니다. 첫 추천 요청 시 전국 데이터를 수집하고 전체 페이지가 완료된 뒤에만 추천을 제공합니다. 진행 중에는 수집 건수를 표시하며 자동 확인합니다. 좌표 없는 행을 제외하고 관리번호로 중복을 합치되 최신 기준일 자료를 우선합니다. 반경 검색 API가 없으므로 전국 수집본에서 Haversine 직선거리를 계산합니다.

공개 주차장 자료만 `.cache/parking.json`에 저장하며 키는 캐시에 포함하지 않습니다. 캐시는 Git에서 제외됩니다. 24시간이 지난 캐시는 다음 조회에서 갱신하며, 갱신 중·실패 시 이전 자료 사용 여부를 표시합니다. 수집 한도(500페이지) 초과, 원본 건수 변경, 일부 페이지 오류 시 완료로 취급하지 않습니다. 첫 전국 수집 시간은 API 응답 속도와 건수에 따라 달라집니다.

요금·운영시간·전체 주차면수·결제수단·특기사항·데이터 기준일과 지도/전화 링크를 제공합니다. 빈 값은 ‘정보 미제공’으로 표시하며 기본요금 0을 임의로 무료로 판단하지 않습니다. ‘무료만 보기’는 원본 요금 구분이 ‘무료’인 자료에만 적용합니다. 여행지 좌표가 없으면 거리 추천을 제공하지 않습니다. 주차장 정보는 반려동물 동반 출입 허용을 의미하지 않습니다.

한국관광공사 반려동물 동반여행 서비스로 지역별 여행지를 검색하는 로컬 웹서비스입니다. Node.js 22 이상이 필요하며 추가 패키지 설치는 필요 없습니다.

## 실행과 키 등록

PowerShell에서 다음을 실행합니다.

```powershell
Set-Location -LiteralPath 'D:\[진행중]관광자원 분류 조사\MINJI DATA\paw-trip'
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\register-key.ps1
```

`API 키 붙여넣기 후 Enter:`가 나오면 키만 붙여넣고 Enter를 누릅니다. 앞에 `TOUR_API_KEY=` 또는 다른 명령을 붙이지 않습니다. 입력 문자는 표시되지 않습니다. 일반 인증키의 Encoding / Decoding 값 모두 지원합니다. 키는 프로젝트 `.env`의 `TOUR_API_KEY`에 저장되고 화면·로그·브라우저 요청에 노출되지 않습니다. 서버가 이미 실행 중이면 페이지에서 ‘다시 시도’를 누릅니다. 미실행 상태라면 등록 스크립트가 서버를 시작합니다.

다음부터 실행:

```powershell
Set-Location -LiteralPath 'D:\[진행중]관광자원 분류 조사\MINJI DATA\paw-trip'
npm start
```

브라우저: http://localhost:3000 · 종료: 실행 터미널에서 Ctrl+C

## 기능

- 전국 17개 시도 및 API 기반 시군구 선택
- 지역·유형·키워드 검색, 정렬과 페이지 이동
- 기본 정보, 동반 가능 동물, 준비사항, 시설·대여품목·안전정보 상세 조회
- 브라우저에 여행지 저장, 네이버 지도 검색, 전화 문의
- 실제 API 오류·빈 결과·미등록 상태 구분, 5분 서버 메모리 캐시
- 모바일 대응, 키보드 조작과 상세 모달

## 인증과 보안

공공데이터포털에서 **한국관광공사_반려동물_동반여행_서비스**를 활용신청한 키를 사용하세요.
공식 서비스: https://www.data.go.kr/data/15135102/openapi.do
사용자가 제공한 계정 URL은 로그인 후 활용신청 계정 화면입니다. 데이터 호출은 서버에서 `https://apis.data.go.kr/B551011/KorPetTourService2/`로 수행합니다.

`.env`와 `.env.*`는 `.gitignore`에 포함되며 예시 파일만 추적할 수 있습니다. 정적 파일은 public의 허용된 네 파일만 제공해 `.env`, 서버 소스, 매뉴얼에 HTTP로 접근할 수 없습니다. 비밀키를 프런트엔드 환경변수로 옮기지 마세요. `.env`는 로컬 평문 파일이므로 OS 계정의 파일 접근 권한으로 관리하며 프로젝트를 공유할 때 제외하세요.

## API 규격

첨부 ZIP 내 반려동물동반여행 v4.1 매뉴얼을 참고했습니다. 문서 내용은 API 구현 참고 자료로만 사용했습니다.
목록 `areaBasedList2`, 키워드 `searchKeyword2`, 시군구 `ldongCode2`, 기본 상세 `detailCommon2`, 동반 상세 `detailPetTour2`를 호출합니다. 법정동 파라미터 `lDongRegnCd`, `lDongSignguCd`를 사용합니다.

첨부 문서에는 기존 유형(12/14/15/28/32/38/39)과 신규 유형(75~85)이 혼재합니다. 문서의 실제 요청·응답 예제에 맞춰 `TOUR_CONTENT_TYPES=legacy`를 기본 적용했습니다. 실제 키 등록 후 유형 검색이 맞지 않고 제공기관이 신규 코드를 요구하면 `.env`에서 `TOUR_CONTENT_TYPES=modern`으로 바꿀 수 있습니다. 키 등록 전에는 실데이터 연결과 유형별 응답을 검증할 수 없습니다.

API 제공 사진의 원본 저작권 구분은 응답에 보존됩니다. 방문 전 시설 운영·동반 조건을 재확인하세요. UI 장식 일러스트는 로컬 SVG이며 특정 여행지의 사진이 아닙니다. 미등록 상태에 예시 여행지를 실제 검색 결과로 표시하지 않습니다.

## 확인

```powershell
npm test
```

키 인코딩, JSON 응답 정규화, 게이트웨이 XML 오류와 민감 응답 차단을 검사합니다. API 키 등록 후 첫 실제 검색은 별도로 확인해야 합니다.
