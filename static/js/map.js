let map;
let markers = [];
let infoWindows = [];
let allProperties = [];

// 렌더 토큰: 매물 표시 세션을 구분하여 초기화 시 이전 세션을 무효화
let renderToken = 0;

// 성능 개선: 마커 클러스터링을 위한 변수
let markerClusterer = null;

function initMap() {
    const mapOptions = {
        center: new naver.maps.LatLng(37.5014, 127.0398),
        zoom: 15,
        mapTypeControl: true,
        // 성능 개선: 지도 옵션 최적화
        zoomControl: true,
        zoomControlOptions: {
            position: naver.maps.Position.TOP_RIGHT
        },
        scaleControl: false,
        logoControl: false,
        mapDataControl: false,
        minZoom: 10,
        maxZoom: 19
    };
    
    map = new naver.maps.Map('map', mapOptions);
}

async function loadProperties() {
    // 성능 개선: 콘솔 로그 최소화
    const isProduction = window.location.hostname !== 'localhost';
    if (!isProduction) console.log('매물 데이터 로드 시작');
    
    try {
        // 1. 지도와 데이터만 초기화 (필터 상태는 유지)
        clearMap();
        allProperties = [];
        
        const sheetTypeElement = document.querySelector('input[name="sheetType"]:checked');
        if (!sheetTypeElement) {
            console.error('시트 타입이 선택되지 않았습니다.');
            return;
        }
        
        const sheetType = sheetTypeElement.value;
        
        // 로딩 상태 표시
        const filterButton = document.getElementById('filterButton');
        if (filterButton) {
            filterButton.disabled = true;
            filterButton.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 16px; height: 16px; border: 2px solid #ffffff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    매물 로딩 중...
                </div>
            `;
        }
        
        // 스피너 애니메이션 CSS 추가 (한 번만)
        if (!document.getElementById('spinner-style')) {
            const style = document.createElement('style');
            style.id = 'spinner-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        const response = await fetch(`/api/properties/${sheetType}`);
        
        if (response.ok) {
            const data = await response.json();
            
            if (Array.isArray(data)) {
                allProperties = data;
                if (!isProduction) console.log(`${sheetType}: ${allProperties.length}개 매물 로드됨`);
            } else {
                console.error('API 응답이 배열이 아닙니다:', data);
                allProperties = [];
            }
        } else {
            console.error('API 응답 오류:', response.status);
            allProperties = [];
        }
    } catch (error) {
        console.error('매물 로드 중 오류 발생:', error);
        allProperties = [];
    } finally {
        // 로딩 상태 해제
        const filterButton = document.getElementById('filterButton');
        if (filterButton) {
            filterButton.disabled = false;
            filterButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                    <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                매물 검색하기
            `;
        }
        
        // 2. 매물 로드 완료 후 자동으로 필터링 및 지도 표시
        if (allProperties.length > 0) {
            filterProperties();
        }
    }
}

// 지오코딩 캐시 관리
const GEOCODING_CACHE_KEY = 'geocoding_cache';
const CACHE_EXPIRY_HOURS = 48; // 48시간으로 증가

function getGeocodingCache() {
    try {
        const cached = localStorage.getItem(GEOCODING_CACHE_KEY);
        if (!cached) return {};
        
        const data = JSON.parse(cached);
        const now = Date.now();
        
        // 만료된 항목 제거
        Object.keys(data).forEach(key => {
            if (now - data[key].timestamp > CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
                delete data[key];
            }
        });
        
        return data;
    } catch (error) {
        return {};
    }
}

