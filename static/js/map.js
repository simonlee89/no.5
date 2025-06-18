let map;
let markers = [];
let infoWindows = [];
let allProperties = [];

// 렌더 토큰: 매물 표시 세션을 구분하여 초기화 시 이전 세션을 무효화
let renderToken = 0;

function initMap() {
    const mapOptions = {
        center: new naver.maps.LatLng(37.5014, 127.0398),
        zoom: 15,
        mapTypeControl: true
    };
    
    map = new naver.maps.Map('map', mapOptions);
}

async function loadProperties() {
    console.log('=== 매물 데이터 로드 시작 ===');
    
    try {
        // 1. 완전한 시스템 초기화 (기존 데이터 모두 삭제)
        console.log('완전한 시스템 초기화 실행...');
        completeReset();
        
        // 잠시 대기하여 초기화가 완전히 완료되도록 함
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const sheetTypeElement = document.querySelector('input[name="sheetType"]:checked');
        if (!sheetTypeElement) {
            console.error('시트 타입이 선택되지 않았습니다.');
            console.warn('매물 유형을 선택해주세요.');
            return;
        }
        
        const sheetType = sheetTypeElement.value;
        console.log('선택된 시트 타입:', sheetType);
        
        // 로딩 상태 표시 (선택사항)
        const filterButton = document.getElementById('filterButton');
        if (filterButton) {
            filterButton.disabled = true;
            filterButton.textContent = '로딩 중...';
        }
        
        console.log('API 요청 시작:', `/api/properties/${sheetType}`);
        const response = await fetch(`/api/properties/${sheetType}`);
        console.log('API 응답 상태:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            
            if (Array.isArray(data)) {
                // 기존 매물 완전히 교체 (누적 방지)
                allProperties = data;
                console.log(`[${sheetType}] 로드된 매물 수:`, allProperties.length);
                
                if (allProperties.length > 0) {
                    console.log(`[${sheetType}] 첫 번째 매물 샘플:`, allProperties[0]);
                    console.log(`[${sheetType}] 매물 데이터 구조 확인:`);
                    const sampleProperty = allProperties[0];
                    console.log('- ID:', sampleProperty.id);
                    console.log('- 위치:', sampleProperty.location);
                    console.log('- 시트타입:', sampleProperty.sheet_type);
                    console.log('- 상태:', sampleProperty.status);
                    console.log('- 보증금:', sampleProperty.deposit);
                    console.log('- 월세:', sampleProperty.monthly_rent);
                    console.log('- 등록일:', sampleProperty.reg_date);
                } else {
                    console.warn('로드된 매물이 없습니다.');
                    console.warn('해당 시트에 매물 데이터가 없습니다.');
                }
            } else {
                console.error('API 응답이 배열이 아닙니다:', data);
                allProperties = [];
            }
        } else {
            const errorText = await response.text();
            console.error('API 응답 오류:', response.status, response.statusText, errorText);
            console.error(`매물 데이터를 불러오는데 실패했습니다. (${response.status})`);
            allProperties = [];
        }
    } catch (error) {
        console.error('매물 로드 중 오류 발생:', error);
        console.error('매물 데이터를 불러오는 중 오류가 발생했습니다.');
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
        
        console.log('=== 매물 데이터 로드 완료 ===');
        
        // 2. 매물 로드 완료 후 자동으로 필터링 및 지도 표시
        if (allProperties.length > 0) {
            console.log('매물 로드 완료 - 자동으로 필터링 및 지도 표시 시작');
            console.log('현재 allProperties 배열 상태:', allProperties.length, '개');
            console.log('첫 번째 매물의 시트 타입:', allProperties[0]?.sheet_type);
            filterProperties();
        } else {
            console.log('로드된 매물이 없어서 필터링을 건너뜁니다.');
        }
    }
}

