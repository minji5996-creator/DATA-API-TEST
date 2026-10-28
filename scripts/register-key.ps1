param([ValidateSet('tour','parking')][string]$Service = 'tour')
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDir
Write-Host ''

$envName = if ($Service -eq 'parking') { 'PARKING_API_KEY' } else { 'TOUR_API_KEY' }
$serviceName = if ($Service -eq 'parking') { '전국주차장정보표준데이터' } else { '한국관광공사 반려동물 동반여행 서비스' }
Write-Host ('Paw Trip | ' + $serviceName + ' 키 등록') -ForegroundColor Green
Write-Host '해당 서비스 활용신청 후 발급받은 키를 입력하세요. 기존에 등록한 다른 API 키는 보존됩니다.'
Write-Host 'Decoding / Encoding 키 모두 지원합니다. 입력 내용은 화면에 표시되지 않습니다.'
do {
    $secret = Read-Host 'API 키 붙여넣기 후 Enter' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    try { $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    $valid = $apiKey -match '^[A-Za-z0-9%+/=_-]{16,512}$'
    if (-not $valid) { Write-Host '키 형식을 확인해 다시 입력하세요.' -ForegroundColor Yellow }
} until ($valid)
$envPath = Join-Path $projectDir '.env'
$existing = if (Test-Path -LiteralPath $envPath) { [IO.File]::ReadAllLines($envPath) | Where-Object { $_ -notmatch ('^' + $envName + '=') } } else { @('PORT=3000','TOUR_CONTENT_TYPES=legacy') }
[IO.File]::WriteAllLines($envPath, @($existing) + ($envName + '=' + $apiKey), [Text.UTF8Encoding]::new($false))
$apiKey = $null
$secret.Dispose()
Write-Host '.env 저장 완료. 키 값은 표시하지 않습니다.' -ForegroundColor Green
try {
    $ready = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/status' -TimeoutSec 2
    Write-Host '실행 중인 웹페이지를 새로고침하세요: http://localhost:3000'
} catch {
    Write-Host '서버를 시작합니다: http://localhost:3000'
    node server.mjs
}
