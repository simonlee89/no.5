# 부동산 정보 웹 애플리케이션

Flask 기반의 부동산 정보 조회 웹 애플리케이션입니다.

## 기능
- Google Sheets API를 통한 부동산 데이터 조회
- Naver Maps API 연동
- 강남/송파 지역 월세/전세 정보 제공

## 🔐 보안 설정 (중요!)

### Google 서비스 계정 키 관리
**절대 Google 서비스 계정 JSON 파일을 GitHub에 올리지 마세요!**

#### 방법 1: .env 파일 사용 (로컬 개발)
1. `env.example` 파일을 `.env`로 복사
2. Google 서비스 계정 정보를 입력:

```bash
# .env 파일
GOOGLE_PROJECT_ID=thetopone
GOOGLE_PRIVATE_KEY_ID=your_private_key_id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"
GOOGLE_CLIENT_EMAIL=sheets-reader@thetopone.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_X509_CERT_URL=your_cert_url
```

#### 방법 2: 환경 변수로 직접 설정
```bash
export GOOGLE_PROJECT_ID="thetopone"
export GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
export GOOGLE_CLIENT_EMAIL="sheets-reader@thetopone.iam.gserviceaccount.com"
# ... 기타 필요한 변수들
```

#### 방법 3: JSON 전체를 환경 변수로 설정 (배포 환경)
```bash
export GOOGLE_CREDENTIALS='{"type":"service_account","project_id":"thetopone",...}'
```

## Render 배포 가이드

### 1. Render 계정 생성 및 GitHub 연동
1. [Render.com](https://render.com)에서 계정 생성
2. GitHub 계정으로 로그인

### 2. 새 Web Service 생성
1. Dashboard에서 "New +" 클릭
2. "Web Service" 선택
3. GitHub 저장소 연결

### 3. 배포 설정
- **Name**: 원하는 서비스 이름
- **Environment**: Python 3
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `bash start.sh`

### 4. 환경 변수 설정
Render Dashboard의 Environment 탭에서 다음 환경 변수들을 설정하세요:

```
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
SPREADSHEET_ID=your_google_sheets_id
SESSION_SECRET=your_session_secret_key

# Google 서비스 계정 정보 (방법 1: 개별 변수)
GOOGLE_PROJECT_ID=thetopone
GOOGLE_PRIVATE_KEY_ID=your_private_key_id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"
GOOGLE_CLIENT_EMAIL=sheets-reader@thetopone.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_X509_CERT_URL=your_cert_url

# 또는 (방법 2: JSON 전체)
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"thetopone",...}
```

### 5. Google Sheets API 인증
1. Google Cloud Console에서 서비스 계정 생성
2. JSON 키 다운로드
3. **JSON 파일을 GitHub에 올리지 말고** 환경 변수로 설정
4. Google Sheets를 서비스 계정 이메일과 공유

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
```

## 기술 스택
- Flask
- Gunicorn
- Google Sheets API
- Naver Maps API
- python-dotenv

## 파일 구조
```
├── main.py                 # Flask 애플리케이션
├── sheets_service.py       # Google Sheets API 서비스
├── google_auth_utils.py    # 인증 유틸리티
├── config.py              # 설정 파일
├── requirements.txt       # Python 의존성
├── .env                   # 환경 변수 (로컬용, Git 제외)
├── env.example           # 환경 변수 예시
├── .gitignore            # Git 제외 파일 목록
└── templates/            # HTML 템플릿
```