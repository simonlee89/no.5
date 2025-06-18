import requests
import logging
from config import NCP_MAPS_URLS, NCP_HEADERS
from ncp_maps_utils import geocode_address

logger = logging.getLogger(__name__)

def generate_static_map_with_markers(properties, width=800, height=600, zoom=13):
    """
    매물 정보를 바탕으로 정적 지도 이미지 URL을 생성합니다.
    """
    if not properties:
        # 기본 서울 중심 지도
        center_lat, center_lng = 37.5665, 126.9780
    else:
        # 첫 번째 매물을 중심으로 설정
        first_property = properties[0]
        geocode_result = geocode_address(first_property.get('location', '서울특별시'))
        if geocode_result:
            center_lat, center_lng = geocode_result['lat'], geocode_result['lng']
        else:
            center_lat, center_lng = 37.5665, 126.9780

    try:
        url = NCP_MAPS_URLS['static_map']
        params = {
            'center': f"{center_lng},{center_lat}",
            'level': zoom,
            'w': width,
            'h': height,
            'format': 'png',
            'scale': 2  # 고해상도
        }
        
        # 매물 마커 추가
        if properties:
            markers = []
            for i, property_data in enumerate(properties[:20]):  # 최대 20개 마커
                location = property_data.get('location')
                if location:
                    geocode_result = geocode_address(location)
                    if geocode_result:
                        lat, lng = geocode_result['lat'], geocode_result['lng']
                        status = property_data.get('status', '일반')
                        
                        # 갠매는 파란색, 일반은 회색
                        color = 'blue' if status == '갠매' else 'gray'
                        marker = f"type:t|size:mid|pos:{lng} {lat}|color:{color}|label:{i+1}"
                        markers.append(marker)
            
            if markers:
                params['markers'] = '|'.join(markers)
        
        # URL 파라미터를 직접 구성
        param_str = '&'.join([f"{k}={v}" for k, v in params.items()])
        full_url = f"{url}?{param_str}"
        
        # API 호출 테스트
        response = requests.get(url, headers=NCP_HEADERS, params=params)
        if response.status_code == 200:
            logger.info("정적 지도 생성 성공")
            return full_url
        else:
            logger.error(f"정적 지도 생성 실패: {response.status_code}")
            return None
            
    except Exception as e:
        logger.error(f"정적 지도 생성 중 오류: {str(e)}")
        return None

def create_simple_map_html(properties):
    """
    네이버 지도 API 대신 사용할 수 있는 간단한 HTML 지도를 생성합니다.
    """
    # 매물 위치 정보 수집
    locations = []
    for prop in properties:
        location = prop.get('location')
        if location:
            geocode_result = geocode_address(location)
            if geocode_result:
                locations.append({
                    'lat': geocode_result['lat'],
                    'lng': geocode_result['lng'],
                    'title': location,
                    'status': prop.get('status', '일반'),
                    'deposit': prop.get('deposit', ''),
                    'monthly_rent': prop.get('monthly_rent', '')
                })
    
    # Leaflet.js를 사용한 대체 지도 HTML
    map_html = f"""
    <div id="leaflet-map" style="width: 100%; height: 100vh;"></div>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        var map = L.map('leaflet-map').setView([37.5665, 126.9780], 13);
        
        L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
            attribution: '© OpenStreetMap contributors'
        }}).addTo(map);
        
        var locations = {locations};
        
        locations.forEach(function(loc) {{
            var color = loc.status === '갠매' ? 'blue' : 'gray';
            var marker = L.circleMarker([loc.lat, loc.lng], {{
                color: color,
                fillColor: color,
                fillOpacity: 0.7,
                radius: 8
            }}).addTo(map);
            
            marker.bindPopup(`
                <div>
                    <h5>${{loc.title}}</h5>
                    <p>상태: ${{loc.status}}</p>
                    <p>보증금: ${{loc.deposit}}</p>
                    <p>월세: ${{loc.monthly_rent}}</p>
                </div>
            `);
        }});
        
        if (locations.length > 0) {{
            var group = new L.featureGroup(locations.map(loc => 
                L.circleMarker([loc.lat, loc.lng])
            ));
            map.fitBounds(group.getBounds().pad(0.1));
        }}
    </script>
    """
    
    return map_html 