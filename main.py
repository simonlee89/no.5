import json
import logging
import re
import os
import base64
import time
from google.oauth2 import service_account
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from config import SPREADSHEET_ID, SHEET_RANGES
from google_auth_utils import load_google_credentials_from_env, load_dotenv_if_exists

logging.basicConfig(level=logging.INFO)

def determine_status(t_value, sheet_type):
    """
    T열 값을 바탕으로 갠매 여부만 판단하는 함수
    """
    if not t_value:
        return '일반'

    # 앞뒤 공백 및 non-breaking space 제거
    normalized = t_value.strip().replace('\u00A0', '').strip()

    # 시트별 상태 판정 로직
    if sheet_type == '강남월세':
        if re.search(r'갠\s*매', normalized):
            logging.info(f"갠매 발견: '{normalized}'")
            return '갠매'
    elif sheet_type == '강남전세':
        if re.search(r'직\s*거\s*래|개\s*인|갠\s*매', normalized):
            logging.info(f"갠매/직거래/개인 발견: '{normalized}'")
            return '갠매'
    elif sheet_type == '송파월세':
        if re.search(r'갠\s*매', normalized):
            logging.info(f"갠매 발견: '{normalized}'")
            return '갠매'
    elif sheet_type == '송파전세':
        if re.search(r'갠\s*매', normalized):
            logging.info(f"갠매 발견: '{normalized}'")
            return '갠매'

    return '일반'

def get_sheets_service():
    """Google Sheets API 서비스 객체를 생성합니다."""
    try:
        logging.info("Creating Google Sheets service...")
        
        # GOOGLE_CREDENTIALS 환경 변수가 있는지 확인 (JSON 문자열)
        google_credentials = os.getenv('GOOGLE_CREDENTIALS')
        if google_credentials:
            try:
                credentials_info = json.loads(google_credentials)
                logging.info("Using Google credentials from GOOGLE_CREDENTIALS environment variable")
            except json.JSONDecodeError:
                logging.error("Invalid JSON in GOOGLE_CREDENTIALS environment variable")
                raise ValueError("Invalid JSON in GOOGLE_CREDENTIALS environment variable")
        else:
            # Render Secret Files에서 JSON 파일 읽기 시도
            secret_file_path = '/etc/secrets/service-account-key.json'
            if os.path.exists(secret_file_path):
                logging.info("Loading Google credentials from Render Secret Files")
                try:
                    with open(secret_file_path, 'r', encoding='utf-8') as f:
                        credentials_info = json.load(f)
                    logging.info("Successfully loaded credentials from Secret Files")
                except Exception as e:
                    logging.error(f"Error reading Secret Files: {str(e)}")
                    raise
            else:
                # 개별 환경 변수에서 인증 정보 사용
                try:
                    logging.info("Loading Google credentials from individual environment variables")
                    credentials_info = load_google_credentials_from_env()
                except ValueError as e:
                    # 환경 변수가 없으면 로컬 파일 사용 (개발 환경)
                    logging.info("Environment variables not found, falling back to local file")
                    current_dir = os.path.dirname(os.path.abspath(__file__))
                    json_file_path = os.path.join(current_dir, 'thetopone-552b3537bc76.json')
                    
                    logging.info(f"Looking for credentials file at: {json_file_path}")
                    
                    # 파일 존재 여부 확인
                    if not os.path.exists(json_file_path):
                        logging.error(f"Credentials file not found at: {json_file_path}")
                        logging.error("환경 변수도 설정되지 않았고 로컬 파일도 없습니다.")
                        logging.error("다음 중 하나를 설정하세요:")
                        logging.error("1. .env 파일에 Google 서비스 계정 정보 설정")
                        logging.error("2. 환경 변수로 직접 설정")
                        logging.error("3. 로컬 개발용 JSON 파일 배치")
                        logging.error("4. Render Secret Files에 service-account-key.json 업로드")
                        raise FileNotFoundError(f"Credentials not found: {str(e)}")
                    
                    logging.info("Credentials file found, attempting to load...")
                    
                    # 파일 내용을 직접 읽어서 검증
                    try:
                        with open(json_file_path, 'r', encoding='utf-8') as f:
                            credentials_info = json.load(f)
                        
                        # 필수 필드 확인
                        required_fields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id']
                        missing_fields = [field for field in required_fields if field not in credentials_info]
                        
                        if missing_fields:
                            logging.error(f"Missing required fields in credentials file: {missing_fields}")
                            raise ValueError(f"Invalid credentials file: missing fields {missing_fields}")
                        
                        # private_key 형식 확인 및 정리
                        private_key = credentials_info['private_key']
                        if not private_key.startswith('-----BEGIN PRIVATE KEY-----'):
                            logging.error("Invalid private key format in credentials file")
                            raise ValueError("Invalid private key format")
                        
                        # private_key에서 불필요한 공백이나 문자 제거
                        private_key = private_key.strip()
                        credentials_info['private_key'] = private_key
                        
                        logging.info("Credentials file validation passed")
                        
                    except json.JSONDecodeError as e:
                        logging.error(f"Invalid JSON in credentials file: {str(e)}")
                        raise ValueError(f"Invalid JSON in credentials file: {str(e)}")
                    except Exception as e:
                        logging.error(f"Error reading credentials file: {str(e)}")
                        raise
        
        # 인증 정보로 credentials 생성
        credentials = service_account.Credentials.from_service_account_info(
            credentials_info,
            scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
        )
        
        # 즉시 토큰 새로고침 시도
        logging.info("Attempting to refresh credentials...")
        request = Request()
        try:
            credentials.refresh(request)
            logging.info("Credentials refreshed successfully")
        except Exception as refresh_error:
            logging.warning(f"Initial refresh failed, will retry during API call: {str(refresh_error)}")
        
        logging.info("Credentials loaded successfully, building service...")
        
        # 서비스 빌드 시 추가 옵션 설정
        service = build('sheets', 'v4', credentials=credentials, cache_discovery=False)
        logging.info("Google Sheets service created successfully")
        
        return service
    except Exception as e:
        logging.error(f"Failed to create sheets service: {str(e)}")
        logging.error(f"Error type: {type(e).__name__}")
        import traceback
        logging.error(f"Full traceback: {traceback.format_exc()}")
        raise

