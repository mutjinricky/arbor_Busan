// 부산 공공데이터 ETL
// data/source-csv/ · data/raw/ 폴더의 CSV를 읽어 public/sites_real.json 으로 변환한다.
//
// 지원 데이터셋 (컬럼명으로 자동 판별):
//   - 100대 소나무숲   : 시군 / 읍면 / 리 / 산번지 / 면적 / 주요수목
//   - 가로수길표준     : 가로수길명 / 시군구명 / 위도(or X좌표) / 경도(or Y좌표) / 주요수종 / 길이 등
//   - 도시공원표준     : 공원명 / 소재지지번주소 / 위도 / 경도 / 공원유형 / 공원면적 등
//
// 좌표가 없는 경우 시군 중심 좌표 + 작은 jitter 로 근사한다 (시연용).
// 실제 운영에서는 VWorld/Kakao 지오코딩 API 연결 권장.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import iconv from 'iconv-lite'
import { parse } from 'csv-parse/sync'
import proj4 from 'proj4'
import { vegetationScoreFromSpecies } from '../src/lib/speciesMatrix.js'
import {
  REGION,
  CITY_CENTROIDS,
  AGENCY_CODE_TO_CITY,
  normalizeCity,
  inRegionBbox,
  siteIdPrefix
} from '../src/data/busanRegion.js'

// 한국 2000 중부원점 TM (산림청 가로수 현황 등 EPSG:5186 좌표계용)
proj4.defs(
  'EPSG:5186',
  '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs'
)

const TODAY = new Date('2026-05-22')

// 외부 API에서 받아온 실데이터 로드 (있으면)
function loadExternal(name) {
  const p = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'external',
    name + '.json'
  )
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (e) {
    console.warn(`[!] ${name}.json 파싱 실패:`, e.message)
    return null
  }
}

const EXTERNAL = {
  fire_risk: loadExternal('fire_risk_sigungu'),
  weather: loadExternal('weather_sigungu'),
  soil: loadExternal('soil_sigungu'),
  fire_history: loadExternal('fire_history_sigungu')
}

// 사이트별 정밀 PNU·토양 캐시 (VWorld·사이트별 농진청 API 결과)
// fetchSitePnu.mjs / fetchSiteSoil.mjs로 채워짐. 있으면 구·군 단위보다 우선 적용.
const SITE_PNU_CACHE = loadExternal('site_pnu_cache') || {}
const SITE_SOIL_CACHE = loadExternal('site_soil_cache') || {}

// 부산 기후/환경 보조데이터 (사이트별 매칭 결과, 선택). 지원 필드:
//   - flood_risk_idx (홍수위험), emd_park_score (공원 종합점수)
//   - landslide_grade1 / landslide_weak (산사태), soil_cbn_vul (토양 취약성)
//   - tree_cvg (수관 폐쇄율 0~1), tree_avg_hgt, forest_cbn_abpvl (산림 탄소흡수량)
// 경기기후플랫폼에 대응하는 부산 통합 플랫폼이 없어, 부산/전국 대체 레이어를
// 사이트별로 매칭한 산출물(buildBusanClimateSiteCache 등)이 있으면 주입한다.
const GG_CLIMATE = loadExternal('busan_climate_by_site')?.by_site || {}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const RAW_DIR = path.join(ROOT, 'data', 'raw')
const SOURCE_DIR = path.join(ROOT, 'data', 'source-csv')
// 사이트 데이터는 public/에 두어 빌드 시 정적 자산으로 분리 (dynamic fetch).
// 5.1MB JS bundle → 분리하여 초기 로딩 속도 향상.
const OUT_FILE = path.join(ROOT, 'public', 'sites_real.json')
// 빈 스텁만 src/data/에 두어 ETL 미실행 환경에서도 import 깨지지 않게 함.
const STUB_FILE = path.join(ROOT, 'src', 'data', 'sites_real.json')

// 경계 검사·기관코드 매핑·중심 좌표·구군명 정규화는 모두 busanRegion.js에서 import.
// (inRegionBbox, AGENCY_CODE_TO_CITY, CITY_CENTROIDS, normalizeCity)

function jitter(seed) {
  // 결정론적 작은 좌표 흔들림 (마커가 정확히 겹치지 않도록)
  const x = Math.sin(hash(seed)) * 10000
  return (x - Math.floor(x)) * 0.06 - 0.03 // ±0.03도 (약 ±3km)
}

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

function readCsvAuto(filePath) {
  const buf = fs.readFileSync(filePath)
  // EUC-KR이면 BOM 없이 시작하고 한글이 깨짐. UTF-8 시도 후 실패하면 EUC-KR
  let text = buf.toString('utf8')
  if (text.includes('�') || /[\x00-\x08\x0E-\x1F]/.test(text.slice(0, 200))) {
    text = iconv.decode(buf, 'euc-kr')
  }
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
    bom: true
  })
  return records
}

function pickField(row, candidates) {
  for (const c of candidates) {
    if (row[c] != null && String(row[c]).trim() !== '') return String(row[c]).trim()
  }
  // 공백/구분자 무시한 부분일치
  const norm = (s) => s.replace(/[\s_·.\-()]/g, '').toLowerCase()
  const keys = Object.keys(row)
  for (const c of candidates) {
    const nc = norm(c)
    const k = keys.find((k) => norm(k).includes(nc))
    if (k && row[k] != null && String(row[k]).trim() !== '') {
      return String(row[k]).trim()
    }
  }
  return null
}

function detectSchema(headers) {
  const h = headers.map((x) => x.replace(/\s+/g, ''))
  const has = (k) => h.some((x) => x.includes(k))
  // 산림청 가로수 현황 (단목): 시군구명 + 도로구간명 + 지역X좌표 + 좌표계코드 + 수목흉고직경
  // → 도로구간별 집계로 가로수길 사이트 생성
  if (
    has('도로구간') &&
    has('지역X좌표') &&
    (has('좌표계') || has('수목흉고'))
  ) {
    return 'tree_inventory'
  }
  // 도시숲표준지 (파주): 표준조사구번호 + 수목활력도등급 + 위도/경도
  if (has('표준조사구번호') || (has('표준지명') && has('수목활력도'))) return 'urban_forest_plot'
  // 노선별 수종 피벗 (양평): 읍면/노선명 + 다수 수종 컬럼 + 연장
  if (has('노선명') && has('연장') && (has('벚나무') || has('은행나무') || has('느티나무'))) return 'route_species_pivot'
  // 노선별 가로수본수 (안산): 시군명 + 노선명 + 수종 + 가로수본수
  if (has('노선명') && has('수종') && (has('가로수본수') || has('본수'))) return 'route_aggregated'
  // 단목 + 수종코드 + EPSG:5186 좌표 (의왕)
  if (has('수종코드') && has('식재일자') && has('위도') && has('경도')) return 'point_trees_coded'
  // 단목 + 한글수종명 + 위경도 (광명)
  if (has('가로수종류') && has('위도') && has('경도') && !has('도로구간')) return 'point_trees_simple'
  // 소나무숲: 시군 + 읍면 + 리(동) + 번지 + 면적 + 주요(수목|명칭) 조합
  if (
    has('시군') &&
    has('읍면') &&
    (has('번지') || has('산번지')) &&
    (has('주요수목') || has('주요명칭') || has('대상면적'))
  ) {
    return 'pine_forest'
  }
  if (has('가로수') || (has('수종') && (has('시점') || has('종점')))) return 'street_tree'
  if (has('공원명') || has('공원구분')) return 'park'
  return 'unknown'
}

