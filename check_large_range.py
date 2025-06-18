from sheets_service import get_sheets_service, SPREADSHEET_ID

service = get_sheets_service()
sheet = service.spreadsheets()

print("=== 큰 범위에서 온하/공클 매물 찾기 ===")

# 매물 데이터 범위에서 온하/공클 찾기 (5행부터 500행까지)
result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range="[강남월세]!A5:T500").execute()
values = result.get('values', [])

print(f"총 {len(values)}개 매물 확인 중...")

온하_count = 0
공클_count = 0
갠매_count = 0
기타_count = 0

온하_examples = []
공클_examples = []

for i, row in enumerate(values):
    if len(row) > 19:
        # 첫 번째 컬럼이 매물 ID인지 확인
        first_col = str(row[0]).strip()
        if first_col.isdigit() and len(first_col) > 8:
            r_val = str(row[17]).strip() if len(row) > 17 and row[17] else ''
            s_val = str(row[18]).strip() if len(row) > 18 and row[18] else ''
            t_val = str(row[19]).strip() if len(row) > 19 and row[19] else ''
            
            # 상태 결정 (우선순위: 온하 > 공클 > 갠매)
            if r_val == '온하':
                온하_count += 1
                if len(온하_examples) < 3:
                    온하_examples.append(f"ID: {first_col}, 행: {i+5}")
            elif s_val == '공클':
                공클_count += 1
                if len(공클_examples) < 3:
                    공클_examples.append(f"ID: {first_col}, 행: {i+5}")
            elif t_val == '갠매':
                갠매_count += 1
            else:
                기타_count += 1

print(f"\n=== 결과 ===")
print(f"온하: {온하_count}개")
print(f"공클: {공클_count}개")
print(f"갠매: {갠매_count}개")
print(f"기타: {기타_count}개")
print(f"총 매물: {온하_count + 공클_count + 갠매_count + 기타_count}개")

if 온하_examples:
    print(f"\n온하 예시:")
    for ex in 온하_examples:
        print(f"  {ex}")

if 공클_examples:
    print(f"\n공클 예시:")
    for ex in 공클_examples:
        print(f"  {ex}")

if 온하_count == 0 and 공클_count == 0:
    print(f"\n❌ 실제 매물 데이터에는 온하/공클이 없습니다!")
    print(f"모든 매물이 갠매 상태입니다.")
else:
    print(f"\n✅ 온하/공클 매물을 찾았습니다!") 