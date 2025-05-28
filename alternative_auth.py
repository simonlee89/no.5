"""
Google Sheets API 인증 문제 해결을 위한 대안 방법들
"""

import json
import requests
import logging
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from google_auth_utils import load_google_credentials_from_env, load_dotenv_if_exists

def try_public_sheets_access(spreadsheet_id):
    """
    공개 스프레드시트인 경우 API 키 없이 접근 시도
    """
    try:
        # 공개 스프레드시트 URL 형식
        public_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv&gid=0"
        
        print(f"공개 접근 시도: {public_url}")
        
        response = requests.get(public_url, timeout=10)
        
        if response.status_code == 200:
            print("✅ 공개 접근 성공!")
            print(f"데이터 크기: {len(response.content)} bytes")
            return True
        else:
            print(f"❌ 공개 접근 실패: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ 공개 접근 오류: {str(e)}")
        return False

def check_service_account_status():
    """
    서비스 계정 상태 확인
    """
    try:
        with open('thetopone-552b3537bc76.json', 'r') as f:
            creds = json.load(f)
        
        print("=== 서비스 계정 정보 ===")
        print(f"이메일: {creds.get('client_email')}")
        print(f"프로젝트 ID: {creds.get('project_id')}")
        print(f"키 ID: {creds.get('private_key_id')}")
        print(f"생성일: {creds.get('private_key_id')[:8]}")  # 키 ID 앞부분이 생성일 정보 포함
        
        # 키가 언제 생성되었는지 추정
        key_id = creds.get('private_key_id', '')
        if key_id:
            print(f"\n💡 이 키는 오래된 것 같습니다.")
            print("Google에서 보안상의 이유로 오래된 키를 무효화했을 수 있습니다.")
        
        return True
        
    except Exception as e:
        print(f"❌ 서비스 계정 정보 확인 실패: {str(e)}")
        return False

def suggest_solutions():
    """
    해결 방법 제안
    """
    print("\n=== 해결 방법 제안 ===")
    print("1. 🔑 새 서비스 계정 키 생성 (권장)")
    print("   - Google Cloud Console → IAM → 서비스 계정")
    print("   - 기존 계정 선택 → 키 탭 → 새 키 만들기")
    print("   - JSON 형식으로 다운로드")
    
    print("\n2. 📊 스프레드시트 공개 설정")
    print("   - Google Sheets에서 '공유' 클릭")
    print("   - '링크가 있는 모든 사용자' 권한 설정")
    print("   - 그러면 API 키 없이도 접근 가능")
    
    print("\n3. 🔄 기존 키 재활성화")
    print("   - Google Cloud Console에서 서비스 계정 확인")
    print("   - 키가 비활성화되었는지 확인")
    print("   - 필요시 새 키 생성")

def create_service_with_json():
    """JSON 파일 또는 환경 변수를 사용하여 서비스 생성"""
    try:
        # .env 파일 로드 시도
        load_dotenv_if_exists()
        
        # 환경 변수에서 Google 인증 정보 확인
        google_credentials_env = os.getenv('GOOGLE_CREDENTIALS')
        
        if google_credentials_env:
            # 환경 변수에서 JSON 형태로 인증 정보 사용
            try:
                credentials_info = json.loads(google_credentials_env)
                logging.info("Using Google credentials from GOOGLE_CREDENTIALS environment variable")
            except json.JSONDecodeError:
                logging.error("Invalid JSON in GOOGLE_CREDENTIALS environment variable")
                raise ValueError("Invalid JSON in GOOGLE_CREDENTIALS environment variable")
        else:
            # 개별 환경 변수에서 인증 정보 사용
            try:
                logging.info("Loading Google credentials from individual environment variables")
                credentials_info = load_google_credentials_from_env()
            except ValueError:
                # 환경 변수가 없으면 로컬 파일 사용
                logging.info("Environment variables not found, falling back to local file")
                with open('thetopone-552b3537bc76.json', 'r') as f:
                    credentials_info = json.load(f)
        
        # 인증 정보로 credentials 생성
        credentials = service_account.Credentials.from_service_account_info(
            credentials_info,
            scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
        )
        
        # 서비스 생성
        service = build('sheets', 'v4', credentials=credentials)
        return service
        
    except Exception as e:
        logging.error(f"서비스 생성 실패: {str(e)}")
        raise

if __name__ == "__main__":
    print("Google Sheets API 인증 문제 진단 중...")
    
    # 서비스 계정 정보 확인
    check_service_account_status()
    
    # 공개 접근 시도
    spreadsheet_id = "1C0-kWVHt_SvWIPfmCzKVOKr0pMFArixYNNhNw-vdCoE"
    try_public_sheets_access(spreadsheet_id)
    
    # 해결 방법 제안
    suggest_solutions() 