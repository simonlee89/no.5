import json
import logging
import re
import os
import base64
import time
from functools import lru_cache, wraps
from google.oauth2 import service_account
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from config import SPREADSHEET_ID, SHEET_RANGES
from google_auth_utils import load_google_credentials_from_env, load_dotenv_if_exists

# 성능 개선: 프로덕션에서는 WARNING 레벨로 설정
logging.basicConfig(level=logging.WARNING if os.environ.get("RENDER") else logging.INFO)

# 캐시 설정
CACHE_TTL = 7200  # 2시간으로 증가 (성능 개선)
_cache_timestamps = {}

# 메모리 효율적인 캐시 관리
_sheet_cache = {}
_cache_lock = False

def timed_cache(ttl_seconds):
    """시간 기반 캐시 데코레이터 - 메모리 효율성 개선"""
    def decorator(func):
        cache = {}
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            global _cache_lock
            
            # 캐시 키 생성
            key = str(args) + str(sorted(kwargs.items()))
            current_time = time.time()
            
            # 캐시된 데이터가 있고 TTL 내에 있으면 반환
            if key in cache:
                data, timestamp = cache[key]
                if current_time - timestamp < ttl_seconds:
                    # 성능 개선: 프로덕션에서는 캐시 히트 로깅 제거
                    if not os.environ.get("RENDER"):
                        logging.info(f"캐시에서 데이터 반환: {func.__name__} (남은 시간: {ttl_seconds - (current_time - timestamp):.1f}초)")
                    return data
                else:
                    # TTL 만료된 캐시 삭제
                    del cache[key]
            
            # 캐시 락 체크 (동시 요청 방지)
            if _cache_lock:
                time.sleep(0.5)  # 대기 시간 단축
                # 대기 후 다시 캐시 확인
                if key in cache:
                    data, timestamp = cache[key]
                    if current_time - timestamp < ttl_seconds:
                        return data
            
            # 새로 데이터 가져와서 캐시에 저장
            _cache_lock = True
            try:
                result = func(*args, **kwargs)
                cache[key] = (result, current_time)
                
                # 메모리 관리: 캐시 크기 제한 (최대 5개 시트 데이터)
                if len(cache) > 5:
                    oldest_key = min(cache.keys(), key=lambda k: cache[k][1])
                    del cache[oldest_key]
                
                return result
            finally:
                _cache_lock = False
        
        # 캐시 클리어 함수 추가
        wrapper.clear_cache = lambda: cache.clear()
        return wrapper
    return decorator

def determine_status(r_value, s_value, t_value, sheet_type):
    """
    R열(공클), S열(온하), T열(갠매) 값을 바탕으로 매물 상태를 판단하는 함수.
    """
    # 각 열 값 정리
    r_value = str(r_value).strip().lower() if r_value is not None else ''  # 공클
    s_value = str(s_value).strip().lower() if s_value is not None else ''  # 온하
    t_value = str(t_value).strip().lower() if t_value is not None else ''  # 갠매

    # 성능 개선: 프로덕션에서는 상태 결정 로깅 제거
    if not os.environ.get("RENDER"):
        logging.info(f"[{sheet_type}] 상태 결정 입력값 (R,S,T): '{r_value}', '{s_value}', '{t_value}'")

    # 긍정 표시값 정의
    positive_marks = {'o', 'yes', '1', 'true', 'y', '예', '네'}

    # 각 열에 대해 텍스트 자체가 있거나 긍정 마크가 있는지 확인
    def is_positive(val, keyword):
        return (val == keyword) or (keyword in val) or (val in positive_marks)

    # R열 온하 우선
    if is_positive(r_value, '온하'):
        return '온하'
    # S열 공클
    if is_positive(s_value, '공클'):
        return '공클'
    # T열 갠매
    if is_positive(t_value, '갠매'):
        return '갠매'

    # 상태 없음
    return None

# 성능 개선: 서비스 객체 캐싱
_sheets_service = None

