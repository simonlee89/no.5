from flask import Flask, render_template, jsonify
import os
import logging
import threading
import time
import requests
from sheets_service import get_property_data, test_sheets_connection
from config import NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
import socket

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
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

@app.route('/api/properties/<sheet_type>')
def get_properties(sheet_type):
    try:
        properties = get_property_data(sheet_type)
        return jsonify(properties)
    except Exception as e:
        logging.error(f"Error fetching properties: {str(e)}")
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
    if test_sheets_connection():
        logging.info("Google Sheets API 연결이 정상적으로 작동합니다.")
    else:
        logging.error("Google Sheets API 연결에 문제가 있습니다. 위의 오류 메시지를 확인하세요.")

    # Basic port check
    port = int(os.environ.get('PORT', 5050))
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('127.0.0.1', port))
    if result == 0:
        logging.error(f"Port {port} is already in use. Exiting.")
        exit(1)
    sock.close()

    # Use gunicorn configuration when running with gunicorn
    if os.environ.get('GUNICORN_CMD_ARGS') is not None:
        # Let gunicorn handle the running
        pass
    else:
        # For development server
        # Start auto-restart thread only in production
        if not app.debug:
            restart_thread = threading.Thread(target=auto_restart, args=(port,), daemon=True)
            restart_thread.start()
            logging.info("Auto-restart thread started")

        app.run(host='0.0.0.0', port=port, debug=True, use_reloader=False)