// 파일명에서 부산 구·군 추출. "부산광역시 강서구 가로수 ..." 또는 "부산광역시_강서구_..."
function cityFromFilename(file) {
  if (!file) return null
  const m = file.match(/부산(?:광역시)?[\s_]*([가-힣]+(?:구|군))/)
  if (m && CITY_CENTROIDS[m[1]]) return m[1]
  return null
}

function parseEstablishedYears(dateStr) {
  if (!dateStr) return null
  const m = String(dateStr).match(/^(\d{4})/)
  if (!m) return null
  const y = Number(m[1])
  if (y < 1900 || y > 2100) return null
  return TODAY.getFullYear() - y
}

function parsePineForest(row, idx) {
  const cityRaw = pickField(row, ['시군', '시군구', '시군구명'])
  const city = normalizeCity(cityRaw)
  if (!city) return null
  const eupmyeon = pickField(row, ['읍 면', '읍면', '읍면동']) || ''
  const ri = pickField(row, ['리 동', '리동', '리']) || ''
  const lot = pickField(row, ['번 지', '산번지', '번지', '지번']) || ''
  const areaHa = Number(
    pickField(row, [
      '대상면적(헥타르)',
      '대상면적',
      '면적(ha)',
      '면적(헥타)',
      '면적'
    ]) || 0
  )
  const species = pickField(row, ['주요수목', '수종', '주요수종']) || '소나무'
  const remark = pickField(row, ['주요명칭', '명칭', '비고', '기타']) || ''

  const center = CITY_CENTROIDS[city]
  const seedKey = `pf-${city}-${eupmyeon}-${ri}-${lot}-${idx}`
  const lat = center[0] + jitter(seedKey + 'lat')
  const lng = center[1] + jitter(seedKey + 'lng')

  const name = remark
    ? `${remark} (${city} ${eupmyeon}${ri})`
    : `${city} ${eupmyeon} ${ri} 소나무숲`

  return {
    id: `${siteIdPrefix(city)}-PINE-${String(idx).padStart(4, '0')}`,
    name,
    type: 'pine_forest',
    city,
    address: `${REGION.sido} ${city} ${eupmyeon} ${ri} ${lot}`.trim(),
    latitude: round(lat, 6),
    longitude: round(lng, 6),
    area_m2: areaHa > 0 ? Math.round(areaHa * 10000) : null,
    length_m: null,
    main_species: species,
    managing_agency: `${city} 산림녹지과`,
    source_dataset: '산림청 아름다운 100대 소나무숲 정보 (부산)',
    source_url: 'https://www.data.go.kr/data/15032216/fileData.do',
    _coord_approx: true,
    _established_years: null // 소나무숲은 등재일 정보 없음
  }
}

function parseStreetTree(row, idx) {
  const name = pickField(row, ['가로수길명', '가로수길', '도로명', '명칭'])
  const cityRaw = pickField(row, [
    '시군구명',
    '시도시군구명',
    '시군구',
    '관리시군구',
    '관리기관명'
  ])
  let city = normalizeCity(cityRaw) || normalizeCity(pickField(row, ['소재지', '주소']))
  if (!city) {
    const code = pickField(row, ['제공기관코드'])
    if (code && AGENCY_CODE_TO_CITY[code]) city = AGENCY_CODE_TO_CITY[code]
  }
  if (!city || !name) return null

  // 경기 가로수길표준: 시작·종료 좌표가 따로 있으므로 평균(중점) 사용
  const startLat = Number(pickField(row, ['가로수길시작위도']))
  const startLng = Number(pickField(row, ['가로수길시작경도']))
  const endLat = Number(pickField(row, ['가로수길종료위도']))
  const endLng = Number(pickField(row, ['가로수길종료경도']))
  let lat = Number(pickField(row, ['위도', 'Y좌표', 'Y_COORD', 'lat']))
  let lng = Number(pickField(row, ['경도', 'X좌표', 'X_COORD', 'lng', 'lon']))
  let approx = false
  if (isFinite(startLat) && isFinite(startLng) && startLat !== 0 && startLng !== 0) {
    lat = isFinite(endLat) && endLat !== 0 ? (startLat + endLat) / 2 : startLat
    lng = isFinite(endLng) && endLng !== 0 ? (startLng + endLng) / 2 : startLng
  } else if (!isFinite(lat) || !isFinite(lng) || lat === 0 || lng === 0) {
    const c = CITY_CENTROIDS[city]
    const seedKey = `st-${city}-${name}-${idx}`
    lat = c[0] + jitter(seedKey + 'lat')
    lng = c[1] + jitter(seedKey + 'lng')
    approx = true
  }
  // 좌표가 경기 경계 밖이면 원본 CSV 입력 오류 — 시군 중심으로 보정
  if (!inRegionBbox(lat, lng)) {
    const c = CITY_CENTROIDS[city]
    if (c) {
      const seedKey = `st-${city}-${name}-${idx}-fix`
      lat = c[0] + jitter(seedKey + 'lat')
      lng = c[1] + jitter(seedKey + 'lng')
      approx = true
    }
  }
  const species = pickField(row, ['가로수종류', '주요수종', '수종']) || '-'
  // 가로수길길이 단위 보정 — 표준데이터는 시군마다 km·m 혼재 입력
  //   100 미만 → km로 가정 (×1000 → m)
  //   100 이상 → 이미 m로 입력된 것으로 가정
  //   결과가 100km(100,000m) 초과면 비정상으로 간주하여 null 처리
  const rawLen = Number(pickField(row, ['가로수길길이']) || 0)
  const lengthM = Number(pickField(row, ['연장(m)', '구간연장']) || 0)
  let length = 0
  if (lengthM > 0) length = lengthM
  else if (rawLen > 0) length = rawLen < 100 ? Math.round(rawLen * 1000) : Math.round(rawLen)
  if (length > 100000) length = 0 // 100km 초과는 비정상
  const agency = pickField(row, ['관리기관명', '관리부서', '담당부서']) || `${city} 산림공원과`
  const address = pickField(row, ['소재지지번주소', '소재지도로명주소', '주소']) || ''
  const plantedYears = parseEstablishedYears(pickField(row, ['식재년도']))

  return {
    id: `${siteIdPrefix(city)}-STREET-${String(idx).padStart(4, '0')}`,
    name,
    type: 'street_tree',
    city,
    address: address || `${REGION.sido} ${city}`,
    latitude: round(lat, 6),
    longitude: round(lng, 6),
    area_m2: null,
    length_m: length > 0 ? length : null,
    main_species: species,
    managing_agency: agency,
    source_dataset: '부산광역시 가로수길정보표준데이터',
    source_url: 'https://www.data.go.kr/',
    _coord_approx: approx,
    _established_years: plantedYears
  }
}

