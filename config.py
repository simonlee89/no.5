import os

# Google Sheets Configuration
SPREADSHEET_ID = os.environ.get("SPREADSHEET_ID", "1C0-kWVHt_SvWIPfmCzKVOKr0pMFArixYNNhNw-vdCoE")
SHEET_RANGES = {
    '강남월세': "'[강남월세]'!A5:T",
    '강남전세': "'[강남전세]'!A5:T",
    '송파월세': "'[송파월세]'!A5:T",
    '송파전세': "'[송파전세]'!A5:T"
}

# Naver Cloud Platform Maps API Configuration
NAVER_CLIENT_ID = os.environ.get("NAVER_CLIENT_ID", "mxmsrqimlj")
NAVER_CLIENT_SECRET = os.environ.get("NAVER_CLIENT_SECRET", "PzStOTvfyk0zJ73XnglaVkA2VFcTV65mSZmzeqQG")

# Naver Cloud Platform Maps API URLs
NCP_MAPS_URLS = {
    'static_map': 'https://maps.apigw.ntruss.com/map-static/v2/raster',
    'directions_5': 'https://maps.apigw.ntruss.com/map-direction/v1/driving',
    'directions_15': 'https://maps.apigw.ntruss.com/map-direction-15/v1/driving',
    'geocoding': 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode',
    'reverse_geocoding': 'https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc'
}

# NCP Maps API Headers
NCP_HEADERS = {
    'x-ncp-apigw-api-key-id': NAVER_CLIENT_ID,
    'x-ncp-apigw-api-key': NAVER_CLIENT_SECRET
}
