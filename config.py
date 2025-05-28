import os

# Google Sheets Configuration
SPREADSHEET_ID = os.environ.get("SPREADSHEET_ID", "1C0-kWVHt_SvWIPfmCzKVOKr0pMFArixYNNhNw-vdCoE")
SHEET_RANGES = {
    '강남월세': "'[강남월세]'!A5:T",
    '강남전세': "'[강남전세]'!A5:T",
    '송파월세': "'[송파월세]'!A5:T",
    '송파전세': "'[송파전세]'!A5:T"
}

# Naver Maps API Configuration
NAVER_CLIENT_ID = os.environ.get("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.environ.get("NAVER_CLIENT_SECRET")
