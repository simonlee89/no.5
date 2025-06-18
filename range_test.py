from sheets_service import get_sheets_service, SPREADSHEET_ID

service = get_sheets_service()
sheet = service.spreadsheets()

print("=== 시트 범위별 데이터 비교 ===")

# 1. A1:T10 범위 (test_debug.py에서 사용한 범위)
print("\n1. A1:T10 범위:")
result1 = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range="[강남월세]!A1:T10").execute()
values1 = result1.get('values', [])
print(f"총 {len(values1)}행")

for i, row in enumerate(values1[:5]):
    if len(row) > 19:
        r_val = str(row[17]).strip() if len(row) > 17 and row[17] else ''
        s_val = str(row[18]).strip() if len(row) > 18 and row[18] else ''
        t_val = str(row[19]).strip() if len(row) > 19 and row[19] else ''
        print(f"  행 {i+1}: R='{r_val}', S='{s_val}', T='{t_val}'")

# 2. A5:T10 범위 (get_property_data에서 사용하는 시작점)
print("\n2. A5:T10 범위:")
result2 = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range="[강남월세]!A5:T10").execute()
values2 = result2.get('values', [])
print(f"총 {len(values2)}행")

for i, row in enumerate(values2):
    if len(row) > 19:
        r_val = str(row[17]).strip() if len(row) > 17 and row[17] else ''
        s_val = str(row[18]).strip() if len(row) > 18 and row[18] else ''
        t_val = str(row[19]).strip() if len(row) > 19 and row[19] else ''
        print(f"  행 {i+1}: R='{r_val}', S='{s_val}', T='{t_val}'") 