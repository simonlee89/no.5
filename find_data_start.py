from sheets_service import get_sheets_service, SPREADSHEET_ID

service = get_sheets_service()
sheet = service.spreadsheets()

print("=== 실제 매물 데이터 시작 행 찾기 ===")

# 더 큰 범위로 데이터 가져오기
result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range="[강남월세]!A1:T50").execute()
values = result.get('values', [])

print(f"총 {len(values)}행 확인 중...")

for i, row in enumerate(values):
    if len(row) > 0:
        # 첫 번째 컬럼이 숫자로 된 매물 ID인지 확인
        first_col = str(row[0]).strip()
        if first_col.isdigit() and len(first_col) > 8:  # 매물 ID는 보통 9자리 이상
            print(f"\n🎯 매물 데이터 시작: 행 {i+1}")
            print(f"  매물 ID: {first_col}")
            
            # 이 행의 R, S, T 열 확인
            r_val = str(row[17]).strip() if len(row) > 17 and row[17] else ''
            s_val = str(row[18]).strip() if len(row) > 18 and row[18] else ''
            t_val = str(row[19]).strip() if len(row) > 19 and row[19] else ''
            
            print(f"  R열(온하): '{r_val}'")
            print(f"  S열(공클): '{s_val}'")
            print(f"  T열(갠매): '{t_val}'")
            
            # 처음 5개 매물 확인
            print(f"\n처음 5개 매물 상태:")
            for j in range(5):
                if i + j < len(values):
                    row_data = values[i + j]
                    if len(row_data) > 19:
                        id_val = str(row_data[0]).strip() if row_data[0] else ''
                        r_val = str(row_data[17]).strip() if len(row_data) > 17 and row_data[17] else ''
                        s_val = str(row_data[18]).strip() if len(row_data) > 18 and row_data[18] else ''
                        t_val = str(row_data[19]).strip() if len(row_data) > 19 and row_data[19] else ''
                        
                        # 상태 결정
                        if r_val == '온하':
                            status = '온하'
                        elif s_val == '공클':
                            status = '공클'
                        elif t_val == '갠매':
                            status = '갠매'
                        else:
                            status = 'NONE'
                            
                        print(f"  매물 {j+1} (ID: {id_val}): {status}")
            break
    else:
        print(f"행 {i+1}: 빈 행")
        
print(f"\n현재 SHEET_RANGES 설정:")
print(f"'강남월세': '[강남월세]!A5:T'")
print(f"\n권장 설정:")
print(f"실제 매물 데이터가 시작되는 행을 기준으로 범위를 조정해야 합니다.") 