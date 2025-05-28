from flask import Flask
import os

app = Flask(__name__)

@app.route('/')
def hello():
    return "Hello from Render! 🚀"

@app.route('/health')
def health():
    port = os.environ.get('PORT', 'unknown')
    return f"OK - Running on port {port}"

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting app on 0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=False) 