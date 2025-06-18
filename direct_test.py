from sheets_service import get_property_data
from collections import Counter

print("=== get_property_data 직접 호출 테스트 ===")

# 직접 함수 호출
properties = get_property_data('강남월세')

# 상태별 개수 계산
statuses = [prop['status'] for prop in properties]
status_counts = Counter(statuses)

print(f"\n=== 직접 호출 결과 ===")
print(f"온하: {status_counts.get('온하', 0)}개")
print(f"공클: {status_counts.get('공클', 0)}개") 
print(f"갠매: {status_counts.get('갠매', 0)}개")
print(f"총 매물: {len(properties)}개")

print(f"\n=== 처음 10개 매물 상태 ===")
for i, prop in enumerate(properties[:10]):
    print(f"매물 {i+1}: {prop['status']} (ID: {prop['id']})") 