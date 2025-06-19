# Render Starter 모델 최적화 설정
# 512MB RAM, 0.5 CPU 환경에 최적화

import os
import gc
import threading
import time

# 메모리 최적화 설정
MAX_CACHE_SIZE = 50 * 1024 * 1024  # 50MB (전체 메모리의 약 10%)
CACHE_CLEANUP_INTERVAL = 1800  # 30분마다 캐시 정리
GC_COLLECT_INTERVAL = 600  # 10분마다 가비지 컬렉션

# API 호출 최적화 설정
API_TIMEOUT = 10  # API 타임아웃 (초)
MAX_CONCURRENT_REQUESTS = 5  # 동시 요청 수 제한
RETRY_ATTEMPTS = 2  # 재시도 횟수

# 배치 처리 최적화
GEOCODING_BATCH_SIZE = 10
SHEETS_BATCH_SIZE = 100

class PerformanceManager:
    """성능 관리자 - 메모리 및 CPU 사용량 최적화"""
    
    def __init__(self):
        self.cache_size = 0
        self.last_cleanup = time.time()
        self.start_memory_monitor()
    
    def start_memory_monitor(self):
        """메모리 모니터링 백그라운드 스레드 시작"""
        def memory_monitor():
            while True:
                try:
                    # 메모리 정리
                    if time.time() - self.last_cleanup > CACHE_CLEANUP_INTERVAL:
                        self.cleanup_memory()
                        self.last_cleanup = time.time()
                    
                    # 가비지 컬렉션
                    gc.collect()
                    
                    # 대기
                    time.sleep(GC_COLLECT_INTERVAL)
                    
                except Exception as e:
                    print(f"메모리 모니터 오류: {e}")
                    time.sleep(60)  # 오류 시 1분 대기
        
        thread = threading.Thread(target=memory_monitor, daemon=True)
        thread.start()
    
    def cleanup_memory(self):
        """메모리 정리"""
        try:
            # 가비지 컬렉션 강제 실행
            collected = gc.collect()
            print(f"메모리 정리 완료: {collected}개 객체 정리")
            
            # 캐시 크기 확인 및 필요시 정리
            if self.cache_size > MAX_CACHE_SIZE:
                print("캐시 크기 초과, 정리 중...")
                # 캐시 정리 로직은 각 모듈에서 구현
                
        except Exception as e:
            print(f"메모리 정리 중 오류: {e}")
    
    def update_cache_size(self, size_delta):
        """캐시 크기 업데이트"""
        self.cache_size += size_delta
        if self.cache_size < 0:
            self.cache_size = 0

# 전역 성능 관리자 인스턴스
performance_manager = PerformanceManager()

# 유틸리티 함수들
def optimize_for_render():
    """Render 환경에 최적화된 설정 적용"""
    import logging
    
    # 로깅 레벨 최적화 (프로덕션에서는 WARNING 이상만)
    if os.getenv('RENDER'):
        logging.getLogger().setLevel(logging.WARNING)
    
    # 파이썬 최적화 플래그
    if not os.getenv('PYTHONOPTIMIZE'):
        os.environ['PYTHONOPTIMIZE'] = '1'
    
    # 버퍼링 비활성화 (메모리 절약)
    os.environ['PYTHONUNBUFFERED'] = '1'

def get_memory_usage():
    """현재 메모리 사용량 반환 (MB)"""
    try:
        import psutil
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / 1024 / 1024
    except ImportError:
        return 0

def log_performance_stats():
    """성능 통계 로깅"""
    try:
        memory_mb = get_memory_usage()
        print(f"메모리 사용량: {memory_mb:.1f}MB")
        print(f"캐시 크기: {performance_manager.cache_size / 1024 / 1024:.1f}MB")
    except Exception as e:
        print(f"성능 통계 로깅 오류: {e}") 