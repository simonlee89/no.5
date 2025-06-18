import logging
from sheets_service import get_sheets_service, SPREADSHEET_ID, SHEET_RANGES

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(message)s')

def debug_column_positions():
    """구글 시트에서 온하/공클/갠매의 정확한 위치를 찾는 함수"""
    try:
        print("=== 컬럼 위치 디버깅 시작 ===")
        service = get_sheets_service()
        sheet = service.spreadsheets()
        
        # 강남월세 시트 데이터 가져오기
        range_name = SHEET_RANGES.get('강남월세')
        result = sheet.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=range_name
        ).execute()
        
        values = result.get('values', [])
        print(f"총 {len(values)}개 행 발견")
        
        # 처음 10개 행만 확인
        for i in range(min(10, len(values))):
            row = values[i]
            print(f"\n=== 행 {i+1} (총 {len(row)}개 컬럼) ===")
            
            # 모든 컬럼 확인
            for col_idx in range(len(row)):
                cell_value = str(row[col_idx]).strip() if row[col_idx] else ''
                if cell_value:
                    col_letter = chr(65 + col_idx) if col_idx < 26 else f"A{chr(65 + col_idx - 26)}"
                    
                    # 온하, 공클, 갠매 키워드 확인
                    if any(keyword in cell_value for keyword in ['온하', '공클', '갠매']):
                        print(f"⭐ {col_letter}열(인덱스{col_idx}): '{cell_value}' ⭐")
                    elif len(cell_value) < 50:  # 짧은 값들만 출력
                        print(f"{col_letter}열(인덱스{col_idx}): '{cell_value}'")
        
        print("\n=== 디버깅 완료 ===")
        
    except Exception as e:
        print(f"오류 발생: {str(e)}")

if __name__ == "__main__":
    debug_column_positions() 