def get_sheets_service():
    """Google Sheets API 서비스 객체를 생성합니다."""
    global _sheets_service
    
    # 이미 생성된 서비스가 있으면 재사용
    if _sheets_service is not None:
        return _sheets_service
    
    try:
        # GOOGLE_CREDENTIALS 환경 변수가 있는지 확인 (JSON 문자열)
        google_credentials = os.getenv('GOOGLE_CREDENTIALS')
        if google_credentials:
            try:
                credentials_info = json.loads(google_credentials)
            except json.JSONDecodeError:
                raise ValueError("Invalid JSON in GOOGLE_CREDENTIALS environment variable")
        else:
            # Render Secret Files에서 JSON 파일 읽기 시도
            secret_file_path = '/etc/secrets/service-account-key.json'
            if os.path.exists(secret_file_path):
                try:
                    with open(secret_file_path, 'r', encoding='utf-8') as f:
                        credentials_info = json.load(f)
                except Exception as e:
                    raise
            else:
                # 개별 환경 변수에서 인증 정보 사용
                try:
                    credentials_info = load_google_credentials_from_env()
                except ValueError as e:
                    # 환경 변수가 없으면 로컬 파일 사용 (개발 환경)
                    current_dir = os.path.dirname(os.path.abspath(__file__))
                    json_file_path = os.path.join(current_dir, 'thetopone-552b3537bc76.json')
                    
                    if not os.path.exists(json_file_path):
                        raise FileNotFoundError(f"Credentials not found: {str(e)}")
                    
                    try:
                        with open(json_file_path, 'r', encoding='utf-8') as f:
                            credentials_info = json.load(f)
                        
                        # 필수 필드 확인
                        required_fields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id']
                        missing_fields = [field for field in required_fields if field not in credentials_info]
                        
                        if missing_fields:
                            raise ValueError(f"Invalid credentials file: missing fields {missing_fields}")
                        
                        # private_key 형식 확인 및 정리
                        private_key = credentials_info['private_key']
                        if not private_key.startswith('-----BEGIN PRIVATE KEY-----'):
                            raise ValueError("Invalid private key format")
                        
                        credentials_info['private_key'] = private_key.strip()
                        
                    except json.JSONDecodeError as e:
                        raise ValueError(f"Invalid JSON in credentials file: {str(e)}")
        
        # 인증 정보로 credentials 생성
        credentials = service_account.Credentials.from_service_account_info(
            credentials_info,
            scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
        )
        
        # 즉시 토큰 새로고침 시도
        request = Request()
        try:
            credentials.refresh(request)
        except Exception as refresh_error:
            pass  # 초기 새로고침 실패는 무시
        
        # 서비스 빌드 시 추가 옵션 설정
        _sheets_service = build('sheets', 'v4', credentials=credentials, cache_discovery=False)
        
        return _sheets_service
    except Exception as e:
        logging.error(f"Failed to create sheets service: {str(e)}")
        raise

@timed_cache(CACHE_TTL)
def get_property_data(sheet_type='강남월세'):
    try:
        service = get_sheets_service()
        sheet = service.spreadsheets()

        range_name = SHEET_RANGES.get(sheet_type)
        if not range_name:
            logging.error(f"Invalid sheet type: {sheet_type}")
            return []

        # 성능 개선: 배치 요청으로 데이터 가져오기
        try:
            result = sheet.values().get(
                spreadsheetId=SPREADSHEET_ID,
                range=range_name,
                valueRenderOption='UNFORMATTED_VALUE'  # 성능 개선: 원시 값만 가져오기
            ).execute()
            
            if result is None:
                return []
                
        except Exception as api_error:
            logging.error(f"Google Sheets API call failed: {str(api_error)}")
            return []

        values = result.get('values', [])
        
        if not values:
            return []

        properties = []
        status_counts = {'갠매': 0, '온하': 0, '공클': 0}
        excluded_count = 0

        # 성능 개선: 리스트 컴프리헨션과 필터링 최적화
        for row in values:
            try:
                # 최소 필요 열 확인 (A열과 Q열)
                if len(row) < 17:
                    continue
                    
                property_id = str(row[0]).strip() if row[0] else ''
                location = str(row[16]).strip() if len(row) > 16 and row[16] else ''
                
                if not property_id or not location:
                    continue

                # 상태 값 추출
                r_value = str(row[17]).strip() if len(row) > 17 and row[17] else ''
                s_value = str(row[18]).strip() if len(row) > 18 and row[18] else ''
                t_value = str(row[19]).strip() if len(row) > 19 and row[19] else ''

                status = determine_status(r_value, s_value, t_value, sheet_type)
                
                if status is None:
                    excluded_count += 1
                    continue
                
                status_counts[status] += 1

                # 성능 개선: 딕셔너리 생성 최적화
                properties.append({
                    'id': property_id,
                    'reg_date': str(row[1]).strip() if len(row) > 1 and row[1] else '',
                    'hyperlink': f"https://new.land.naver.com/houses?articleNo={property_id}",
                    'location': location,
                    'sheet_type': sheet_type,
                    'status': status,
                    'deposit': str(row[10]).strip() if len(row) > 10 and row[10] else '',
                    'monthly_rent': str(row[11]).strip() if len(row) > 11 and row[11] else ''
                })

            except Exception as e:
                continue  # 개별 행 오류는 무시

        # 성능 개선: 프로덕션에서는 요약 로깅만
        if not os.environ.get("RENDER"):
            logging.info(f"[{sheet_type}] 총 {len(properties)}개 매물 (갠매: {status_counts['갠매']}, 온하: {status_counts['온하']}, 공클: {status_counts['공클']})")
        
        return properties

    except Exception as e:
        logging.error(f"Failed to fetch property data: {str(e)}")
        return []

def test_sheets_connection():
    """Google Sheets API 연결을 테스트하는 함수"""
    try:
        service = get_sheets_service()
        
        spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
        
        if spreadsheet:
            logging.info("✅ Google Sheets API 연결 성공!")
            return True
        else:
            return False
            
    except Exception as e:
        logging.error(f"❌ Google Sheets API 연결 테스트 실패: {str(e)}")
        return False