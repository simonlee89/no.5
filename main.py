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
def get_properties(sheet_type):
    try:
        properties = get_property_data(sheet_type)
        
        # 디버깅을 위한 상태별 개수 로깅
        status_count = {}
        for prop in properties:
            status = prop.get('status', 'unknown')
            status_count[status] = status_count.get(status, 0) + 1
        
        logging.info(f"API 응답 - {sheet_type}: 총 {len(properties)}개 매물")
        logging.info(f"상태별 개수: {status_count}")
        
        # 첫 번째 매물 샘플 로깅
        if properties:
            sample = properties[0]
            logging.info(f"샘플 매물: ID={sample.get('id')}, 위치={sample.get('location')}, 시트타입={sample.get('sheet_type')}, 상태={sample.get('status')}")
        
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