function parsePark(row, idx) {
  const name = pickField(row, ['공원명', '명칭'])
  const cityRaw =
    pickField(row, ['관리시군구', '시군구', '시군구명']) ||
    normalizeCity(pickField(row, ['소재지지번주소', '소재지도로명주소', '주소']))
  const city = normalizeCity(cityRaw)
  if (!city || !name) return null

  let lat = Number(pickField(row, ['위도', 'Y좌표', 'lat']))
  let lng = Number(pickField(row, ['경도', 'X좌표', 'lng']))
  let coordApprox = false
  if (!isFinite(lat) || !isFinite(lng) || lat === 0) {
    const c = CITY_CENTROIDS[city]
    const seedKey = `pk-${city}-${name}-${idx}`
    lat = c[0] + jitter(seedKey + 'lat')
    lng = c[1] + jitter(seedKey + 'lng')
    coordApprox = true
  }
  // 좌표가 경기 경계 밖이면 원본 CSV 입력 오류 — 시군 중심으로 보정
  if (!inRegionBbox(lat, lng)) {
    const c = CITY_CENTROIDS[city]
    if (c) {
      const seedKey = `pk-${city}-${name}-${idx}-fix`
      lat = c[0] + jitter(seedKey + 'lat')
      lng = c[1] + jitter(seedKey + 'lng')
      coordApprox = true
    }
  }
  const area = Number(pickField(row, ['공원면적', '면적']) || 0)
  const ptype = pickField(row, ['공원구분', '공원유형']) || ''
  const agency = pickField(row, ['관리기관명', '관리부서']) || `${city} 공원녹지과`
  const address = pickField(row, ['소재지지번주소', '소재지도로명주소', '주소']) || ''
  const species = pickField(row, ['주요수종', '대표수종']) || '혼효림'
  const establishedYears = parseEstablishedYears(pickField(row, ['지정고시일']))

  return {
    id: `${siteIdPrefix(city)}-PARK-${String(idx).padStart(4, '0')}`,
    name: ptype ? `${name} (${ptype})` : name,
    type: 'park',
    city,
    address: address || `${REGION.sido} ${city}`,
    latitude: round(lat, 6),
    longitude: round(lng, 6),
    area_m2: area > 0 ? area : null,
    length_m: null,
    main_species: species,
    managing_agency: agency,
    source_dataset: '전국도시공원정보표준데이터',
    source_url: 'https://www.data.go.kr/data/15012890/standard.do',
    _coord_approx: coordApprox,
    _established_years: establishedYears
  }
}

function round(n, p) {
  const k = Math.pow(10, p)
  return Math.round(n * k) / k
}

// 산림청 가로수 현황 (단목 1M+ 행) → 도로구간별 가로수길 사이트로 집계.
// 좌표계 EPSG:5186 → WGS84 변환. 부산만 필터.
function aggregateTreeInventory(rows, startCounter) {
  const groups = new Map() // key: city|segment → { ...accumulators }
  for (const row of rows) {
    const sido = pickField(row, ['시도', '시도명', '시군구명'])
    if (!sido || !sido.includes(REGION.sidoShort)) continue
    // 시군구명 형식: "부산광역시 강서구" / "부산광역시 기장군"
    const cityRaw = sido.replace(/^부산(광역시)?\s*/, '').trim()
    const city = normalizeCity(cityRaw)
    if (!city) continue
    const segment = pickField(row, ['도로구간명'])
    if (!segment) continue
    const x = Number(pickField(row, ['지역X좌표', 'X좌표']))
    const y = Number(pickField(row, ['지역Y좌표', 'Y좌표']))
    if (!isFinite(x) || !isFinite(y)) continue
    const species = pickField(row, ['수종명', '수종']) || '미상'
    const dbh = Number(pickField(row, ['수목흉고직경']) || 0)
    const startPt = pickField(row, ['구간시점명']) || ''
    const endPt = pickField(row, ['구간종점명']) || ''

    const key = `${city}|${segment}`
    let g = groups.get(key)
    if (!g) {
      g = {
        city,
        segment,
        xs: [],
        ys: [],
        speciesCount: new Map(),
        dbhSum: 0,
        dbhCount: 0,
        startPt: startPt,
        endPt: endPt
      }
      groups.set(key, g)
    }
    g.xs.push(x)
    g.ys.push(y)
    g.speciesCount.set(species, (g.speciesCount.get(species) || 0) + 1)
    if (dbh > 0) {
      g.dbhSum += dbh
      g.dbhCount++
    }
    if (!g.endPt && endPt) g.endPt = endPt
  }

  const sites = []
  let idx = startCounter
  for (const g of groups.values()) {
    const cx = g.xs.reduce((a, b) => a + b, 0) / g.xs.length
    const cy = g.ys.reduce((a, b) => a + b, 0) / g.ys.length
    let lng, lat
    try {
      ;[lng, lat] = proj4('EPSG:5186', 'EPSG:4326', [cx, cy])
    } catch (e) {
      continue
    }
    if (!isFinite(lat) || !isFinite(lng)) continue
    if (!inRegionBbox(lat, lng)) continue

    // 우점 수종 (최다 빈도)
    let topSpecies = '미상'
    let topCount = 0
    for (const [s, c] of g.speciesCount) {
      if (c > topCount) {
        topCount = c
        topSpecies = s
      }
    }
    const totalTrees = g.xs.length
    const speciesEntries = [...g.speciesCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s, c]) => `${s}(${c})`)
      .join(', ')
    const meanDbh = g.dbhCount > 0 ? round(g.dbhSum / g.dbhCount, 1) : null

    idx++
    sites.push({
      id: `${siteIdPrefix(g.city)}-AVENUE-${String(idx).padStart(4, '0')}`,
      name: `${g.segment} (${g.city})`,
      type: 'street_tree',
      city: g.city,
      address: g.startPt || g.endPt || `${REGION.sido} ${g.city} ${g.segment}`,
      latitude: round(lat, 6),
      longitude: round(lng, 6),
      area_m2: null,
      length_m: null,
      main_species: topSpecies,
      managing_agency: `${g.city} 산림공원과`,
      source_dataset: '산림청 도시숲가로수관리 가로수 현황',
      source_url: 'https://www.data.go.kr/',
      _coord_approx: true, // 도로구간 평균 좌표 (단목 평균)
      _established_years: null,
      _tree_count: totalTrees,
      _mean_dbh_cm: meanDbh,
      _species_mix: speciesEntries
    })
  }
  return sites
}

