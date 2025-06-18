#!/usr/bin/env python3
"""
Google Sheets API 연결 테스트 스크립트
"""

import logging
from sheets_service import test_sheets_connection, get_property_data

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)

def main():
    print("=" * 50)
    print("Google Sheets API 연결 테스트")
    print("=" * 50)
    
    # 1. 기본 연결 테스트
    print("\n1. 기본 연결 테스트...")
    if test_sheets_connection():
        print("✅ 기본 연결 성공!")
        
        # 2. 데이터 가져오기 테스트
        print("\n2. 데이터 가져오기 테스트...")
        test_data = get_property_data('강남월세')
        
        if test_data:
            print(f"✅ 데이터 가져오기 성공! {len(test_data)}개의 매물을 찾았습니다.")
            
            # 첫 번째 매물 정보 출력
            if len(test_data) > 0:
                print("\n첫 번째 매물 정보:")
                first_property = test_data[0]
                for key, value in first_property.items():
                    print(f"  {key}: {value}")
        else:
            print("❌ 데이터 가져오기 실패!")
    else:
        print("❌ 기본 연결 실패!")
    
    print("\n" + "=" * 50)
    print("테스트 완료")
    print("=" * 50)

if __name__ == "__main__":
    main() 