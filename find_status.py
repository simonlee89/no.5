from sheets_service import get_sheets_service, SPREADSHEET_ID

service = get_sheets_service()
sheet = service.spreadsheets()

print("=== 전체 시트에서 온하/공클 찾기 ===")

# 전체 데이터 가져오기 (큰 범위로)
result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range="[강남월세]!A1:T100").execute()
values = result.get('values', [])

print(f"총 {len(values)}행 검색 중...")

온하_found = []
공클_found = []

for i, row in enumerate(values):
    if len(row) > 19:
        r_val = str(row[17]).strip() if len(row) > 17 and row[17] else ''
        s_val = str(row[18]).strip() if len(row) > 18 and row[18] else ''
        t_val = str(row[19]).strip() if len(row) > 19 and row[19] else ''
        
        if '온하' in r_val:
            온하_found.append(f"행 {i+1}: R열에 '{r_val}'")
        if '공클' in s_val:
            공클_found.append(f"행 {i+1}: S열에 '{s_val}'")

print(f"\n=== 온하 발견된 위치 ({len(온하_found)}개) ===")
for item in 온하_found[:10]:  # 처음 10개만 출력
    print(item)

print(f"\n=== 공클 발견된 위치 ({len(공클_found)}개) ===")
for item in 공클_found[:10]:  # 처음 10개만 출력
    print(item)

if not 온하_found and not 공클_found:
    print("\n❌ 온하와 공클을 찾을 수 없습니다!")
    print("다른 컬럼을 확인해보겠습니다...")
    
    # 모든 컬럼에서 온하/공클 찾기
    for i, row in enumerate(values[:20]):  # 처음 20행만
        for j, cell in enumerate(row):
            cell_str = str(cell).strip()
            if '온하' in cell_str or '공클' in cell_str:
                col_letter = chr(65 + j) if j < 26 else f"A{chr(65 + j - 26)}"
                print(f"  행 {i+1} {col_letter}열(인덱스{j}): '{cell_str}'") 