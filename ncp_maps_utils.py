import requests
import json
import logging
from config import NCP_MAPS_URLS, NCP_HEADERS

logger = logging.getLogger(__name__)

def geocode_address(address):
    """
    주소를 위도/경도로 변환하는 함수
    네이버 클라우드 플랫폼 Geocoding API 사용
    """
    try:
        url = NCP_MAPS_URLS['geocoding']
        params = {
            'query': address
        }
        
        # 디버깅을 위한 로그 추가
        logger.info(f"Geocoding request URL: {url}")
        logger.info(f"Geocoding request params: {params}")
        logger.info(f"Geocoding request headers: {NCP_HEADERS}")
        
        response = requests.get(url, headers=NCP_HEADERS, params=params)
        
        # 응답 상태 코드와 내용 로그
        logger.info(f"Response status code: {response.status_code}")
        logger.info(f"Response text: {response.text}")
        
        response.raise_for_status()
        
        data = response.json()
        
        if data['status'] == 'OK' and len(data['addresses']) > 0:
            address_info = data['addresses'][0]
            return {
                'lat': float(address_info['y']),
                'lng': float(address_info['x']),
                'formatted_address': address_info['roadAddress'] or address_info['jibunAddress']
            }
        else:
            logger.warning(f"Geocoding failed for address: {address}")
            logger.warning(f"API response: {data}")
            return None
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Geocoding API request failed: {str(e)}")
        return None
    except (KeyError, ValueError) as e:
        logger.error(f"Geocoding response parsing failed: {str(e)}")
        return None

def reverse_geocode(lat, lng):
    """
    위도/경도를 주소로 변환하는 함수
    네이버 클라우드 플랫폼 Reverse Geocoding API 사용
    """
    try:
        url = NCP_MAPS_URLS['reverse_geocoding']
        params = {
            'coords': f"{lng},{lat}",
            'sourcecrs': 'epsg:4326',
            'targetcrs': 'epsg:4326',
            'orders': 'roadaddr,admcode,legalcode'
        }
        
        response = requests.get(url, headers=NCP_HEADERS, params=params)
        response.raise_for_status()
        
        data = response.json()
        
        if data['status']['code'] == 0 and len(data['results']) > 0:
            result = data['results'][0]
            if 'region' in result:
                region = result['region']
                address_parts = []
                
                # 주소 구성
                if 'area1' in region and region['area1']['name']:
                    address_parts.append(region['area1']['name'])
                if 'area2' in region and region['area2']['name']:
                    address_parts.append(region['area2']['name'])
                if 'area3' in region and region['area3']['name']:
                    address_parts.append(region['area3']['name'])
                    
                return ' '.join(address_parts)
            
        logger.warning(f"Reverse geocoding failed for coordinates: {lat}, {lng}")
        return None
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Reverse geocoding API request failed: {str(e)}")
        return None
    except (KeyError, ValueError) as e:
        logger.error(f"Reverse geocoding response parsing failed: {str(e)}")
        return None

def get_static_map_url(lat, lng, width=400, height=400, zoom=15, markers=None):
    """
    정적 지도 이미지 URL을 생성하는 함수
    네이버 클라우드 플랫폼 Static Map API 사용
    """
    try:
        url = NCP_MAPS_URLS['static_map']
        params = {
            'center': f"{lng},{lat}",
            'level': zoom,
            'w': width,
            'h': height,
            'format': 'png'
        }
        
        # 마커 추가
        if markers:
            marker_strings = []
            for marker in markers:
                marker_str = f"type:t|size:mid|pos:{marker['lng']} {marker['lat']}"
                if 'color' in marker:
                    marker_str += f"|color:{marker['color']}"
                if 'label' in marker:
                    marker_str += f"|label:{marker['label']}"
                marker_strings.append(marker_str)
            params['markers'] = '|'.join(marker_strings)
        
        # URL 파라미터를 직접 구성
        param_str = '&'.join([f"{k}={v}" for k, v in params.items()])
        full_url = f"{url}?{param_str}"
        
        return full_url
        
    except Exception as e:
        logger.error(f"Static map URL generation failed: {str(e)}")
        return None

def test_ncp_maps_connection():
    """
    네이버 클라우드 플랫폼 Maps API 연결 테스트
    """
    try:
        # 간단한 지오코딩 테스트
        test_result = geocode_address("서울특별시 강남구 역삼동")
        if test_result:
            logger.info("✅ NCP Maps API 연결 성공!")
            return True
        else:
            logger.error("❌ NCP Maps API 연결 실패!")
            return False
    except Exception as e:
        logger.error(f"NCP Maps API 테스트 중 오류: {str(e)}")
        return False 