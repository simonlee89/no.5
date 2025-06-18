import json
import os
from google.oauth2 import service_account
from google.auth.transport.requests import Request
import logging
from google_auth_utils import load_google_credentials_from_env, load_dotenv_if_exists

logging.basicConfig(level=logging.DEBUG)

def debug_credentials():
    print("=== Google 인증 정보 디버깅 ===")
    
    # .env 파일 로드 시도
    load_dotenv_if_exists()
    
    # 환경 변수 확인
    google_credentials_env = os.getenv('GOOGLE_CREDENTIALS')
    if google_credentials_env:
        print("✅ GOOGLE_CREDENTIALS 환경 변수 발견")
        try:
            credentials = json.loads(google_credentials_env)
            print(f"✅ JSON 파싱 성공, project_id: {credentials.get('project_id', 'N/A')}")
        except json.JSONDecodeError as e:
            print(f"❌ JSON 파싱 실패: {e}")
    else:
        print("ℹ️ GOOGLE_CREDENTIALS 환경 변수 없음")
    
    # 개별 환경 변수 확인
    try:
        credentials = load_google_credentials_from_env()
        print("✅ 개별 환경 변수에서 인증 정보 로드 성공")
        print(f"   Project ID: {credentials.get('project_id', 'N/A')}")
        print(f"   Client Email: {credentials.get('client_email', 'N/A')}")
    except ValueError as e:
        print(f"ℹ️ 개별 환경 변수 로드 실패: {e}")
    
    # 로컬 파일 확인
    json_file_path = 'thetopone-552b3537bc76.json'
    if os.path.exists(json_file_path):
        print(f"✅ 로컬 JSON 파일 발견: {json_file_path}")
        try:
            with open(json_file_path, 'r') as f:
                local_credentials = json.load(f)
            print(f"   Project ID: {local_credentials.get('project_id', 'N/A')}")
            print(f"   Client Email: {local_credentials.get('client_email', 'N/A')}")
        except Exception as e:
            print(f"❌ 로컬 파일 읽기 실패: {e}")
    else:
        print(f"ℹ️ 로컬 JSON 파일 없음: {json_file_path}")

if __name__ == "__main__":
    debug_credentials()