// 광명시 단목: 행정동별로 집계 → 가로수길 사이트
function aggregatePointTreesSimple(rows, file, startCounter) {
  const city = cityFromFilename(file)
  if (!city) return []
  const groups = new Map()
  for (const row of rows) {
    const dong = pickField(row, ['행정동', '읍면동', '동']) || '미상'
    const species = pickField(row, ['가로수종류', '수종']) || '미상'
    const lat = Number(pickField(row, ['위도']))
    const lng = Number(pickField(row, ['경도']))
    if (!isFinite(lat) || !isFinite(lng) || lat === 0) continue
    if (!inRegionBbox(lat, lng)) continue
    const key = `${city}|${dong}`
    if (!groups.has(key)) groups.set(key, { city, dong, xs: [], ys: [], speciesCount: new Map() })
    const g = groups.get(key)
    g.xs.push(lng); g.ys.push(lat)
    g.speciesCount.set(species, (g.speciesCount.get(species) || 0) + 1)
  }
  const sites = []
  let idx = startCounter
  for (const g of groups.values()) {
    const cx = g.xs.reduce((a, b) => a + b, 0) / g.xs.length
    const cy = g.ys.reduce((a, b) => a + b, 0) / g.ys.length
    let topSpecies = '미상', topCount = 0
    for (const [s, c] of g.speciesCount) if (c > topCount) { topSpecies = s; topCount = c }
    const speciesMix = [...g.speciesCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s, c]) => `${s}(${c})`).join(', ')
    idx++
    sites.push({
      id: `${siteIdPrefix(city)}-DONG-${String(idx).padStart(4, '0')}`,
      name: `${g.dong} 가로수 (${city})`,
      type: 'street_tree',
      city,
      address: `${REGION.sido} ${city} ${g.dong}`,
      latitude: round(cy, 6), longitude: round(cx, 6),
      area_m2: null, length_m: null,
      main_species: topSpecies,
      managing_agency: `${city} 산림공원과`,
      source_dataset: `${REGION.sido} ${city} 가로수 현황 (지자체)`,
      source_url: 'https://www.data.go.kr/',
      _coord_approx: true,
      _established_years: null,
      _tree_count: g.xs.length,
      _species_mix: speciesMix
    })
  }
  return sites
}

// 의왕시 단목 (수종코드 + EPSG:5186 평면좌표): 행정동읍면코드별 집계
// 컬럼명 "위도/경도"에 실제로는 EPSG:5186 X/Y 평면좌표가 들어있음 (공통 데이터 입력 관행)
function aggregatePointTreesCoded(rows, file, startCounter) {
  const city = cityFromFilename(file)
  if (!city) return []
  const groups = new Map()
  for (const row of rows) {
    const dongCode = pickField(row, ['행정동읍면코드']) || '미상'
    const treeCode = pickField(row, ['수종코드']) || '미상'
    const plantYmd = pickField(row, ['식재일자']) || ''
    const dbh = Number(pickField(row, ['가로수직경']) || 0)
    const x = Number(pickField(row, ['위도']))
    const y = Number(pickField(row, ['경도']))
    if (!isFinite(x) || !isFinite(y) || x === 0 || y === 0) continue
    let lat, lng
    try { [lng, lat] = proj4('EPSG:5186', 'EPSG:4326', [x, y]) } catch { continue }
    if (!isFinite(lat) || !isFinite(lng) || !inRegionBbox(lat, lng)) continue
    const key = `${city}|${dongCode}`
    if (!groups.has(key)) groups.set(key, {
      city, dongCode, xs: [], ys: [], speciesCount: new Map(),
      dbhSum: 0, dbhCount: 0, years: []
    })
    const g = groups.get(key)
    g.xs.push(lng); g.ys.push(lat)
    g.speciesCount.set(treeCode, (g.speciesCount.get(treeCode) || 0) + 1)
    if (dbh > 0) { g.dbhSum += dbh; g.dbhCount++ }
    if (plantYmd && plantYmd.length >= 4) {
      const yr = Number(plantYmd.slice(0, 4))
      if (yr > 1950 && yr <= TODAY.getFullYear()) g.years.push(yr)
    }
  }
  const sites = []
  let idx = startCounter
  for (const g of groups.values()) {
    const cx = g.xs.reduce((a, b) => a + b, 0) / g.xs.length
    const cy = g.ys.reduce((a, b) => a + b, 0) / g.ys.length
    // 수종코드(TRE002 등) → "혼효림" 일괄 치환. 원본 분포는 _species_mix에 보존.
    const speciesMix = [...g.speciesCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s, c]) => `${s}(${c})`).join(', ')
    const meanDbh = g.dbhCount > 0 ? round(g.dbhSum / g.dbhCount, 1) : null
    const avgYear = g.years.length ? Math.round(g.years.reduce((a, b) => a + b, 0) / g.years.length) : null
    const years = avgYear ? TODAY.getFullYear() - avgYear : null
    idx++
    sites.push({
      id: `${siteIdPrefix(city)}-DONG-${String(idx).padStart(4, '0')}`,
      name: `${g.dongCode} 가로수 (${city})`,
      type: 'street_tree',
      city,
      address: `${REGION.sido} ${city}`,
      latitude: round(cy, 6), longitude: round(cx, 6),
      area_m2: null, length_m: null,
      main_species: '혼효림',
      managing_agency: `${city} 산림공원과`,
      source_dataset: `${REGION.sido} ${city} 가로수 현황 (보행안전지수)`,
      source_url: 'https://www.data.go.kr/',
      _coord_approx: true,
      _established_years: years,
      _tree_count: g.xs.length,
      _mean_dbh_cm: meanDbh,
      _species_mix: speciesMix
    })
  }
  return sites
}

