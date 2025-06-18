# 부동산 정보 웹 애플리케이션

Flask 기반의 부동산 정보 조회 웹 애플리케이션입니다.

## 🆕 최신 업데이트 (네이버 클라우드 플랫폼 Maps API)

**중요**: 네이버 지도 API가 네이버 클라우드 플랫폼으로 이전되었습니다. 이제 새로운 API를 사용합니다.

### 변경 사항
- ✅ 네이버 클라우드 플랫폼 Maps API 적용
- ✅ 새로운 인증 방식 (헤더 기반)
- ✅ 지오코딩 API 서버 사이드 처리
- ✅ 안정적인 지도 표시 및 마커 기능

## 기능
- Google Sheets API를 통한 부동산 데이터 조회
- **네이버 클라우드 플랫폼 Maps API** 연동 (업데이트됨)
- 강남/송파 지역 월세/전세 정보 제공
- 실시간 지오코딩 및 지도 마커 표시

## 🔐 보안 설정 (중요!)

### 네이버 클라우드 플랫폼 Maps API 설정
현재 설정된 API 키:
- **Client ID**: `mxmsrqimlj`
- **Client Secret**: `PzStOTvfyk0zJ73XnglaVkA2VFcTV65mSZmzeqQG`

### Google 서비스 계정 키 관리
**절대 Google 서비스 계정 JSON 파일을 GitHub에 올리지 마세요!**

#### 방법 1: .env 파일 사용 (로컬 개발)
1. `env.example` 파일을 `.env`로 복사
2. 필요한 정보를 입력:

```bash
# .env 파일
# 네이버 클라우드 플랫폼 Maps API
NAVER_CLIENT_ID=mxmsrqimlj
NAVER_CLIENT_SECRET=PzStOTvfyk0zJ73XnglaVkA2VFcTV65mSZmzeqQG

# Google Sheets API
SPREADSHEET_ID=1C0-kWVHt_SvWIPfmCzKVOKr0pMFArixYNNhNw-vdCoE

# Google 서비스 계정 정보
GOOGLE_PROJECT_ID=thetopone
GOOGLE_PRIVATE_KEY_ID=your_private_key_id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"
GOOGLE_CLIENT_EMAIL=sheets-reader@thetopone.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_X509_CERT_URL=your_cert_url
```

## 배포 가이드

### Render 배포
1. **환경 변수 설정** (Render Dashboard → Environment):
```
NAVER_CLIENT_ID=mxmsrqimlj
NAVER_CLIENT_SECRET=PzStOTvfyk0zJ73XnglaVkA2VFcTV65mSZmzeqQG
SPREADSHEET_ID=1C0-kWVHt_SvWIPfmCzKVOKr0pMFArixYNNhNw-vdCoE
SESSION_SECRET=your_session_secret_key

# Google 서비스 계정 정보
GOOGLE_PROJECT_ID=thetopone
GOOGLE_PRIVATE_KEY_ID=your_private_key_id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"
GOOGLE_CLIENT_EMAIL=sheets-reader@thetopone.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_X509_CERT_URL=your_cert_url
```

2. **빌드 설정**:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python main.py` 또는 `bash start.sh`

### GitHub Pages (simonlee89/no.5)
GitHub 저장소: `simonlee89/no.5`에 코드가 업로드되어 있습니다.

## 로컬 실행

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. 환경 변수 설정
```bash
# .env 파일 생성
cp env.example .env
# .env 파일에 실제 값 입력
```

### 3. 실행
```bash
python main.py
# 또는
python app.py
```

## API 엔드포인트

- `GET /`: 메인 페이지
- `GET /api/properties/<sheet_type>`: 매물 데이터 조회
- `GET /api/geocode?address=<주소>`: 주소 → 위도/경도 변환
- `GET /health`: 서버 상태 확인

## 기술 스택
- **Backend**: Flask, Python
- **Maps**: 네이버 클라우드 플랫폼 Maps API
- **Data**: Google Sheets API
- **Frontend**: HTML, CSS, JavaScript
- **Deployment**: Render.com

## 파일 구조
```
├── main.py                 # 메인 Flask 애플리케이션
├── app.py                  # 대체 Flask 애플리케이션
├── ncp_maps_utils.py       # 네이버 클라우드 플랫폼 Maps API 유틸리티
├── sheets_service.py       # Google Sheets API 서비스
├── google_auth_utils.py    # 구글 인증 유틸리티
├── config.py              # 설정 파일
├── requirements.txt       # Python 의존성
├── .env                   # 환경 변수 (로컬용, Git 제외)
├── env.example           # 환경 변수 예시
├── static/               # 정적 파일
│   ├── css/style.css     # 스타일시트
│   └── js/map.js         # 지도 JavaScript
└── templates/            # HTML 템플릿
    ├── base.html         # 기본 템플릿
    └── index.html        # 메인 페이지
```

## 트러블슈팅

### 지도가 표시되지 않을 때
1. 네이버 클라우드 플랫폼 API 키 확인
2. 브라우저 개발자 도구에서 콘솔 에러 확인
3. `/api/geocode` 엔드포인트 테스트

### 매물 데이터가 로드되지 않을 때
1. Google Sheets API 인증 확인
2. 스프레드시트 공유 권한 확인
3. `/health` 엔드포인트에서 서버 상태 확인

## 라이선스
MIT License