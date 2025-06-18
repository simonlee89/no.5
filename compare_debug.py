import requests
from sheets_service import get_sheets_service, SPREADSHEET_ID, SHEET_RANGES, determine_status

# API 데이터 가져오기
response = requests.get("http://127.0.0.1:5050/api/properties/강남월세")
api_data = response.json()

# 직접 시트 데이터 가져오기
service = get_sheets_service()
sheet = service.spreadsheets()
range_name = SHEET_RANGES.get('강남월세')
result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range=range_name).execute()
values = result.get('values', [])

print("=== 직접 시트 데이터와 API 데이터 비교 ===")

# 처음 5개 매물 비교
for i in range(min(5, len(values))):
    row = values[i]
    if len(row) > 0:
        property_id = str(row[0]).strip() if row[0] else ''
        
        # R, S, T 열 값 확인
        r_value = str(row[17]).strip() if len(row) > 17 and row[17] else ''
        s_value = str(row[18]).strip() if len(row) > 18 and row[18] else ''
        t_value = str(row[19]).strip() if len(row) > 19 and row[19] else ''
        
        # determine_status 함수로 상태 계산
        direct_status = determine_status(r_value, s_value, t_value, '강남월세')
        
        # API에서 같은 ID 찾기
        api_item = next((item for item in api_data if item['id'] == property_id), None)
        api_status = api_item['status'] if api_item else 'NOT_FOUND'
        
        print(f"\n매물 {i+1} (ID: {property_id}):")
        print(f"  R열: '{r_value}', S열: '{s_value}', T열: '{t_value}'")
        print(f"  직접 계산: {direct_status}")
        print(f"  API 결과: {api_status}")
        print(f"  일치: {'✅' if direct_status == api_status else '❌'}") 