// 안산시 노선별 가로수 (한 행 = 한 도로구간, 좌표 없음)
function parseRouteAggregated(row, idx) {
  const cityRaw = pickField(row, ['시군명'])
  const city = normalizeCity(cityRaw)
  if (!city || !CITY_CENTROIDS[city]) return null
  const route = pickField(row, ['노선명'])
  if (!route) return null
  const dong = pickField(row, ['행정동']) || ''
  const segment = pickField(row, ['구간']) || ''
  const segLen = Number(pickField(row, ['구간길이']) || 0)
  const species = pickField(row, ['수종']) || '-'
  const trees = Number(pickField(row, ['가로수본수']) || 0)
  const c = CITY_CENTROIDS[city]
  const seedKey = `route-${city}-${route}-${dong}-${segment}-${idx}`
  return {
    id: `${siteIdPrefix(city)}-ROUTE-${String(idx).padStart(4, '0')}`,
    name: dong ? `${route} (${dong})` : route,
    type: 'street_tree',
    city,
    address: segment ? `${REGION.sido} ${city} ${segment}` : `${REGION.sido} ${city}`,
    latitude: round(c[0] + jitter(seedKey + 'lat'), 6),
    longitude: round(c[1] + jitter(seedKey + 'lng'), 6),
    area_m2: null,
    length_m: segLen > 0 ? segLen : null,
    main_species: species,
    managing_agency: `${city} 산림공원과`,
    source_dataset: `${REGION.sido} ${city} 노선별 가로수 현황`,
    source_url: 'https://www.data.go.kr/',
    _coord_approx: true,
    _established_years: null,
    _tree_count: trees > 0 ? trees : null
  }
}

// 양평군 관내 가로수 (수종 컬럼 피벗, 좌표 없음)
function parseRouteSpeciesPivot(row, idx, file) {
  const city = cityFromFilename(file)
  if (!city || !CITY_CENTROIDS[city]) return null
  const route = pickField(row, ['노선명'])
  if (!route) return null
  const dong = pickField(row, ['읍면']) || ''
  const length = Number(pickField(row, ['연장']) || 0) // 단위: km
  const speciesCols = ['벚나무', '은행나무', '이팝나무', '살구나무', '산수유', '느티나무', '소나무', '반송', '매실나무', '고로쇠']
  let topSpecies = '혼효림', topCount = 0, total = 0
  for (const s of speciesCols) {
    const n = Number(row[s] || 0)
    if (n > 0) {
      total += n
      if (n > topCount) { topSpecies = s; topCount = n }
    }
  }
  if (total === 0) return null
  const c = CITY_CENTROIDS[city]
  const seedKey = `pivot-${city}-${dong}-${route}-${idx}`
  return {
    id: `${siteIdPrefix(city)}-ROUTE-${String(idx).padStart(4, '0')}`,
    name: dong ? `${route} (${dong})` : route,
    type: 'street_tree',
    city,
    address: `${REGION.sido} ${city} ${dong}`.trim(),
    latitude: round(c[0] + jitter(seedKey + 'lat'), 6),
    longitude: round(c[1] + jitter(seedKey + 'lng'), 6),
    area_m2: null,
    length_m: length > 0 ? Math.round(length * 1000) : null,
    main_species: topSpecies,
    managing_agency: `${city} 산림공원과`,
    source_dataset: `${REGION.sido} ${city} 관내 가로수 데이터`,
    source_url: 'https://www.data.go.kr/',
    _coord_approx: true,
    _established_years: null,
    _tree_count: total
  }
}

// 파주시 도시숲표준지 (한 행 = 한 표준지, 좌표 + 15개 등급)
function parseUrbanForestPlot(row, idx, file) {
  const name = pickField(row, ['표준지명'])
  if (!name) return null
  const cityRaw = pickField(row, ['관리기관명']) || ''
  let city = normalizeCity(cityRaw.replace(/(부산광역시|부산|시청|구청|군청)/g, ''))
  if (!city) city = cityFromFilename(file)
  if (!city || !CITY_CENTROIDS[city]) return null
  const lat = Number(pickField(row, ['위도']))
  const lng = Number(pickField(row, ['경도']))
  if (!isFinite(lat) || !isFinite(lng) || lat === 0 || !inRegionBbox(lat, lng)) return null
  const dongName = pickField(row, ['읍면동명']) || ''
  const area = Number(pickField(row, ['면적']) || 0)
  const established = Number(pickField(row, ['조성연도']) || 0)
  const years = established > 1900 ? TODAY.getFullYear() - established : null
  const ptype = pickField(row, ['유형명']) || ''
  const func = pickField(row, ['기능명']) || ''
  const address = pickField(row, ['소재지도로명주소', '소재지지번주소']) || ''
  const vitality = Number(pickField(row, ['수목활력도등급']) || 0)
  const biodiv = Number(pickField(row, ['종다양성등급']) || 0)
  const mortality = Number(pickField(row, ['고사율등급']) || 0)
  const soilDrain = Number(pickField(row, ['배수등급']) || 0)
  return {
    id: `${siteIdPrefix(city)}-FOREST-${String(idx).padStart(4, '0')}`,
    name: ptype ? `${name} (${ptype})` : name,
    type: 'park',
    city,
    address: address || `${REGION.sido} ${city} ${dongName}`,
    latitude: round(lat, 6),
    longitude: round(lng, 6),
    area_m2: area > 0 ? area : null,
    length_m: null,
    main_species: '혼효림',
    managing_agency: cityRaw || `${city} 산림공원과`,
    source_dataset: `${REGION.sido} ${city} 도시숲표준지 현황`,
    source_url: 'https://www.data.go.kr/',
    _coord_approx: false,
    _established_years: years,
    _forest_type: ptype,
    _forest_function: func,
    _vitality_grade: vitality > 0 ? vitality : null,
    _biodiversity_grade: biodiv > 0 ? biodiv : null,
    _mortality_grade: mortality > 0 ? mortality : null,
    _drainage_grade: soilDrain > 0 ? soilDrain : null
  }
}

// 시연용 위험요인 시드: 시군/유형/순번 기반으로 결정론적으로 0~100 분포 생성
function seededScore(seed, base) {
  const h = Math.abs(hash(seed))
  return Math.min(100, Math.max(0, base + (h % 30) - 15))
}

