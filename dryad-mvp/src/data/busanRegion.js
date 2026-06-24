// 부산광역시 16개 구·군 지역 설정 — 단일 소스(single source of truth).
//
// 경기 31개 시군 → 부산 16개 구·군(15 자치구 + 기장군) 전환의 중심 설정.
// ETL(scripts/etl.mjs), 외부 API 수집기(scripts/fetchExternal.mjs), PNU 매핑
// (src/data/busanPnu.js), UI 컴포넌트가 모두 이 파일에서 지역 정보를 가져온다.
//
// 다른 지역으로 확산할 때는 이 파일의 DISTRICTS 테이블과 REGION 상수만 교체하면 된다.

export const REGION = {
  sido: '부산광역시',
  sidoShort: '부산',
  idPrefix: 'BS',          // 사이트 ID 접두사 (구 'GG')
  unitLabel: '구·군',       // UI 라벨 (구 '시군')
  unitCount: 16,
  // 부산 전역을 포괄하는 지도 중심 좌표 (부산시청·서면 인근)
  center: [35.16, 129.07],
  defaultZoom: 11,
  // 부산 대략 경계 bbox — 원본 데이터에 좌표가 잘못 입력된 사이트(타시도 범위 밖)는
  // 구·군 중심으로 자동 보정. lat 34.9~35.45 (가덕도 남단 ~ 기장 북단),
  // lng 128.7~129.32 (강서구 서단 ~ 기장군 동단)
  bbox: { latMin: 34.9, latMax: 35.45, lngMin: 128.7, lngMax: 129.32 }
}

// 부산 16개 구·군 마스터 테이블
//   name        : 구·군명
//   sigungu     : 행정표준 시군구코드 5자리 (부산 26xxx)
//   lat,lng     : 구청·군청 소재지 좌표 (시연용 중심 근사값, _coord_approx 보정에 사용)
//   bjdong      : 대표 법정동코드 10자리 (토양도 PNU 샘플링용 — 구청 소재 법정동 근사)
//   forestBjdong: 산지 토양 샘플 fallback 법정동 (도심 구 토양도 보강용, 선택)
//
// ⚠️ bjdong은 시군구코드 + 대표 법정동(첫 동 패턴 '10100') 기반 *초기 매핑*이며,
//    토양도 API 응답에 따라 본번을 변화시켜 재조회한다(fetchSoilForCity). 정밀 토양은
//    VWorld 사이트별 역지오코딩 PNU(fetchSitePnu)가 우선 적용된다.
export const DISTRICTS = [
  { name: '중구',     sigungu: '26110', lat: 35.1064, lng: 129.0323, bjdong: '2611010100' },
  { name: '서구',     sigungu: '26140', lat: 35.0979, lng: 129.0242, bjdong: '2614010100' },
  { name: '동구',     sigungu: '26170', lat: 35.1293, lng: 129.0455, bjdong: '2617010100' },
  { name: '영도구',   sigungu: '26200', lat: 35.0911, lng: 129.0679, bjdong: '2620010100' },
  { name: '부산진구', sigungu: '26230', lat: 35.1631, lng: 129.0531, bjdong: '2623010100' },
  { name: '동래구',   sigungu: '26260', lat: 35.2049, lng: 129.0837, bjdong: '2626010100', forestBjdong: ['2626010800'] },
  { name: '남구',     sigungu: '26290', lat: 35.1364, lng: 129.0843, bjdong: '2629010100' },
  { name: '북구',     sigungu: '26320', lat: 35.1973, lng: 128.9902, bjdong: '2632010100', forestBjdong: ['2632010600'] },
  { name: '해운대구', sigungu: '26350', lat: 35.1631, lng: 129.1639, bjdong: '2635010100', forestBjdong: ['2635010300'] },
  { name: '사하구',   sigungu: '26380', lat: 35.1046, lng: 128.9747, bjdong: '2638010100' },
  { name: '금정구',   sigungu: '26410', lat: 35.2429, lng: 129.0921, bjdong: '2641010100', forestBjdong: ['2641011000'] },
  { name: '강서구',   sigungu: '26440', lat: 35.2122, lng: 128.9806, bjdong: '2644010100', forestBjdong: ['2644010700'] },
  { name: '연제구',   sigungu: '26470', lat: 35.1763, lng: 129.0797, bjdong: '2647010100' },
  { name: '수영구',   sigungu: '26500', lat: 35.1455, lng: 129.1132, bjdong: '2650010100' },
  { name: '사상구',   sigungu: '26530', lat: 35.1525, lng: 128.9908, bjdong: '2653010100' },
  { name: '기장군',   sigungu: '26710', lat: 35.2445, lng: 129.2222, bjdong: '2671025000', forestBjdong: ['2671025300', '2671031000'] }
]