function setGeocodingCache(cache) {
    try {
        localStorage.setItem(GEOCODING_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        // 로컬 스토리지 오류 무시
    }
}

// 배치 지오코딩 함수 - 성능 개선
async function batchGeocode(addresses) {
    const cache = getGeocodingCache();
    const results = {};
    const uncachedAddresses = [];
    
    // 캐시된 결과 먼저 수집
    addresses.forEach(address => {
        const cacheKey = address.trim().toLowerCase();
        if (cache[cacheKey]) {
            results[address] = cache[cacheKey].result;
        } else {
            uncachedAddresses.push(address);
        }
    });
    
    // 성능 개선: 배치 크기 20으로 증가
    const batchSize = 20;
    for (let i = 0; i < uncachedAddresses.length; i += batchSize) {
        const batch = uncachedAddresses.slice(i, i + batchSize);
        const batchPromises = batch.map(address => geocodeAddress(address));
        
        try {
            const batchResults = await Promise.all(batchPromises);
            batch.forEach((address, index) => {
                if (batchResults[index]) {
                    results[address] = batchResults[index];
                    
                    // 즉시 캐시에 저장
                    const cacheKey = address.trim().toLowerCase();
                    cache[cacheKey] = {
                        result: batchResults[index],
                        timestamp: Date.now()
                    };
                }
            });
            
            // 배치 처리 후 캐시 업데이트
            setGeocodingCache(cache);
            
        } catch (error) {
            // 개별 오류는 무시
        }
        
        // 성능 개선: API 호출 간격 25ms로 단축
        if (i + batchSize < uncachedAddresses.length) {
            await new Promise(resolve => setTimeout(resolve, 25));
        }
    }
    
    return results;
}

async function geocodeAddress(address) {
    if (!address) return null;
    
    // 캐시에서 먼저 확인
    const cache = getGeocodingCache();
    const cacheKey = address.trim().toLowerCase();
    
    if (cache[cacheKey]) {
        return cache[cacheKey].result;
    }
    
    try {
        const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
        const data = await response.json();
        
        if (data.status === 'OK') {
            const result = {
                lat: data.result.lat,
                lng: data.result.lng,
                formatted_address: data.result.formatted_address
            };
            
            // 캐시에 저장
            cache[cacheKey] = {
                result: result,
                timestamp: Date.now()
            };
            setGeocodingCache(cache);
            
            return result;
        } else {
            return null;
        }
    } catch (error) {
        return null;
    }
}

function parseAmount(str) {
    if (!str) return 0;
    return parseInt(str.replace(/[^0-9]/g, '')) || 0;
}

function clearMap() {
    // 렌더 토큰 증가 → 기존 displayProperties 루프 무효화
    renderToken += 1;
    
    // 기존 마커들 제거
    markers.forEach(marker => {
        if (marker) {
            marker.setMap(null);
        }
    });
    markers = [];
    
    // 기존 InfoWindow들 닫기
    infoWindows.forEach(infoWindow => {
        if (infoWindow) {
            infoWindow.close();
        }
    });
    infoWindows = [];
    
    // 매물 목록 UI도 초기화
    const propertyList = document.getElementById('propertyList');
    if (propertyList) {
        propertyList.innerHTML = '';
    }
}

function resetSearchFilters() {
    console.log('검색 필터 초기화 시작...');
    
    try {
        // 검색 입력 초기화
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.placeholder = '지역명으로 검색해보세요';
            // 이벤트 트리거하여 변경 사항 반영
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('검색 입력 초기화 완료');
        } else {
            console.warn('검색 입력 필드를 찾을 수 없습니다.');
        }
        
        // 매물 상태 초기화 부분 제거 - 사용자가 선택한 상태 유지
        // 기존 코드에서 상태를 "공클"로 강제 초기화하던 부분을 제거합니다
        console.log('매물 상태는 사용자 선택 상태를 유지합니다.');
        
        // 보증금 범위 초기화
        const depositInputs = [
            'depositBillionStart', 'depositMillionStart', 
            'depositBillionEnd', 'depositMillionEnd'
        ];
        
        let depositResetCount = 0;
        depositInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.value = '';
                input.placeholder = '0';
                // 이벤트 트리거
                input.dispatchEvent(new Event('input', { bubbles: true }));
                depositResetCount++;
            } else {
                console.warn(`보증금 입력 필드 ${inputId}를 찾을 수 없습니다.`);
            }
        });
        console.log(`보증금 범위 초기화 완료 (${depositResetCount}/${depositInputs.length})`);
        
        // 월세 범위 초기화
        const monthlyRentInputs = ['monthlyRentStart', 'monthlyRentEnd'];
        
        let rentResetCount = 0;
        monthlyRentInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.value = '';
                input.placeholder = '0';
                // 이벤트 트리거
                input.dispatchEvent(new Event('input', { bubbles: true }));
                rentResetCount++;
            } else {
                console.warn(`월세 입력 필드 ${inputId}를 찾을 수 없습니다.`);
            }
        });
        console.log(`월세 범위 초기화 완료 (${rentResetCount}/${monthlyRentInputs.length})`);
        
        console.log('검색 필터 초기화 완료');
        
    } catch (error) {
        console.error('검색 필터 초기화 중 오류 발생:', error);
    }
}