// SDR (Stand/Stocking Density Ratio) — 임분 밀도 비율, 과밀 지표
// 가로수길은 본수/길이(본/m), 산림형은 본수/면적(본/ha)으로 산출.
//   임계값 (가로수길): 0.25본/m 이상=과밀, 0.10~0.25=정상, 0.10 미만=여유
//   임계값 (소나무숲): 1500본/ha 이상=과밀, 500~1500=정상, 500 미만=여유
// 과밀일수록 광·수분 경쟁 ↑ → 개별 수목 활력 ↓ → 식생 취약성 +가산
function sdrAdjustment(site) {
  if (!site._tree_count) return 0
  // street_tree: 본/m
  if (site.type === 'street_tree' && site.length_m > 0) {
    const density = site._tree_count / site.length_m
    site._sdr_density = Math.round(density * 1000) / 1000 // 본/m
    site._sdr_unit = '본/m'
    if (density >= 0.30) return 15  // 매우 과밀
    if (density >= 0.20) return 10  // 과밀
    if (density >= 0.10) return 0   // 정상
    return -5                       // 여유 (수목 활력 ↑)
  }
  // pine_forest: 본/ha (area_m2 → ha)
  if (site.type === 'pine_forest' && site.area_m2 > 0) {
    const density = site._tree_count / (site.area_m2 / 10000)
    site._sdr_density = Math.round(density)
    site._sdr_unit = '본/ha'
    if (density >= 2000) return 15
    if (density >= 1500) return 10
    if (density >= 500) return 0
    return -5
  }
  return 0
}

// 자산 노후도 → 점수 (조성·식재 후 경과년수 proxy)
// 실 관리이력 데이터 미보유 상태의 추정. 지자체 관리이력 DB 연계 시 정밀화.
function managementGapFromAge(years) {
  if (years == null) return { score: 50, days: null }
  let score
  if (years >= 50) score = 90
  else if (years >= 30) score = 75
  else if (years >= 15) score = 60
  else if (years >= 5) score = 45
  else score = 25
  return { score, days: years * 365 }
}

function fireRiskFromCity(city) {
  if (!EXTERNAL.fire_risk || !EXTERNAL.fire_risk.by_sigun) return null
  const entry = EXTERNAL.fire_risk.by_sigun[city]
  if (!entry) return null
  return {
    score: entry.meanavg,
    analdate: entry.analdate,
    sigun: entry.sigun
  }
}

function weatherStressFromCity(city) {
  if (!EXTERNAL.weather || !EXTERNAL.weather.by_sigun) return null
  const entry = EXTERNAL.weather.by_sigun[city]
  if (!entry || entry.error || entry.score == null) return null
  return {
    score: entry.score,
    maxTemp: entry.maxTemp,
    minHumidity: entry.minHumidity,
    maxWind: entry.maxWind,
    totalRain: entry.totalRain
  }
}

function soilFromCity(city) {
  if (!EXTERNAL.soil || !EXTERNAL.soil.by_sigun) return null
  const entry = EXTERNAL.soil.by_sigun[city]
  if (!entry || entry.found === false || entry.score == null) return null
  return {
    score: entry.score,
    texture_code: entry.texture_code,
    gravel_code: entry.gravel_code,
    slope_code: entry.slope_code,
    pnu: entry.pnu
  }
}

function damageHistoryFromCity(city) {
  if (!EXTERNAL.fire_history || !EXTERNAL.fire_history.by_sigun) return null
  const entry = EXTERNAL.fire_history.by_sigun[city]
  if (!entry || entry.score == null) return null
  return {
    score: entry.score,
    count_yr: entry.count_yr,
    area_ha_yr: entry.area_ha_yr,
    source: entry.source
  }
}

// 도시숲표준지 등급(1~5, 1=최상) → 위험점수(0~100, 100=최위험)
//   파주시 도시숲표준지 현황의 사이트별 실측 등급. 활력도·종다양성·고사율·배수 등급을
//   기존 6요인 점수에 직접 매핑한다. (시군 단위 시뮬레이션보다 정밀)
function vegetationScoreFromGrades(site) {
  if (site._vitality_grade == null) return null
  // 활력도 1=건강 → 20점, 5=고사 직전 → 80점
  const v = Number(site._vitality_grade)
  let score = 20 + (v - 1) * 15
  // 종다양성 보정 (1=풍부 → -5, 5=빈약 → +10)
  if (site._biodiversity_grade != null) {
    const b = Number(site._biodiversity_grade)
    score += (b - 1) * 3.75 - 5
  }
  return Math.max(0, Math.min(100, Math.round(score)))
}

function damageScoreFromGrades(site) {
  if (site._mortality_grade == null) return null
  const m = Number(site._mortality_grade)
  return Math.max(0, Math.min(100, Math.round(15 + (m - 1) * 17.5)))
}

function soilScoreFromGrades(site) {
  if (site._drainage_grade == null) return null
  const d = Number(site._drainage_grade)
  return Math.max(0, Math.min(100, Math.round(25 + (d - 1) * 13))) // 1=우수→25, 5=불량→77
}