export const DISTRICT_NAMES = DISTRICTS.map((d) => d.name)

// 구·군명 → 중심 좌표 [lat, lng]
export const CITY_CENTROIDS = Object.fromEntries(
  DISTRICTS.map((d) => [d.name, [d.lat, d.lng]])
)

// ── 기상청 단기예보 격자(nx, ny) — 위경도 → 격자 변환(LCC DFS)으로 자동 산출 ──
// 기상청 표준 Lambert Conformal Conic 변환식. 시청 좌표를 그대로 격자에 매핑하므로
// 별도 격자표 관리가 불필요하다.
export function latLngToKmaGrid(lat, lng) {
  const RE = 6371.00877, GRID = 5.0
  const SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136
  const DEGRAD = Math.PI / 180
  const re = RE / GRID
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD
  const olon = OLON * DEGRAD, olat = OLAT * DEGRAD
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = (re * sf) / Math.pow(ro, sn)
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5)
  ra = (re * sf) / Math.pow(ra, sn)
  let theta = lng * DEGRAD - olon
  if (theta > Math.PI) theta -= 2 * Math.PI
  if (theta < -Math.PI) theta += 2 * Math.PI
  theta *= sn
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5)
  }
}

// 구·군명 → 기상청 격자
export const KMA_GRIDS = Object.fromEntries(
  DISTRICTS.map((d) => [d.name, latLngToKmaGrid(d.lat, d.lng)])
)

// 공공데이터포털 제공기관코드 → 구·군 매핑.
// 부산 도시공원/가로수 표준데이터에는 시군구명이 채워져 있어 코드 fallback이
// 거의 필요 없으므로 비워 둔다. (필요 시 행정표준 자치단체코드로 채울 수 있음)
export const AGENCY_CODE_TO_CITY = {}

// 좌표가 부산 경계 안인지 검사
export function inRegionBbox(lat, lng) {
  if (!isFinite(lat) || !isFinite(lng)) return false
  const b = REGION.bbox
  return lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax
}

// 구·군명 정규화: "부산광역시 해운대구", "해운대구", "해운대", "부산 부산진", "북" → 정식 구·군명.
// 긴 이름부터 부분일치 검사하여 짧은 이름(중구/서구 등) 오매칭을 방지한다.
// ⚠️ "부산" 접두사를 무턱대고 제거하면 "부산진구"가 "진구"로 깨지므로, 접두사 제거 없이
//    풀네임 → 약어(접미사 구/군 제거) 순으로 매칭한다.
const _byLenDesc = [...DISTRICT_NAMES].sort((a, b) => b.length - a.length)
const _bareMap = DISTRICTS.map((d) => ({
  name: d.name,
  bare: d.name.replace(/(구|군)$/, '')
})).sort((a, b) => b.bare.length - a.bare.length)

export function normalizeCity(raw) {
  if (!raw) return null
  const s = String(raw).replace(/\s+/g, '').trim()
  if (!s || s === '부산' || s === '부산광역시') return null
  // 1) 정식 구·군명 정확/부분 일치 (긴 이름 우선 — "부산해운대구"→해운대구)
  for (const name of _byLenDesc) {
    if (s === name || s.includes(name)) return name
  }
  // 2) 접미사(구/군) 없는 약어 (해운대·부산진·기장 등). 2글자 이상은 부분일치,
  //    1글자(중·서·동·남·북)는 오매칭 방지를 위해 정확일치만 허용.
  for (const { name, bare } of _bareMap) {
    if (bare.length >= 2) {
      if (s === bare || s.includes(bare)) return name
    } else if (s === bare) {
      return name
    }
  }
  return null
}

// 사이트 ID 접두사 (예: 'BS-해운대-PARK-0001')
export function siteIdPrefix(city) {
  return `${REGION.idPrefix}-${city.replace(/(구|군)$/, '')}`
}
