import os
import json
from typing import Dict, Any

def load_google_credentials_from_env() -> Dict[str, Any]:
    """
    환경 변수에서 Google 서비스 계정 정보를 로드합니다.
    """
    credentials = {
        "type": os.getenv("GOOGLE_SERVICE_ACCOUNT_TYPE", "service_account"),
        "project_id": os.getenv("GOOGLE_PROJECT_ID"),
        "private_key_id": os.getenv("GOOGLE_PRIVATE_KEY_ID"),
        "private_key": os.getenv("GOOGLE_PRIVATE_KEY"),
        "client_email": os.getenv("GOOGLE_CLIENT_EMAIL"),
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "auth_uri": os.getenv("GOOGLE_AUTH_URI", "https://accounts.google.com/o/oauth2/auth"),
        "token_uri": os.getenv("GOOGLE_TOKEN_URI", "https://oauth2.googleapis.com/token"),
        "auth_provider_x509_cert_url": os.getenv("GOOGLE_AUTH_PROVIDER_X509_CERT_URL", "https://www.googleapis.com/oauth2/v1/certs"),
        "client_x509_cert_url": os.getenv("GOOGLE_CLIENT_X509_CERT_URL"),
        "universe_domain": os.getenv("GOOGLE_UNIVERSE_DOMAIN", "googleapis.com")
    }
    
    # 필수 필드 검증
    required_fields = ["project_id", "private_key", "client_email"]
    missing_fields = [field for field in required_fields if not credentials[field]]
    
    if missing_fields:
        raise ValueError(f"다음 환경 변수가 설정되지 않았습니다: {', '.join(missing_fields)}")
    
    return credentials

def get_google_credentials_json() -> str:
    """
    환경 변수에서 Google 서비스 계정 정보를 JSON 문자열로 반환합니다.
    """
    credentials = load_google_credentials_from_env()
    return json.dumps(credentials)

def load_dotenv_if_exists():
    """
    .env 파일이 존재하면 로드합니다.
    """
    try:
        from dotenv import load_dotenv
        if os.path.exists('.env'):
            load_dotenv()
            print("✅ .env 파일을 로드했습니다.")
        else:
            print("ℹ️ .env 파일이 없습니다. 환경 변수를 직접 설정해주세요.")
    except ImportError:
        print("⚠️ python-dotenv가 설치되지 않았습니다. pip install python-dotenv로 설치하세요.") 