function assignRisk(site) {
  const seed = site.id

  // PNU 캐시 주입 (VWorld 결과)
  if (!site._pnu && SITE_PNU_CACHE[site.id]) site._pnu = SITE_PNU_CACHE[site.id]
  // 경기기후플랫폼 통합 데이터 주입
  const ggc = GG_CLIMATE[site.id] || null
  if (ggc) {
    if (ggc.tree_cvg != null) site._tree_canopy_cvg = ggc.tree_cvg
    if (ggc.tree_avg_hgt != null) site._tree_canopy_avg_hgt = ggc.tree_avg_hgt
    if (ggc.forest_cbn_abpvl != null) site._forest_carbon_uptake = ggc.forest_cbn_abpvl
    if (ggc.emd_park_score != null) site._emd_park_score = ggc.emd_park_score
    if (ggc.flood_risk_idx != null) site._flood_risk_idx = ggc.flood_risk_idx
    if (ggc.landslide_grade1) site._landslide_grade1 = true
    if (ggc.landslide_weak) site._landslide_weak = true
  }

  // (1) 식생·수종 취약성: 도시숲표준지 등급 > 수관폐쇄율(tree_cvg) > 수종 매트릭스
  //     + SDR(과밀도) 가산
  let vegetation_score
  const vegGrade = vegetationScoreFromGrades(site)
  if (vegGrade != null) {
    vegetation_score = vegGrade
  } else if (ggc?.tree_cvg != null && ggc.tree_cvg > 0) {
    const cvg = Math.max(0, Math.min(1, ggc.tree_cvg))
    const cvgScore = 85 - cvg * 60 // 0 → 85, 1 → 25
    const speciesScore = vegetationScoreFromSpecies(site.main_species)
    vegetation_score = Math.round((cvgScore + speciesScore) / 2)
  } else {
    vegetation_score = vegetationScoreFromSpecies(site.main_species)
  }
  // SDR 가산 (과밀 → 식생 취약성 ↑, 여유 → ↓)
  const sdrAdj = sdrAdjustment(site)
  if (sdrAdj !== 0) {
    vegetation_score = Math.max(0, Math.min(100, vegetation_score + sdrAdj))
    site._sdr_adjustment = sdrAdj
  }

  // (2) 관리공백/노후도: 조성·식재 후 경과년수 기반 (proxy)
  let gap = managementGapFromAge(site._established_years)
  // 도시공원은 읍면동 공원평가 점수에 따라 관리공백 가산/감산
  if (site.type === 'park' && ggc?.emd_park_score != null) {
    const ps = ggc.emd_park_score
    let bonus = 0
    if (ps < 50) bonus = (50 - ps) * 0.3 // 서비스 부족 → 관리 우선순위 ↑
    else if (ps > 70) bonus = (70 - ps) * 0.2
    gap = { score: Math.round(Math.max(15, Math.min(95, gap.score + bonus))), days: gap.days }
  }

  // (3) 산불·기상·토양·피해이력: 외부 API/공식 통계 실데이터 (있으면)
  const fire = fireRiskFromCity(site.city)
  const weather = weatherStressFromCity(site.city)
  const soil = soilFromCity(site.city)
  const damage = damageHistoryFromCity(site.city)
  // 도시숲표준지 등급 (있으면 시군 단위보다 우선)
  const soilGrade = soilScoreFromGrades(site)
  const damageGrade = damageScoreFromGrades(site)
  // 사이트별 PNU 토양 (있으면 모든 시군 단위·등급보다 우선) — score 있는 경우만 신뢰
  const _rawSiteSoil = site._pnu && SITE_SOIL_CACHE[site._pnu]
  const siteSoil = _rawSiteSoil && typeof _rawSiteSoil.score === 'number' ? _rawSiteSoil : null
  // 경기기후플랫폼 토양 (산사태 + 토양탄소취약성)
  let ggcSoilScore = null
  if (ggc) {
    const parts = []
    const weights = []
    if (ggc.landslide_grade1) { parts.push(85); weights.push(2) }
    else if (ggc.landslide_weak) { parts.push(65); weights.push(1.5) }
    if (ggc.soil_cbn_vul != null) {
      parts.push(30 + Math.min(1, Math.max(0, ggc.soil_cbn_vul)) * 50)
      weights.push(1)
    }
    if (parts.length > 0) {
      const wsum = weights.reduce((a, b) => a + b, 0)
      ggcSoilScore = Math.round(parts.reduce((a, b, i) => a + b * weights[i], 0) / wsum)
    }
  }
  // 피해이력: 산불 + 홍수위험 가중평균
  let combinedDamage = null
  if (ggc?.flood_risk_idx != null) {
    const floodScore = 15 + Math.min(1, Math.max(0, ggc.flood_risk_idx)) * 70
    if (damage) combinedDamage = Math.round(damage.score * 0.6 + floodScore * 0.4)
    else combinedDamage = Math.round(floodScore)
  }

  // (4) Fallback - 유형별 시뮬레이션
  const base = {
    pine_forest: { fire: 75, weather: 60, soil: 50, damage: 50 },
    street_tree: { fire: 40, weather: 65, soil: 45, damage: 35 },
    park: { fire: 30, weather: 50, soil: 45, damage: 30 },
    forest_adjacent: { fire: 70, weather: 60, soil: 50, damage: 50 }
  }[site.type] || { fire: 40, weather: 50, soil: 50, damage: 40 }

  // 점수 우선순위:
  //   토양: 사이트 PNU 토양 > 도시숲표준지 등급 > 경기기후(산사태·취약성) > 시군 농진청 > simulation
  //   피해이력: 도시숲표준지 등급 > 산불+홍수 조합 > 산불(시군) > simulation
  const soilFinal =
    siteSoil ? siteSoil.score :
    soilGrade != null ? soilGrade :
    ggcSoilScore != null ? ggcSoilScore :
    soil ? soil.score : seededScore(seed + 's', base.soil)
  const damageFinal =
    damageGrade != null ? damageGrade :
    combinedDamage != null ? combinedDamage :
    damage ? damage.score : seededScore(seed + 'd', base.damage)
  return {
    weather_stress_score: weather ? weather.score : seededScore(seed + 'w', base.weather),
    fire_risk_score: fire ? fire.score : seededScore(seed + 'f', base.fire),
    vegetation_score,
    soil_score: soilFinal,
    management_gap_score: gap.score,
    damage_history_score: damageFinal,
    last_management_days: gap.days
  }
}

// 각 위험요인의 데이터 출처 (사이트별로 동적 결정)
function riskSources(site) {
  const sitePnu = site._pnu || SITE_PNU_CACHE[site.id]
  const siteSoil = sitePnu && SITE_SOIL_CACHE[sitePnu]
  const ggc = GG_CLIMATE[site.id]
  const hasGgcSoil = ggc && (ggc.landslide_grade1 || ggc.landslide_weak || ggc.soil_cbn_vul != null)
  const hasGgcDamage = ggc && ggc.flood_risk_idx != null
  const hasGgcVeg = ggc && ggc.tree_cvg != null
  return {
    weather_stress_score: weatherStressFromCity(site.city) ? 'real' : 'simulation',
    fire_risk_score: fireRiskFromCity(site.city) ? 'real' : 'simulation',
    vegetation_score: 'real', // 수종 매트릭스·등급·tree_cvg 모두 실데이터
    soil_score:
      siteSoil ? 'real' :
      site._drainage_grade != null ? 'real' :
      hasGgcSoil ? 'real' :
      soilFromCity(site.city) ? 'real' : 'simulation',
    management_gap_score: site._established_years != null ? 'proxy' : 'simulation',
    damage_history_score:
      site._mortality_grade != null ? 'real' :
      hasGgcDamage ? 'real' :
      damageHistoryFromCity(site.city) ? 'real' : 'simulation'
  }
}