// 새로운 지오코딩 함수 - 네이버 클라우드 플랫폼 API 사용
async function geocodeAddress(address) {
    try {
        const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
        const data = await response.json();
        
        if (data.status === 'OK') {
            return {
                lat: data.result.lat,
                lng: data.result.lng,
                formatted_address: data.result.formatted_address
            };
        } else {
            console.warn(`Geocoding failed for address: ${address}`);
            return null;
        }
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

function parseAmount(str) {
    if (!str) return 0;
    return parseInt(str.replace(/[^0-9]/g, '')) || 0;
}

function clearMap() {
    console.log('지도에서 기존 마커들 제거 중...');
    
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
        console.log('매물 목록 UI 초기화 완료');
    }
    
    console.log('지도 정리 완료');
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
        
        // 매물 상태를 공클로 초기화
        const gongkeulStatus = document.getElementById('gongkeul');
        const onhaStatus = document.getElementById('onha');
        const ganmaeStatus = document.getElementById('ganmae');
        
        if (gongkeulStatus) {
            gongkeulStatus.checked = true;
            // 이벤트 트리거
            gongkeulStatus.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('매물 상태 "공클"로 초기화 완료');
        } else {
            console.warn('공클 상태 라디오 버튼을 찾을 수 없습니다.');
        }
        
        if (onhaStatus) {
            onhaStatus.checked = false;
            console.log('온하 상태 체크 해제');
        }
        
        if (ganmaeStatus) {
            ganmaeStatus.checked = false;
            console.log('갠매 상태 체크 해제');
        }
        
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
    
    // 1. 검색 필터 초기화
    resetSearchFilters();
    
    // 2. 매물 유형을 첫 번째 옵션으로 초기화
    const defaultSheet = document.getElementById('gangnam-monthly');
    if (defaultSheet) {
        defaultSheet.checked = true;
        console.log('매물 유형을 "강남월세"로 초기화');
    }
    
    // 3. 기존 마커들과 매물 데이터 완전 제거
    clearMap();
    allProperties = [];
    
    // 4. 매물 개수 표시 초기화
    const propertyCount = document.querySelector('.property-count');
    if (propertyCount) {
        propertyCount.textContent = '매물 0개';
    }
    
    // 5. 초기화 후 상태 확인
    setTimeout(() => {
        checkFilterStatus();
    }, 50);
    
    // 6. 사용자에게 피드백 제공
            console.info('모든 필터가 초기화되었습니다. "매물 검색하기" 버튼을 눌러 새로운 매물을 로드해주세요.');
    
    console.log('=== 전체 필터 초기화 완료 ===');
}

function filterProperties() {
    console.log('=== 필터링 시작 ===');
    console.log('전체 매물 수:', allProperties.length);
    
    if (allProperties.length === 0) {
        console.warn('필터링할 매물이 없습니다. 먼저 데이터를 로드해주세요.');
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

    console.log('선택된 상태:', selectedStatus);
    console.log('검색 텍스트:', searchText);
    console.log('선택된 시트 타입:', selectedSheetType);

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

    console.log('필터 조건:', {
        selectedStatus,
        searchText,
        totalDepositStart,
        totalDepositEnd,
        monthlyRentStart,
        monthlyRentEnd
    });

    // 필터링 전 상태별 개수 확인
    const statusCount = {};
    const sheetTypeCount = {};
    allProperties.forEach(prop => {
        statusCount[prop.status] = (statusCount[prop.status] || 0) + 1;
        sheetTypeCount[prop.sheet_type] = (sheetTypeCount[prop.sheet_type] || 0) + 1;
    });
    console.log('매물 상태별 개수:', statusCount);
    console.log('매물 시트타입별 개수:', sheetTypeCount);

    const filteredProperties = allProperties.filter((property, index) => {
        // 시트 타입 필터링 제거 - 백엔드에서 이미 선택된 시트의 데이터만 가져오므로 불필요
        // 각 API 엔드포인트(/api/properties/강남월세, /api/properties/송파월세 등)가 이미 시트별로 구분됨

        // 상태 필터 - 선택된 상태와 매물 상태가 일치하지 않으면 필터링
        if (property.status !== selectedStatus) {
            console.log(`매물 ${index} 필터링됨: 상태 불일치 (선택: ${selectedStatus}, 매물: ${property.status})`);
            return false;
        }

        // 지역 검색 필터
        if (searchText && property.location && !property.location.toLowerCase().includes(searchText)) {
            console.log(`매물 ${index} 필터링됨: 지역 불일치`);
            return false;
        }

        // 보증금 필터
        const propertyDeposit = parseAmount(property.deposit);
        if (totalDepositStart > 0 && propertyDeposit < totalDepositStart) {
            console.log(`매물 ${index} 필터링됨: 보증금 최소값 미달`);
            return false;
        }
        if (totalDepositEnd > 0 && propertyDeposit > totalDepositEnd) {
            console.log(`매물 ${index} 필터링됨: 보증금 최대값 초과`);
            return false;
        }

        // 월세 필터
        const propertyMonthlyRent = parseAmount(property.monthly_rent);
        if (monthlyRentStart > 0 && propertyMonthlyRent < monthlyRentStart) {
            console.log(`매물 ${index} 필터링됨: 월세 최소값 미달`);
            return false;
        }
        if (monthlyRentEnd > 0 && propertyMonthlyRent > monthlyRentEnd) {
            console.log(`매물 ${index} 필터링됨: 월세 최대값 초과`);
            return false;
        }

        console.log(`매물 ${index} 통과`);
        return true;
    });

    // 필터링 후 상태별 개수 확인
    const filteredStatusCount = {};
    filteredProperties.forEach(prop => {
        filteredStatusCount[prop.status] = (filteredStatusCount[prop.status] || 0) + 1;
    });
    
    console.log('필터링된 매물 수:', filteredProperties.length);
    console.log('필터링 후 상태별 개수:', filteredStatusCount);
    console.log('=== 필터링 완료 ===');
    
    displayProperties(filteredProperties);
}

async function displayProperties(properties) {
    console.log('=== 매물 표시 시작 ===');
    console.log('표시할 매물 수:', properties.length, '개');
    
    // 기존 마커들 제거
    clearMap();

    const myToken = renderToken; // clearMap으로 증가된 후 토큰 복사

    if (properties.length === 0) {
        console.log('표시할 매물이 없습니다. 목록을 비웁니다.');
        // 매물 목록 UI도 초기화
        const propertyList = document.getElementById('propertyList');
        if (propertyList) {
            propertyList.innerHTML = '<div class="empty-list">조건에 맞는 매물이 없습니다.</div>';
        }
        return;
    }
    
    console.log('첫 번째 매물 정보:', properties[0]);
    
    // 주소별로 매물들을 그룹화
    const groupedProperties = {};
    properties.forEach(property => {
        if (!property.location) {
            console.warn('위치 정보가 없는 매물:', property.id);
            return;
        }
        
        const locationKey = property.location.trim();
        if (!groupedProperties[locationKey]) {
            groupedProperties[locationKey] = [];
        }
        groupedProperties[locationKey].push(property);
    });
    
    console.log('주소별 그룹화된 매물 수:', Object.keys(groupedProperties).length, '개');
    if (Object.keys(groupedProperties).length > 0) {
        console.log('그룹화된 주소 목록:', Object.keys(groupedProperties));
    }

    // 그룹화된 매물들을 지도에 마커로 표시
    for (const location of Object.keys(groupedProperties)) {
        // 초기화되어 토큰이 달라지면 중단
        if (myToken !== renderToken) {
            console.warn('[Display] 초기화 감지, 렌더링 중단');
            return;
        }
        const propertiesAtLocation = groupedProperties[location];
        
        console.log(`[Geocoding] 주소 처리 시작: "${location}"`);
        
        const geocodeResult = await geocodeAddress(location);
        
        if (geocodeResult && geocodeResult.lat && geocodeResult.lng) {
            console.log(`[Geocoding] 성공: "${location}" ->`, geocodeResult);
            const position = new naver.maps.LatLng(geocodeResult.lat, geocodeResult.lng);
            
            // 매물 개수에 따른 마커 표시 (여러 매물이 있으면 개수 표시)
            const propertyCount = propertiesAtLocation.length;
            const displayText = propertyCount > 1 ? `${location} (${propertyCount})` : location;
            
            // 상태별 마커 색상 결정: 갠매(파란색), 공클(초록색), 온하(주황색)
            const statusPriority = { '갠매': 3, '공클': 2, '온하': 1 };
            const statusColors = { '갠매': '#3182F6', '공클': '#10B981', '온하': '#F59E0B' };
            
            // 가장 우선순위가 높은 상태 찾기
            const highestStatus = propertiesAtLocation.reduce((prev, current) => {
                const prevPriority = statusPriority[prev.status] || 0;
                const currentPriority = statusPriority[current.status] || 0;
                return currentPriority > prevPriority ? current : prev;
            });
            
            const markerColor = statusColors[highestStatus.status] || '#8B95A1';
            
            console.log(`[Marker] 생성 시작: 위치=${location}, 매물 수=${propertyCount}, 대표상태=${highestStatus.status}, 색상=${markerColor}`);
            
            const marker = new naver.maps.Marker({
                map: map,
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

            // InfoWindow 내용 생성 - 같은 주소의 모든 매물 정보 포함
            let infoContent = `
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
                    <!-- 헤더 -->
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
                    
                    <!-- 매물 목록 -->
                    <div class="infowindow-content" style="padding: 0; max-height: 400px; overflow-y: auto;">
            `;

            // 각 매물 정보 추가
            propertiesAtLocation.forEach((property, index) => {
                const statusColorMap = {
                    '갠매': { color: '#3182F6', bg: '#EBF8FF' },
                    '공클': { color: '#10B981', bg: '#ECFDF5' },
                    '온하': { color: '#F59E0B', bg: '#FFFBEB' }
                };
                const statusStyle = statusColorMap[property.status] || { color: '#6B7280', bg: '#F3F4F6' };
                const statusColor = statusStyle.color;
                const statusBg = statusStyle.bg;
                
                infoContent += `
                    <div style="
                        padding: 16px 20px;
                        border-bottom: ${index < propertiesAtLocation.length - 1 ? '1px solid #E5E7EB' : 'none'};
                        background: ${index % 2 === 0 ? '#ffffff' : '#fafafa'};
                    ">
                        <!-- 상태 배지 -->
                        <div style="
                            display: inline-block;
                            background: ${statusBg};
                            color: ${statusColor};
                            padding: 4px 8px;
                            border-radius: 12px;
                            font-size: 11px;
                            font-weight: 600;
                            margin-bottom: 8px;
                        ">
                            ${property.status || '상태없음'}
                        </div>
                        
                        <!-- 매물 정보 -->
                        <div style="margin-bottom: 8px;">
                            <div style="font-weight: 600; font-size: 14px; color: #1F2937; margin-bottom: 4px;">
                                등록일: ${property.reg_date || '정보없음'}
                            </div>
                        </div>
                        
                        <!-- 가격 정보 -->
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
                        
                        <!-- 링크 버튼 -->
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

            infoContent += `
                    </div>
                </div>
                <style>
                    /* InfoWindow 내부 스크롤바 스타일 */
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
                // 다른 InfoWindow들 닫기
                infoWindows.forEach(iw => iw.close());
                
                // 현재 InfoWindow 열기
                infoWindow.open(map, marker);
            });

            markers.push(marker);
            infoWindows.push(infoWindow);
        } else {
            console.warn(`[Geocoding] 실패 또는 유효하지 않은 결과: "${location}"`, geocodeResult);
        }
    }
    
    console.log('지도에 추가된 마커 수:', markers.length, '개');
    console.log('=== 매물 표시 완료 ===');
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
