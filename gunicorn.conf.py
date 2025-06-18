import multiprocessing
import os

# Worker Options
workers = 2  # 리소스 사용량 최적화를 위해 worker 수 감소
worker_class = 'sync'
worker_connections = 1000
timeout = 30
keepalive = 2

# Logging
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Process Naming
proc_name = 'flask_app'

# Server Mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# Server Socket - Render에서 PORT 환경변수 사용
port = os.environ.get('PORT', '5000')
bind = f"0.0.0.0:{port}"
backlog = 2048

# Restart workers after this many requests, with some random variation
max_requests = 1000
max_requests_jitter = 50

# Automatically restart workers if they die
reload = False  # Production 환경에서는 자동 reload 비활성화
reload_engine = 'auto'

# Preload application code before worker processes are forked
preload_app = True

# SSL options
keyfile = None
certfile = None

def when_ready(server):
    server.log.info("Server is ready. Spawning workers")

def on_starting(server):
    server.log.info("Starting Gunicorn Server")

def on_reload(server):
    server.log.info("Reloading Server")

def post_fork(server, worker):
    server.log.info(f"Worker spawned (pid: {worker.pid})")