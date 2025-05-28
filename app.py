from flask import Flask, render_template, jsonify
import os
import logging
from sheets_service import get_property_data, test_sheets_connection
from config import NAVER_CLIENT_ID, NAVER_CLIENT_SECRET

# Configure logging
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default-secret-key")

@app.route('/')
def index():
    try:
        return render_template('index.html', 
                           naver_client_id=NAVER_CLIENT_ID,
                           naver_client_secret=NAVER_CLIENT_SECRET)
    except Exception as e:
        logging.error(f"Error rendering index page: {str(e)}")
        return f"Error: {str(e)}", 500

@app.route('/api/properties/<sheet_type>')
def get_properties(sheet_type):
    try:
        properties = get_property_data(sheet_type)
        return jsonify(properties)
    except Exception as e:
        logging.error(f"Error fetching properties: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/health')
def health_check():
    try:
        return jsonify({
            "status": "healthy",
            "port": os.environ.get('PORT', 'unknown'),
            "version": "1.0"
        }), 200
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    
    # Google Sheets API 연결 테스트 (선택적)
    try:
        logging.info("Testing Google Sheets connection...")
        if test_sheets_connection():
            logging.info("✅ Google Sheets API connected successfully!")
        else:
            logging.warning("⚠️ Google Sheets API connection failed, but continuing...")
    except Exception as e:
        logging.error(f"Google Sheets test error: {str(e)}")
        logging.warning("Continuing without Google Sheets test...")
    
    print(f"🚀 Starting real estate app on 0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=False) 