def get_property_data(sheet_type='강남월세'):
    try:
        logging.info(f"Starting to fetch property data for sheet type: {sheet_type}")
        service = get_sheets_service()
        sheet = service.spreadsheets()

        range_name = SHEET_RANGES.get(sheet_type)
        if not range_name:
            logging.error(f"Invalid sheet type: {sheet_type}")
            return []

        logging.info(f"Using spreadsheet ID: {SPREADSHEET_ID}")
        logging.info(f"Attempting to fetch data with range: {range_name}")
        
        try:
            result = sheet.values().get(
                spreadsheetId=SPREADSHEET_ID,
                range=range_name
            ).execute()
            
            logging.info(f"API call successful, result type: {type(result)}")
            
            if result is None:
                logging.error("API returned None result")
                return []
                
            logging.info(f"Result keys: {list(result.keys()) if result else 'None'}")
            
        except Exception as api_error:
            logging.error(f"Google Sheets API call failed: {str(api_error)}")
            logging.error(f"API error type: {type(api_error).__name__}")
            
            # 구체적인 오류 메시지 제공
            if "403" in str(api_error):
                logging.error("🔒 권한 오류: 서비스 계정이 스프레드시트에 접근할 권한이 없습니다.")
                logging.error("해결 방법: 스프레드시트를 sheets-reader@thetopone.iam.gserviceaccount.com과 공유하세요.")
            elif "404" in str(api_error):
                logging.error("📄 스프레드시트나 시트를 찾을 수 없습니다.")
            elif "400" in str(api_error):
                logging.error("⚠️ 잘못된 요청입니다. 범위나 시트 이름을 확인하세요.")
            
            import traceback
            logging.error(f"API call traceback: {traceback.format_exc()}")
            return []

        values = result.get('values', [])
        logging.info(f"Retrieved {len(values)} rows from the sheet")
        
        if not values:
            logging.warning("No data found in the sheet")
            return []

        properties = []
        status_counts = {'갠매': 0, '일반': 0}

        logging.info(f"{sheet_type} 데이터 처리 시작")

        for row in values:
            try:
                if len(row) < 20:  # T열(19)까지 필요
                    continue

                property_id = row[0].strip()
                reg_date = row[1].strip() if len(row) > 1 else ''
                location = row[16].strip()
                t_value = str(row[19]).strip() if len(row) > 19 else ''

                if not property_id or not location:
                    continue

                status = determine_status(t_value, sheet_type)
                status_counts[status] += 1

                property_data = {
                    'id': property_id,
                    'reg_date': reg_date,
                    'hyperlink': f"https://new.land.naver.com/houses?articleNo={property_id}",
                    'location': location,
                    'status': status,
                    'deposit': row[10].strip() if len(row) > 10 else '',
                    'monthly_rent': row[11].strip() if len(row) > 11 else ''
                }

                properties.append(property_data)

            except Exception as e:
                logging.error(f"Error processing row: {str(e)}")
                continue

        logging.info("\n=== 처리 결과 요약 ===")
        logging.info(f"총 매물 수: {len(properties)}개")
        logging.info(f"갠매: {status_counts['갠매']}개")
        logging.info(f"일반: {status_counts['일반']}개")

        return properties

    except Exception as e:
        logging.error(f"Failed to fetch property data: {str(e)}")
        logging.error(f"Error type: {type(e).__name__}")
        import traceback
        logging.error(f"Full traceback: {traceback.format_exc()}")
        return []

def test_sheets_connection():
    """Google Sheets API 연결을 테스트하는 함수"""
    try:
        service = get_sheets_service()
        
        # 스프레드시트 메타데이터 가져오기 시도
        logging.info(f"Testing connection to spreadsheet: {SPREADSHEET_ID}")
        
        spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
        
        if spreadsheet:
            logging.info("✅ Google Sheets API 연결 성공!")
            logging.info(f"스프레드시트 제목: {spreadsheet.get('properties', {}).get('title', 'Unknown')}")
            
            # 시트 목록 출력
            sheets = spreadsheet.get('sheets', [])
            logging.info(f"사용 가능한 시트 수: {len(sheets)}")
            for sheet in sheets:
                sheet_title = sheet.get('properties', {}).get('title', 'Unknown')
                logging.info(f"  - {sheet_title}")
            
            return True
        else:
            logging.error("❌ 스프레드시트 메타데이터를 가져올 수 없습니다.")
            return False
            
    except Exception as e:
        logging.error(f"❌ Google Sheets API 연결 테스트 실패: {str(e)}")
        
        # 구체적인 오류 메시지 제공
        if "403" in str(e):
            logging.error("🔒 권한 오류: 서비스 계정이 스프레드시트에 접근할 권한이 없습니다.")
            logging.error(f"해결 방법: 스프레드시트를 다음 이메일과 공유하세요: sheets-reader@thetopone.iam.gserviceaccount.com")
        elif "404" in str(e):
            logging.error("📄 스프레드시트를 찾을 수 없습니다. SPREADSHEET_ID를 확인하세요.")
        elif "400" in str(e):
            logging.error("⚠️ 잘못된 요청입니다. 스프레드시트 ID나 범위를 확인하세요.")
        
        return False