function main() {
  // data/raw/ (사용자 추가용, gitignored) + data/source-csv/ (저장소 커밋, 재현용) 둘 다 스캔
  const sources = []
  for (const dir of [SOURCE_DIR, RAW_DIR]) {
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      if (!/\.csv$/i.test(f)) continue
      sources.push({ dir, file: f })
    }
  }
  if (sources.length === 0) {
    // CSV가 없어도 가로수 API 결과(busan_street_trees.json) 병합은 진행되도록 경고만 출력.
    console.warn(
      `[!] CSV 없음 — data/source-csv 또는 data/raw 폴더에 부산 공공데이터 CSV(도시공원 등)를 두세요. (가로수 API 결과만 병합)`
    )
  }
  // 동일 파일명이 양 폴더에 있으면 data/raw (사용자 최신본) 우선
  const seenName = new Set()
  const dedupedSources = []
  // raw 폴더부터 먼저 (사용자 최신 파일 우선권)
  sources.sort((a, b) => (a.dir === RAW_DIR ? -1 : 1))
  for (const s of sources) {
    if (seenName.has(s.file)) continue
    seenName.add(s.file)
    dedupedSources.push(s)
  }
  // 개별 시군 파일이 통합본보다 먼저 처리되도록 정렬
  dedupedSources.sort((a, b) => {
    const aInd = /_(?:시|군)_|시_|군_/.test(a.file) ? 0 : 1
    const bInd = /_(?:시|군)_|시_|군_/.test(b.file) ? 0 : 1
    if (aInd !== bInd) return aInd - bInd
    return b.file.localeCompare(a.file)
  })
  const files = dedupedSources.map((s) => s.file)
  const fileDirMap = new Map(dedupedSources.map((s) => [s.file, s.dir]))

  const out = []
  const seenKey = new Set()
  let counter = 0
  let dedupedCount = 0
  const counts = {}

  for (const file of files) {
    const full = path.join(fileDirMap.get(file) || RAW_DIR, file)
    let rows
    try {
      rows = readCsvAuto(full)
    } catch (e) {
      console.error(`[!] ${file} 파싱 실패: ${e.message}`)
      continue
    }
    if (rows.length === 0) {
      console.warn(`[skip] ${file}: 행 없음`)
      continue
    }
    const schema = detectSchema(Object.keys(rows[0]))
    console.log(`[${schema}] ${file}: ${rows.length}행`)

    // tree_inventory: 단목 1M+ 행을 도로구간별로 집계 → 가로수길 사이트
    // point_trees_simple/coded: 지자체 단목 CSV → 행정동별 집계 → 가로수길 사이트
    if (schema === 'tree_inventory' || schema === 'point_trees_simple' || schema === 'point_trees_coded') {
      const sites =
        schema === 'tree_inventory'
          ? aggregateTreeInventory(rows, counter)
          : schema === 'point_trees_simple'
          ? aggregatePointTreesSimple(rows, file, counter)
          : aggregatePointTreesCoded(rows, file, counter)
      counter += sites.length
      for (const site of sites) {
        const dedupKey = [
          site.type,
          site.city,
          site.name,
          site.latitude.toFixed(3),
          site.longitude.toFixed(3)
        ].join('|')
        if (seenKey.has(dedupKey)) {
          dedupedCount++
          continue
        }
        seenKey.add(dedupKey)
        site.risk = assignRisk(site)
        site.risk_sources = riskSources(site)
        out.push(site)
        counts['street_tree'] = (counts['street_tree'] || 0) + 1
      }
      console.log(`  → 집계: ${sites.length}개 사이트`)
      continue
    }

    // 파일명 기반 파서 (양평·파주처럼 CSV에 시군 컬럼 없는 경우)
    const needsFile = schema === 'route_species_pivot' || schema === 'urban_forest_plot'
    const parser =
      schema === 'pine_forest'
        ? parsePineForest
        : schema === 'street_tree'
        ? parseStreetTree
        : schema === 'park'
        ? parsePark
        : schema === 'route_aggregated'
        ? parseRouteAggregated
        : schema === 'route_species_pivot'
        ? parseRouteSpeciesPivot
        : schema === 'urban_forest_plot'
        ? parseUrbanForestPlot
        : null
    if (!parser) {
      console.warn(`  → 스키마 미인식, 건너뜀: ${Object.keys(rows[0]).join(', ')}`)
      continue
    }

    for (const row of rows) {
      counter++
      const site = needsFile ? parser(row, counter, file) : parser(row, counter)
      if (!site) continue
      // 중복 키: 유형+시군+명칭+좌표(소수 3자리 ≈ 100m 이내)
      const dedupKey = [
        site.type,
        site.city,
        site.name,
        site.latitude.toFixed(3),
        site.longitude.toFixed(3)
      ].join('|')
      if (seenKey.has(dedupKey)) {
        dedupedCount++
        continue
      }
      seenKey.add(dedupKey)
      site.risk = assignRisk(site)
      site.risk_sources = riskSources(site)
      out.push(site)
      counts[schema] = (counts[schema] || 0) + 1
    }
  }

  // 부산 가로수 사이트 통합 (data/external/busan_street_trees.json)
  // 전국 산림청 가로수 현황 CSV에는 부산이 누락되어 있어, 부산광역시_구군 가로수 현황
  // Open API(6260000)로 별도 수집한 결과(fetchBusanStreetTrees.mjs)를 머지한다.
  const streetTreeFile = path.join(ROOT, 'data', 'external', 'busan_street_trees.json')
  if (fs.existsSync(streetTreeFile)) {
    try {
      const stSites = JSON.parse(fs.readFileSync(streetTreeFile, 'utf8'))
      let added = 0
      for (const site of stSites) {
        const dedupKey = [
          site.type,
          site.city,
          site.name,
          site.latitude.toFixed(3),
          site.longitude.toFixed(3)
        ].join('|')
        if (seenKey.has(dedupKey)) {
          dedupedCount++
          continue
        }
        seenKey.add(dedupKey)
        site.risk = assignRisk(site)
        site.risk_sources = riskSources(site)
        out.push(site)
        added++
      }
      counts['busan_street_trees'] = added
      console.log(`[busan_street_trees] ${streetTreeFile.split(/[\\/]/).pop()}: ${added}개 사이트 통합`)
    } catch (e) {
      console.warn(`[!] busan_street_trees.json 통합 실패: ${e.message}`)
    }
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8')
  // src/data/sites_real.json은 빈 스텁 — 런타임에 public/sites_real.json을 fetch
  fs.writeFileSync(STUB_FILE, '[]\n', 'utf8')
  console.log(`\n생성: ${OUT_FILE}`)
  console.log(`스텁: ${STUB_FILE} (런타임 fetch 분리)`)
  console.log(`총 ${out.length}개 사이트:`, counts)
  if (dedupedCount > 0) console.log(`중복 제거: ${dedupedCount}개`)
}

main()
