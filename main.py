from flask import Flask, render_template, jsonify, request
import os
import logging
import threading
import time
import requests
from sheets_service import get_property_data, test_sheets_connection
from config import NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
from ncp_maps_utils import geocode_address, test_ncp_maps_connection
import socket
from flask import make_response
import gzip
from functools import wraps

# Configure logging
logging.basicConfig(
    level=logging.INFO,  # DEBUG에서 INFO로 변경하여 중요한 로그만 보기
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default-secret-key")

# 성능 개선을 위한 응답 압축 데코레이터
def gzip_response(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        response = make_response(f(*args, **kwargs))
        
        # Accept-Encoding 헤더 확인
        accept_encoding = request.headers.get('Accept-Encoding', '')
        if 'gzip' not in accept_encoding.lower():
            return response
            
        # JSON 응답만 압축 (정적 파일은 웹서버에서 처리)
        if response.content_type.startswith('application/json'):
            response.data = gzip.compress(response.data)
            response.headers['Content-Encoding'] = 'gzip'
            response.headers['Content-Length'] = len(response.data)
            
        return response
    return decorated_function

# 정적 파일 캐시 헤더 추가
@app.after_request
def add_cache_headers(response):
    # 정적 파일에 대한 캐시 헤더 설정
    if request.endpoint == 'static':
        # CSS, JS 파일은 1시간 캐시
        if request.path.endswith(('.css', '.js')):
            response.cache_control.max_age = 3600  # 1시간
            response.cache_control.public = True
        # 이미지 파일은 1일 캐시
        elif request.path.endswith(('.png', '.jpg', '.jpeg', '.gif', '.ico')):
            response.cache_control.max_age = 86400  # 1일
            response.cache_control.public = True
    
    # API 응답에 대한 캐시 헤더
    elif request.path.startswith('/api/properties/'):
        response.cache_control.max_age = 1800  # 30분 (Google Sheets 캐시와 동일)
        response.cache_control.public = True
        
    return response

def auto_restart(port):
    """자동 재시작 함수: 10분마다 서버 상태를 확인하고 필요시 재시작"""
    consecutive_failures = 0
    while True:
        try:
            # 서버 상태 확인
            logging.info("Checking server status...")

            # Health check 수행
            try:
                response = requests.get(f'http://127.0.0.1:{port}/health', timeout=5)
                if response.status_code == 200:
                    logging.info("Server is healthy")
                    consecutive_failures = 0  # 성공하면 실패 카운트 리셋
                else:
                    logging.error(f"Health check failed with status code: {response.status_code}")
                    consecutive_failures += 1
            except requests.RequestException as e:
                logging.error(f"Health check failed with error: {str(e)}")
                consecutive_failures += 1

            # 연속 3번 실패하면 재시작
            if consecutive_failures >= 3:
                logging.critical("Three consecutive health checks failed. Forcing restart...")
                os._exit(1)  # 서버 강제 재시작

            # 10분 대기
            time.sleep(600)
        except Exception as e:
            logging.error(f"Error in auto_restart: {str(e)}")
            continue

@app.route('/')
def index():
    try:
        return render_template('index.html', 
                           naver_client_id=NAVER_CLIENT_ID,
                           naver_client_secret=NAVER_CLIENT_SECRET)
    except Exception as e:
        logging.error(f"Error rendering index page: {str(e)}")
        return str(e), 500

@app.route('/alternative')
def alternative_map():
    """네이버 지도 API 인증 문제 시 사용할 수 있는 대체 지도 페이지"""
    try:
        return render_template('map_alternative.html')
    except Exception as e:
        logging.error(f"Error rendering alternative map page: {str(e)}")
        return str(e), 500

@app.route('/api/properties/<sheet_type>')
@gzip_response
def get_properties(sheet_type):
    try:
        properties = get_property_data(sheet_type)
        
        # 성능 개선: 프로덕션에서는 간단한 로깅만
        logging.info(f"API 응답 - {sheet_type}: {len(properties)}개 매물")
        
        return jsonify(properties)
    except Exception as e:
        logging.error(f"Error fetching properties: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/geocode')
def geocode():
    """지오코딩 API 엔드포인트 - 주소를 위도/경도로 변환"""
    try:
        address = request.args.get('address')
        if not address:
            return jsonify({'error': '주소가 필요합니다.'}), 400
        
        result = geocode_address(address)
        if result:
            return jsonify({
                'status': 'OK',
                'result': result
            })
        else:
            return jsonify({
                'status': 'ZERO_RESULTS',
                'message': '주소를 찾을 수 없습니다.'
            }), 404
            
    except Exception as e:
        logging.error(f"Geocoding API error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Health check endpoint
@app.route('/health')
def health_check():
    """상세한 서버 상태 확인을 위한 health check 엔드포인트"""
    try:
        return jsonify({
            "status": "healthy",
            "timestamp": time.strftime('%Y-%m-%d %H:%M:%S'),
            "uptime": "running",
            "version": "1.0"
        }), 200
    except Exception as e:
        logging.error(f"Health check failed: {str(e)}")
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 500

@app.route('/api/cache/clear', methods=['POST'])
def clear_cache():
    """캐시를 수동으로 클리어하는 API"""
    try:
        from sheets_service import get_property_data
        # 캐시 클리어
        get_property_data.clear_cache()
        logging.info("캐시가 성공적으로 클리어되었습니다.")
        return jsonify({
            "status": "success",
            "message": "캐시가 클리어되었습니다.",
            "timestamp": time.strftime('%Y-%m-%d %H:%M:%S')
        }), 200
    except Exception as e:
        logging.error(f"캐시 클리어 실패: {str(e)}")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500

if __name__ == '__main__':
    logging.info("Starting Flask application...")

    # Google Sheets API 연결 테스트
    logging.info("=== Google Sheets API 연결 테스트 ===")
    try:
        if test_sheets_connection():
            logging.info("Google Sheets API 연결이 정상적으로 작동합니다.")
        else:
            logging.warning("Google Sheets API 연결에 문제가 있지만 앱을 계속 실행합니다.")
    except Exception as e:
        logging.error(f"Google Sheets API 테스트 중 오류 발생: {str(e)}")
        logging.warning("API 테스트를 건너뛰고 앱을 시작합니다.")

    # 네이버 클라우드 플랫폼 Maps API 연결 테스트
    logging.info("=== 네이버 클라우드 플랫폼 Maps API 연결 테스트 ===")
    try:
        if test_ncp_maps_connection():
            logging.info("네이버 클라우드 플랫폼 Maps API 연결이 정상적으로 작동합니다.")
        else:
            logging.warning("네이버 클라우드 플랫폼 Maps API 연결에 문제가 있지만 앱을 계속 실행합니다.")
    except Exception as e:
        logging.error(f"NCP Maps API 테스트 중 오류 발생: {str(e)}")
        logging.warning("API 테스트를 건너뛰고 앱을 시작합니다.")

    # 포트 설정
    port = int(os.environ.get('PORT', 5050))
    logging.info(f"Starting server on port: {port}")

    # Render 환경에서는 gunicorn을 사용하지 않고 직접 Flask 실행
    app.run(host='0.0.0.0', port=port, debug=False)