// 완전한 시스템 초기화 함수
function completeReset() {
    console.log('=== 완전한 시스템 초기화 시작 ===');
    
    // 1. 지도와 데이터 완전 초기화
    clearMap();
    allProperties = [];
    
    // 2. 모든 필터 초기화
    resetSearchFilters();
    
    // 3. 매물 개수 표시 초기화
    const propertyCount = document.querySelector('.property-count');
    if (propertyCount) {
        propertyCount.textContent = '매물 0개';
    }
    
    // 4. 로딩 상태 해제
    const filterButton = document.getElementById('filterButton');
    if (filterButton) {
        filterButton.disabled = false;
        filterButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            매물 검색하기
        `;
    }
    
    console.log('=== 완전한 시스템 초기화 완료 ===');
}

// 필터 상태 확인 함수 (디버깅용)
function checkFilterStatus() {
    console.log('=== 현재 필터 상태 확인 ===');
    
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.querySelector('input[name="statusFilter"]:checked');
    const sheetType = document.querySelector('input[name="sheetType"]:checked');
    
    console.log('검색 입력:', searchInput?.value || '비어있음');
    console.log('상태 필터:', statusFilter?.value || '선택안됨');
    console.log('매물 유형:', sheetType?.value || '선택안됨');
    
    const depositInputs = ['depositBillionStart', 'depositMillionStart', 'depositBillionEnd', 'depositMillionEnd'];
    const monthlyRentInputs = ['monthlyRentStart', 'monthlyRentEnd'];
    
    console.log('보증금 입력값:');
    depositInputs.forEach(id => {
        const input = document.getElementById(id);
        console.log(`  ${id}: ${input?.value || '비어있음'}`);
    });
    
    console.log('월세 입력값:');
    monthlyRentInputs.forEach(id => {
        const input = document.getElementById(id);
        console.log(`  ${id}: ${input?.value || '비어있음'}`);
    });
    
    console.log('매물 데이터 수:', allProperties.length);
    console.log('=== 필터 상태 확인 완료 ===');
}

function resetFilters() {
    console.log('=== 전체 필터 초기화 시작 ===');
    
    // 1. 검색 필터 초기화 (매물 상태는 초기화하지 않음)
    resetSearchFilters();
    
    // 2. 매물 유형을 첫 번째 옵션으로 초기화
    const defaultSheet = document.getElementById('gangnam-monthly');
    if (defaultSheet) {
        defaultSheet.checked = true;
        console.log('매물 유형을 "강남월세"로 초기화');
    }
    
    // 3. 매물 상태를 "공클"로 초기화
    const gongkeulStatus = document.getElementById('gongkeul');
    if (gongkeulStatus) {
        gongkeulStatus.checked = true;
        gongkeulStatus.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('매물 상태를 "공클"로 초기화');
    }
    
    // 4. 기존 마커들과 매물 데이터 완전 제거
    clearMap();
    allProperties = [];
    
    // 5. 매물 개수 표시 초기화
    const propertyCount = document.querySelector('.property-count');
    if (propertyCount) {
        propertyCount.textContent = '매물 0개';
    }
    
    // 6. 초기화 후 상태 확인
    setTimeout(() => {
        checkFilterStatus();
    }, 50);
    
    // 7. 사용자에게 피드백 제공
    console.info('모든 필터가 초기화되었습니다. "매물 검색하기" 버튼을 눌러 새로운 매물을 로드해주세요.');
    
    console.log('=== 전체 필터 초기화 완료 ===');
}

function filterProperties() {
    if (allProperties.length === 0) {
        return;
    }

    // DOM 요소 확인
    const statusElement = document.querySelector('input[name="statusFilter"]:checked');
    const searchElement = document.getElementById('searchInput');
    const sheetTypeElement = document.querySelector('input[name="sheetType"]:checked');
    
    if (!statusElement || !searchElement || !sheetTypeElement) {
        console.error('필터 요소를 찾을 수 없습니다.');
        return;
    }

    const selectedStatus = statusElement.value;
    const searchText = searchElement.value.toLowerCase().trim();
    const selectedSheetType = sheetTypeElement.value;

    // 보증금 범위 계산 (억 단위를 만원으로 변환)
    const depositBillionStartEl = document.getElementById('depositBillionStart');
    const depositMillionStartEl = document.getElementById('depositMillionStart');
    const depositBillionEndEl = document.getElementById('depositBillionEnd');
    const depositMillionEndEl = document.getElementById('depositMillionEnd');
    
    const depositStartBillion = parseInt(depositBillionStartEl?.value || 0) || 0;
    const depositStartMillion = parseInt(depositMillionStartEl?.value || 0) || 0;
    const depositEndBillion = parseInt(depositBillionEndEl?.value || 0) || 0;
    const depositEndMillion = parseInt(depositMillionEndEl?.value || 0) || 0;
    
    // 총 보증금을 만원 단위로 계산
    const totalDepositStart = (depositStartBillion * 10000) + depositStartMillion;
    const totalDepositEnd = (depositEndBillion * 10000) + depositEndMillion;

    // 월세 범위 (만원 단위)
    const monthlyRentStartEl = document.getElementById('monthlyRentStart');
    const monthlyRentEndEl = document.getElementById('monthlyRentEnd');
    
    const monthlyRentStart = parseInt(monthlyRentStartEl?.value || 0) || 0;
    const monthlyRentEnd = parseInt(monthlyRentEndEl?.value || 0) || 0;

    // 성능 개선: 필터링 최적화
    const filteredProperties = allProperties.filter(property => {
        // 상태 필터
        if (property.status !== selectedStatus) {
            return false;
        }

        // 지역 검색 필터
        if (searchText && property.location && !property.location.toLowerCase().includes(searchText)) {
            return false;
        }

        // 보증금 필터
        const propertyDeposit = parseAmount(property.deposit);
        if (totalDepositStart > 0 && propertyDeposit < totalDepositStart) {
            return false;
        }
        if (totalDepositEnd > 0 && propertyDeposit > totalDepositEnd) {
            return false;
        }

        // 월세 필터
        const propertyMonthlyRent = parseAmount(property.monthly_rent);
        if (monthlyRentStart > 0 && propertyMonthlyRent < monthlyRentStart) {
            return false;
        }
        if (monthlyRentEnd > 0 && propertyMonthlyRent > monthlyRentEnd) {
            return false;
        }
        return true;
    });

    const isProduction = window.location.hostname !== 'localhost';
    if (!isProduction) console.log(`필터링 완료: ${filteredProperties.length}개 매물`);
    
    displayProperties(filteredProperties);
}

async function displayProperties(properties) {
    // 기존 마커들 제거
    clearMap();

    const myToken = renderToken;

    if (properties.length === 0) {
        const propertyList = document.getElementById('propertyList');
        if (propertyList) {
            propertyList.innerHTML = '<div class="empty-list">조건에 맞는 매물이 없습니다.</div>';
        }
        return;
    }
    
    // 주소별로 매물들을 그룹화
    const groupedProperties = {};
    properties.forEach(property => {
        if (!property.location) {
            return;
        }
        
        const locationKey = property.location.trim();
        if (!groupedProperties[locationKey]) {
            groupedProperties[locationKey] = [];
        }
        groupedProperties[locationKey].push(property);
    });
    
    // 모든 주소를 배치로 지오코딩
    const uniqueLocations = Object.keys(groupedProperties);
    const geocodeResults = await batchGeocode(uniqueLocations);
    
    // 초기화 확인
    if (myToken !== renderToken) {
        return;
    }
    
    // 성능 개선: 마커 생성을 배치로 처리
    const markerBatch = [];
    
    // 그룹화된 매물들을 지도에 마커로 표시
    for (const location of uniqueLocations) {
        const propertiesAtLocation = groupedProperties[location];
        const geocodeResult = geocodeResults[location];
        
        if (geocodeResult && geocodeResult.lat && geocodeResult.lng) {
            const position = new naver.maps.LatLng(geocodeResult.lat, geocodeResult.lng);
            
            // 매물 개수에 따른 마커 표시
            const propertyCount = propertiesAtLocation.length;
            const displayText = propertyCount > 1 ? `${location} (${propertyCount})` : location;
            
            // 상태별 마커 색상 결정
            const statusPriority = { '갠매': 3, '공클': 2, '온하': 1 };
            const statusColors = { '갠매': '#3182F6', '공클': '#10B981', '온하': '#F59E0B' };
            
            const highestStatus = propertiesAtLocation.reduce((prev, current) => {
                const prevPriority = statusPriority[prev.status] || 0;
                const currentPriority = statusPriority[current.status] || 0;
                return currentPriority > prevPriority ? current : prev;
            });
            
            const markerColor = statusColors[highestStatus.status] || '#8B95A1';
            
            // 성능 개선: 마커를 일단 지도에 추가하지 않고 배치에 저장
            const marker = new naver.maps.Marker({
                position: position,
                icon: {
                    content: `
                        <div style="
                            background: ${markerColor};
                            color: white;
                            padding: 8px 12px;
                            border-radius: 20px;
                            font-weight: 600;
                            font-size: 12px;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                            white-space: nowrap;
                            border: 2px solid white;
                        ">
                            ${displayText}
                        </div>
                    `,
                    anchor: new naver.maps.Point(0, 0)
                }
            });

            // InfoWindow 내용 생성 - 성능 개선: 템플릿 문자열 최적화
            const infoContent = createInfoWindowContent(location, propertiesAtLocation);

            const infoWindow = new naver.maps.InfoWindow({
                content: infoContent,
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                borderWidth: 0,
                anchorSize: new naver.maps.Size(0, 0),
                pixelOffset: new naver.maps.Point(0, -10)
            });

            // 마커 클릭 이벤트
            naver.maps.Event.addListener(marker, 'click', function() {
                const isCurrentlyOpen = infoWindow.getMap() !== null;
                infoWindows.forEach(iw => iw.close());
                if (!isCurrentlyOpen) {
                    infoWindow.open(map, marker);
                }
            });

            markerBatch.push(marker);
            markers.push(marker);
            infoWindows.push(infoWindow);
        }
    }
    
    // 성능 개선: 모든 마커를 한 번에 지도에 추가
    markerBatch.forEach(marker => {
        marker.setMap(map);
    });
    
    const isProduction = window.location.hostname !== 'localhost';
    if (!isProduction) console.log(`지도 표시 완료: ${markers.length}개 마커`);
}

// 성능 개선: InfoWindow 내용 생성을 별도 함수로 분리
function createInfoWindowContent(location, properties) {
    const propertyCount = properties.length;
    
    let propertiesHtml = '';
    properties.forEach((property, index) => {
        const statusColorMap = {
            '갠매': { color: '#3182F6', bg: '#EBF8FF' },
            '공클': { color: '#10B981', bg: '#ECFDF5' },
            '온하': { color: '#F59E0B', bg: '#FFFBEB' }
        };
        const statusStyle = statusColorMap[property.status] || { color: '#6B7280', bg: '#F3F4F6' };
        
        propertiesHtml += `
            <div style="
                padding: 16px 20px;
                border-bottom: ${index < propertyCount - 1 ? '1px solid #E5E7EB' : 'none'};
                background: ${index % 2 === 0 ? '#ffffff' : '#fafafa'};
            ">
                <div style="
                    display: inline-block;
                    background: ${statusStyle.bg};
                    color: ${statusStyle.color};
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    margin-bottom: 8px;
                ">
                    ${property.status || '상태없음'}
                </div>
                
                <div style="margin-bottom: 8px;">
                    <div style="font-weight: 600; font-size: 14px; color: #1F2937; margin-bottom: 4px;">
                        등록일: ${property.reg_date || '정보없음'}
                    </div>
                </div>
                
                <div style="background: #F8FAFC; padding: 12px; border-radius: 8px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 12px; color: #6B7280;">보증금</span>
                        <span style="font-weight: 600; font-size: 13px; color: #1F2937;">
                            ${property.deposit || '정보없음'}
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-size: 12px; color: #6B7280;">월세</span>
                        <span style="font-weight: 600; font-size: 13px; color: #3182F6;">
                            ${property.monthly_rent || '정보없음'}
                        </span>
                    </div>
                </div>
                
                ${property.hyperlink ? `
                <a href="${property.hyperlink}" target="_blank" style="
                    display: inline-block;
                    background: linear-gradient(135deg, #3182F6 0%, #1d4ed8 100%);
                    color: white;
                    text-decoration: none;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 4px rgba(49, 130, 246, 0.3);
                ">
                    🏠 매물 상세보기
                </a>
                ` : ''}
            </div>
        `;
    });
    
    return `
        <div style="
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif;
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            border-radius: 16px;
            padding: 0;
            margin: 0;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
            border: 1px solid rgba(255, 255, 255, 0.8);
            overflow: hidden;
            min-width: 280px;
            max-width: 320px;
        ">
            <div style="
                background: linear-gradient(135deg, #3182F6 0%, #1d4ed8 100%);
                color: white;
                padding: 16px 20px;
                margin: 0;
            ">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;">
                        <path d="M21 10C21 17 12 23 12 23S3 17 3 10C3 5.02944 7.02944 1 12 1C16.9706 1 21 5.02944 21 10Z" stroke="currentColor" stroke-width="2"/>
                        <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <div>
                        <div style="font-weight: 700; font-size: 16px; line-height: 1.2;">${location}</div>
                        <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">${propertyCount}개 매물</div>
                    </div>
                </div>
            </div>
            
            <div class="infowindow-content" style="padding: 0; max-height: 400px; overflow-y: auto;">
                ${propertiesHtml}
            </div>
        </div>
        <style>
            .infowindow-content::-webkit-scrollbar {
                width: 8px;
            }
            .infowindow-content::-webkit-scrollbar-track {
                background: #F2F4F6;
                border-radius: 4px;
            }
            .infowindow-content::-webkit-scrollbar-thumb {
                background: linear-gradient(135deg, #3182F6 0%, #1B64DA 100%);
                border-radius: 4px;
                border: 1px solid #E5E8EB;
                transition: all 0.2s ease;
            }
            .infowindow-content::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(135deg, #1B64DA 0%, #1B4ADA 100%);
                box-shadow: 0 2px 4px rgba(49, 130, 246, 0.3);
            }
        </style>
    `;
}

// Event Listeners 등록 함수
function setupEventListeners() {
    console.log('이벤트 리스너 등록 중...');
    
    // 필터 버튼
    const filterButton = document.getElementById('filterButton');
    if (filterButton) {
        filterButton.addEventListener('click', async () => {
            console.log('매물 검색하기 버튼 클릭됨');
            try {
                await loadProperties();
                if (allProperties.length > 0) {
                    console.log('매물 로드 완료 - 필터링 시작');
                    filterProperties();
                } else {
                    console.log('로드된 매물이 없어 필터링을 건너뜁니다.');
                }
            } catch (error) {
                console.error('매물 검색 처리 중 오류:', error);
            }
        });
        console.log('필터 버튼 이벤트 리스너 등록 완료');
    } else {
        console.error('필터 버튼을 찾을 수 없습니다.');
    }

    // 리셋 버튼
    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
        resetButton.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('=== 리셋 버튼 클릭됨 ===');
            
            // 버튼 상태 변경
            resetButton.disabled = true;
            resetButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M1 4V10H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M3.51 15A9 9 0 1 0 6 5L1 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                초기화 중...
            `;
            
            // 잠시 후 초기화 실행
            setTimeout(() => {
                resetFilters();
                
                // 버튼 상태 복원
                resetButton.disabled = false;
                resetButton.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M1 4V10H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M3.51 15A9 9 0 1 0 6 5L1 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    필터 초기화
                `;
            }, 100);
        });
        console.log('리셋 버튼 이벤트 리스너 등록 완료');
    } else {
        console.error('리셋 버튼을 찾을 수 없습니다.');
    }

    // 시트 타입 변경 시에는 기존 매물만 제거하고 안내 메시지 표시
    const sheetTypeRadios = document.querySelectorAll('input[name="sheetType"]');
    if (sheetTypeRadios.length > 0) {
        sheetTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                console.log('시트 타입 변경됨:', radio.value);
                console.log('기존 매물 제거 - 매물 검색하기 버튼을 눌러 새 데이터를 로드하세요.');
                
                // 기존 매물과 마커들 완전히 제거
                clearMap();
                allProperties = [];
                
                // 사용자에게 안내 메시지 표시
                console.info(`매물 유형이 "${radio.value}"로 변경되었습니다. "매물 검색하기" 버튼을 눌러 새로운 매물을 로드해주세요.`);
            });
        });
        console.log(`시트 타입 라디오 버튼 이벤트 리스너 등록 완료 (${sheetTypeRadios.length}개)`);
    } else {
        console.error('시트 타입 라디오 버튼을 찾을 수 없습니다.');
    }

    // Enter 키로 검색 (매물이 이미 로드된 경우에만 필터링)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Enter 키로 검색 실행');
                if (allProperties.length > 0) {
                    console.log('기존 매물에서 필터링 실행');
                    filterProperties();
                } else {
                    console.log('매물이 로드되지 않음 - 매물 검색하기 버튼을 먼저 눌러주세요.');
                    console.warn('매물 검색하기 버튼을 먼저 눌러 매물을 로드해주세요.');
                }
            }
        });
        console.log('검색 입력 필드 이벤트 리스너 등록 완료');
    } else {
        console.error('검색 입력 필드를 찾을 수 없습니다.');
    }

    // 상태 필터 변경 시 필터링 (매물이 로드된 경우에만)
    const statusFilters = document.querySelectorAll('input[name="statusFilter"]');
    if (statusFilters.length > 0) {
        statusFilters.forEach(radio => {
            radio.addEventListener('change', () => {
                console.log('상태 필터 변경됨:', radio.value);
                if (allProperties.length > 0) {
                    console.log('기존 매물에서 필터링 실행');
                    filterProperties();
                } else {
                    console.log('매물이 로드되지 않음 - 상태 필터는 매물 로드 후 적용됩니다.');
                }
            });
        });
        console.log(`상태 필터 라디오 버튼 이벤트 리스너 등록 완료 (${statusFilters.length}개)`);
    }
    
    console.log('모든 이벤트 리스너 등록 완료');
}

// 초기화 함수
async function initializeApp() {
    console.log('=== 웹사이트 초기화 시작 ===');
    
    try {
        // 지도 초기화
        if (!map) {
            console.log('지도 초기화 중...');
            initMap();
            console.log('지도 초기화 완료');
        }
        
        // 이벤트 리스너 설정
        setupEventListeners();
        
        // 초기 상태 메시지
        console.log('🎯 사용 방법:');
        console.log('1. 매물 유형을 선택하세요 (강남월세, 강남전세, 송파월세, 송파전세)');
        console.log('2. 필요시 필터 조건을 설정하세요');
        console.log('3. "매물 검색하기" 버튼을 클릭하여 매물을 로드하세요');
        console.log('=== 초기화 완료 ===');
        
    } catch (error) {
        console.error('앱 초기화 중 오류 발생:', error);
    }
}

// 페이지 로드 시 초기화
window.addEventListener('load', initializeApp);

// DOMContentLoaded 이벤트도 추가하여 더 안정적으로 초기화
document.addEventListener('DOMContentLoaded', initializeApp);
