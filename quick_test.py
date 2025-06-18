import requests
from collections import Counter

try:
    response = requests.get("http://127.0.0.1:5050/api/properties/강남월세")
    data = response.json()
    
    # 상태별 개수 계산
    statuses = [item['status'] for item in data]
    status_counts = Counter(statuses)
    
    print("=== API 응답 구조 ===")
    print(f"응답 타입: {type(data)}")
    if isinstance(data, dict):
        print(f"키들: {list(data.keys())}")
    elif isinstance(data, list):
        print(f"리스트 길이: {len(data)}")
        if data:
            print(f"첫 번째 항목 타입: {type(data[0])}")
            if isinstance(data[0], dict):
                print(f"첫 번째 항목 키들: {list(data[0].keys())}")
    
    print(f"\n원본 응답 (처음 500자):")
    print(str(data)[:500])
    
    print("=== 상태별 개수 ===")
    print(f"온하: {status_counts.get('온하', 0)}개")
    print(f"공클: {status_counts.get('공클', 0)}개") 
    print(f"갠매: {status_counts.get('갠매', 0)}개")
    print(f"총 매물: {len(data)}개")
    
    print("\n=== 처음 10개 매물 상태 ===")
    for i, prop in enumerate(data[:10]):
        print(f"매물 {i+1}: {prop['status']} (ID: {prop['id']})")
        
except Exception as e:
    print(f"오류: {e}")
    import traceback
    traceback.print_exc() 