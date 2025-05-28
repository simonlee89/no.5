let map;
let markers = [];
let infoWindows = [];
let allProperties = [];

function initMap() {
    const mapOptions = {
        center: new naver.maps.LatLng(37.5014, 127.0398),
        zoom: 15,
        mapTypeControl: true
    };
    
    map = new naver.maps.Map('map', mapOptions);
}

async function loadProperties() {
    try {
        const sheetType = document.querySelector('input[name="sheetType"]:checked').value;
        const response = await fetch(`/api/properties/${sheetType}`);
        if (response.ok) {
            allProperties = await response.json();
            filterProperties();
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function parseAmount(str) {
    if (!str) return 0;
    return parseInt(str.replace(/[^0-9]/g, '')) || 0;
}

function resetFilters() {
    // 검색 입력 초기화
    document.getElementById('searchInput').value = '';
    
    // 매물 유형을 첫 번째 옵션으로 초기화
    document.getElementById('강남월세').checked = true;
    
    // 매물 상태를 전체로 초기화
    document.getElementById('all').checked = true;
    
    // 보증금 범위 초기화
    document.getElementById('depositBillionStart').value = '';
    document.getElementById('depositMillionStart').value = '';
    document.getElementById('depositBillionEnd').value = '';
    document.getElementById('depositMillionEnd').value = '';
    
    // 월세 범위 초기화
    document.getElementById('monthlyRentStart').value = '';
    document.getElementById('monthlyRentEnd').value = '';
    
    // 기존 마커들 제거
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    infoWindows = [];
    allProperties = [];
}

function filterProperties() {
    const selectedStatus = document.querySelector('input[name="statusFilter"]:checked').value;
    const searchText = document.getElementById('searchInput').value.toLowerCase();

    // 보증금 범위 계산 (억 단위를 만원으로 변환)
    const depositStartBillion = parseInt(document.getElementById('depositBillionStart').value || 0);
    const depositStartMillion = parseInt(document.getElementById('depositMillionStart').value || 0);
    const depositEndBillion = parseInt(document.getElementById('depositBillionEnd').value || 0);
    const depositEndMillion = parseInt(document.getElementById('depositMillionEnd').value || 0);
    
    // 총 보증금을 만원 단위로 계산
    const totalDepositStart = (depositStartBillion * 10000) + depositStartMillion;
    const totalDepositEnd = (depositEndBillion * 10000) + depositEndMillion;

    // 월세 범위 (만원 단위)
    const monthlyRentStart = parseInt(document.getElementById('monthlyRentStart').value || 0);
    const monthlyRentEnd = parseInt(document.getElementById('monthlyRentEnd').value || 0);

    const filteredProperties = allProperties.filter(property => {
        // 상태 필터
        if (selectedStatus !== 'all' && property.status !== selectedStatus) {
            return false;
        }

        // 지역 검색 필터
        if (searchText && !property.location.toLowerCase().includes(searchText)) {
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

    displayProperties(filteredProperties);
}

function displayProperties(properties) {
    // 기존 마커들 제거
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    infoWindows = [];

    // 주소별로 매물들을 그룹화
    const groupedProperties = {};
    properties.forEach(property => {
        if (!property.location) return;
        
        if (!groupedProperties[property.location]) {
            groupedProperties[property.location] = [];
        }
        groupedProperties[property.location].push(property);
    });

    // 그룹화된 매물들을 지도에 마커로 표시
    Object.keys(groupedProperties).forEach(location => {
        const propertiesAtLocation = groupedProperties[location];
        const address = location + ' 서울특별시';
        
        naver.maps.Service.geocode({
            query: address
        }, function(status, response) {
            if (status === naver.maps.Service.Status.ERROR) return;

            if (response.v2.addresses.length > 0) {
                const item = response.v2.addresses[0];
                const position = new naver.maps.LatLng(item.y, item.x);

                // 매물 개수에 따른 마커 표시 (여러 매물이 있으면 개수 표시)
                const propertyCount = propertiesAtLocation.length;
                const displayText = propertyCount > 1 ? `${location} (${propertyCount})` : location;
                
                // 갠매가 하나라도 있으면 파란색, 아니면 회색
                const hasGanmae = propertiesAtLocation.some(prop => prop.status === '갠매');
                const markerColor = hasGanmae ? '#3182F6' : '#8B95A1';
                
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
                                <h3 style="
                                    margin: 0;
                                    font-size: 16px;
                                    font-weight: 700;
                                    letter-spacing: -0.02em;
                                ">${location}</h3>
                            </div>
                `;
                
                if (propertyCount === 1) {
                    // 매물이 하나인 경우
                    const property = propertiesAtLocation[0];
                    const statusColor = property.status === '갠매' ? '#10b981' : '#6b7280';
                    const statusBg = property.status === '갠매' ? '#ecfdf5' : '#f3f4f6';
                    
                    infoContent += `
                        </div>
                        <!-- 컨텐츠 -->
                        <div style="padding: 20px;">
                            <div style="
                                display: inline-flex;
                                align-items: center;
                                gap: 6px;
                                background: ${statusBg};
                                color: ${statusColor};
                                padding: 6px 12px;
                                border-radius: 20px;
                                font-size: 12px;
                                font-weight: 600;
                                margin-bottom: 16px;
                            ">
                                <div style="
                                    width: 6px;
                                    height: 6px;
                                    background: ${statusColor};
                                    border-radius: 50%;
                                "></div>
                                ${property.status}
                            </div>
                            
                            <div style="space-y: 12px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                                    <div style="
                                        width: 32px;
                                        height: 32px;
                                        background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
                                        border-radius: 8px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                    ">
                                        📅
                                    </div>
                                    <div>
                                        <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">등록일</div>
                                        <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${property.reg_date}</div>
                                    </div>
                                </div>
                                
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                                    <div style="
                                        width: 32px;
                                        height: 32px;
                                        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                                        border-radius: 8px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                    ">
                                        💰
                                    </div>
                                    <div>
                                        <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">보증금</div>
                                        <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${property.deposit}</div>
                                    </div>
                                </div>
                                
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                                    <div style="
                                        width: 32px;
                                        height: 32px;
                                        background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                                        border-radius: 8px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                    ">
                                        🏠
                                    </div>
                                    <div>
                                        <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">월세</div>
                                        <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${property.monthly_rent}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <a href="${property.hyperlink}" target="_blank" style="
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                gap: 8px;
                                background: linear-gradient(135deg, #3182F6 0%, #1d4ed8 100%);
                                color: white;
                                padding: 12px 16px;
                                border-radius: 12px;
                                text-decoration: none;
                                font-weight: 600;
                                font-size: 14px;
                                transition: all 0.2s ease;
                                box-shadow: 0 4px 12px rgba(49, 130, 246, 0.3);
                            " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(49, 130, 246, 0.4)'" 
                               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(49, 130, 246, 0.3)'">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M18 13V6C18 4.89543 17.1046 4 16 4H8C6.89543 4 6 4.89543 6 6V13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                    <path d="M18 13H22L20 20H4L2 13H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M10 4V2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                    <path d="M14 4V2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                                상세 정보 보기
                            </a>
                        </div>
                    `;
                } else {
                    // 매물이 여러 개인 경우
                    infoContent += `
                            <div style="
                                display: inline-flex;
                                align-items: center;
                                gap: 6px;
                                background: rgba(255, 255, 255, 0.9);
                                color: white;
                                padding: 6px 12px;
                                border-radius: 20px;
                                font-size: 12px;
                                font-weight: 600;
                            ">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                    <path d="M3 7V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V7" stroke="currentColor" stroke-width="2"/>
                                    <path d="M3 7H21V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V7Z" stroke="currentColor" stroke-width="2"/>
                                    <path d="M8 11H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                    <path d="M8 15H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                                총 ${propertyCount}개 매물
                            </div>
                        </div>
                        
                        <!-- 매물 리스트 -->
                        <div style="padding: 0 20px 20px 20px;">
                    `;
                    
                    propertiesAtLocation.forEach((property, index) => {
                        const statusColor = property.status === '갠매' ? '#10b981' : '#6b7280';
                        const statusBg = property.status === '갠매' ? '#ecfdf5' : '#f3f4f6';
                        
                        infoContent += `
                            <div style="
                                background: white;
                                border: 1px solid #e2e8f0;
                                border-radius: 12px;
                                padding: 16px;
                                margin-bottom: 12px;
                                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
                            ">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                                    <div style="
                                        background: linear-gradient(135deg, #3182F6 0%, #1d4ed8 100%);
                                        color: white;
                                        padding: 4px 10px;
                                        border-radius: 16px;
                                        font-size: 11px;
                                        font-weight: 600;
                                    ">매물 ${index + 1}</div>
                                    <div style="
                                        display: inline-flex;
                                        align-items: center;
                                        gap: 4px;
                                        background: ${statusBg};
                                        color: ${statusColor};
                                        padding: 4px 8px;
                                        border-radius: 12px;
                                        font-size: 10px;
                                        font-weight: 600;
                                    ">
                                        <div style="
                                            width: 4px;
                                            height: 4px;
                                            background: ${statusColor};
                                            border-radius: 50%;
                                        "></div>
                                        ${property.status}
                                    </div>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
                                    <div>
                                        <div style="color: #64748b; margin-bottom: 2px;">등록일</div>
                                        <div style="font-weight: 600; color: #1e293b;">${property.reg_date}</div>
                                    </div>
                                    <div>
                                        <div style="color: #64748b; margin-bottom: 2px;">보증금</div>
                                        <div style="font-weight: 600; color: #1e293b;">${property.deposit}</div>
                                    </div>
                                    <div style="grid-column: span 2;">
                                        <div style="color: #64748b; margin-bottom: 2px;">월세</div>
                                        <div style="font-weight: 600; color: #1e293b;">${property.monthly_rent}</div>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    
                    // 하이퍼링크 리스트
                    infoContent += `
                            <div style="
                                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                                border: 1px solid #e2e8f0;
                                border-radius: 12px;
                                padding: 16px;
                                margin-top: 8px;
                            ">
                                <div style="
                                    display: flex;
                                    align-items: center;
                                    gap: 8px;
                                    margin-bottom: 12px;
                                    color: #3182F6;
                                    font-weight: 700;
                                    font-size: 13px;
                                ">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                        <path d="M10 13C10.4295 13.5741 10.9774 14.0491 11.6066 14.3929C12.2357 14.7367 12.9315 14.9411 13.6467 14.9923C14.3618 15.0435 15.0796 14.9403 15.7513 14.6897C16.4231 14.4392 17.0331 14.047 17.54 13.54L20.54 10.54C21.4508 9.59695 21.9548 8.33394 21.9434 7.02296C21.932 5.71198 21.4061 4.45791 20.4791 3.53087C19.5521 2.60383 18.298 2.07799 16.987 2.0666C15.676 2.0552 14.413 2.55918 13.47 3.47L11.75 5.18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M14 11C13.5705 10.4259 13.0226 9.95085 12.3934 9.60706C11.7643 9.26327 11.0685 9.05885 10.3533 9.00771C9.63819 8.95656 8.92037 9.05977 8.24864 9.31035C7.57691 9.56093 6.9669 9.95303 6.46 10.46L3.46 13.46C2.54918 14.403 2.04520 15.6661 2.05660 16.977C2.06799 18.288 2.59383 19.5421 3.52087 20.4691C4.44791 21.3962 5.70198 21.922 7.01296 21.9334C8.32394 21.9448 9.58695 21.4408 10.53 20.53L12.24 18.82" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    상세 정보 링크
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 8px;">
                    `;
                    
                    propertiesAtLocation.forEach((property, index) => {
                        infoContent += `
                            <a href="${property.hyperlink}" target="_blank" style="
                                display: flex;
                                align-items: center;
                                gap: 10px;
                                background: white;
                                color: #3182F6;
                                padding: 10px 12px;
                                border-radius: 8px;
                                text-decoration: none;
                                font-weight: 600;
                                font-size: 12px;
                                border: 1px solid #e2e8f0;
                                transition: all 0.2s ease;
                                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                            " onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#3182F6'; this.style.transform='translateY(-1px)'" 
                               onmouseout="this.style.background='white'; this.style.borderColor='#e2e8f0'; this.style.transform='translateY(0)'">
                                <div style="
                                    width: 24px;
                                    height: 24px;
                                    background: linear-gradient(135deg, #3182F6 0%, #1d4ed8 100%);
                                    border-radius: 6px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: white;
                                    font-size: 10px;
                                    font-weight: 700;
                                ">${index + 1}</div>
                                매물 ${index + 1} 상세보기
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="margin-left: auto;">
                                    <path d="M7 17L17 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M7 7H17V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </a>
                        `;
                    });
                    
                    infoContent += `
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                infoContent += `</div>`;

                const infoWindow = new naver.maps.InfoWindow({
                    content: infoContent,
                    maxWidth: 340,
                    backgroundColor: "transparent",
                    borderColor: "transparent",
                    borderWidth: 0,
                    anchorSize: new naver.maps.Size(0, 0),
                    pixelOffset: new naver.maps.Point(0, -10)
                });

                markers.push(marker);
                infoWindows.push(infoWindow);

                naver.maps.Event.addListener(marker, 'click', function() {
                    infoWindows.forEach(iw => iw.close());
                    infoWindow.open(map, marker);
                });
            }
        });
    });

    // 검색 결과가 있으면 지도 중심을 첫 번째 결과로 이동
    if (properties.length > 0 && properties[0].location) {
        const firstAddress = properties[0].location + ' 서울특별시';
        naver.maps.Service.geocode({
            query: firstAddress
        }, function(status, response) {
            if (status !== naver.maps.Service.Status.ERROR && response.v2.addresses.length > 0) {
                const item = response.v2.addresses[0];
                const position = new naver.maps.LatLng(item.y, item.x);
                map.setCenter(position);
                map.setZoom(14);
            }
        });
    }
}

// Event Listeners
document.getElementById('filterButton').addEventListener('click', async () => {
    await loadProperties();
    filterProperties();
});

document.getElementById('resetButton').addEventListener('click', resetFilters);

// 페이지 로드 시 초기화
window.addEventListener('load', async () => {
    initMap();
    // 초기 데이터 로드 제거 - 검색 버튼을 눌렀을 때만 로드
});
