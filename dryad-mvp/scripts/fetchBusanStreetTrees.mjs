// 부산광역시_구군 가로수 현황 Open API → data/external/busan_street_trees.json
//
// 전국 산림청 가로수 현황 CSV에는 부산이 누락되어 있어, 부산 자체 Open API로 수집한다.
// ETL(scripts/etl.mjs)이 이 JSON을 읽어 가로수 사이트로 통합하고 위험점수를 부여한다.
//
// 사용:
//   node --env-file=.env scripts/fetchBusanStreetTrees.mjs
//
// API: https://www.data.go.kr/data/15040363/openapi.do
//   엔드포인트 http://apis.data.go.kr/6260000/RoadsideTreeService/RoadSideTreeStusInfo
//   필수: serviceKey, numOfRows, pageNo  /  선택: gugun, resultType=json
//   응답: loc_nm(위치명), lat, lng, sec_timepoint(구간시점), sec_endpoint(구간종점),
//         plant_distance(식재거리), total(총본수), 수종별 본수 컬럼들, gugun, reference_date
//
// ⚠️ 이 API는 사용자 data.go.kr 계정에서 "활용신청"이 승인되어야 한다(같은 키 사용).
//    미승인 시 403 Forbidden이 반환된다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { REGION, normalizeCity, siteIdPrefix, inRegionBbox, CITY_CENTROIDS } from '../src/data/busanRegion.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_FILE = path.join(ROOT, 'data', 'external', 'busan_street_trees.json')

const KEY = process.env.DATA_GO_KR_KEY
if (!KEY) {
  console.error('DATA_GO_KR_KEY 미설정. node --env-file=.env scripts/fetchBusanStreetTrees.mjs')
  process.exit(1)
}

const BASE = 'http://apis.data.go.kr/6260000/RoadsideTreeService/RoadSideTreeStusInfo'

// 응답의 메타(비-수종) 필드 — 나머지 숫자 컬럼은 수종별 본수로 간주.
const META_FIELDS = new Set([
  'loc_nm', 'lat', 'lng', 'sec_timepoint', 'sec_endpoint', 'plant_distance',
  'total', 'gugun', 'reference_date', 'rnum', 'no'
])

// 수종 컬럼 romanized → 한글 (수종 매트릭스 speciesMatrix.js 키와 매칭). 미상은 컬럼명 그대로.
// 부산 구군 가로수 API 실제 컬럼명 기준.
const SPECIES_KO = {
  prunus_yedoensis: '왕벚나무',
  yoshino_cherry: '왕벚나무',
  ginkgo: '은행나무',
  ginkgo_biloba: '은행나무',
  sawleaf_zelkova: '느티나무',
  zelkova: '느티나무',
  zelkova_serrata: '느티나무',
  platanus_orientalis: '버즘나무',
  platanus: '버즘나무',
  metasequoia: '메타세쿼이아',
  chinese_fringe_tree: '이팝나무',
  chionanthus: '이팝나무',
  kurogane_holly: '먼나무',
  castanopsis_sieboldii: '구실잣밤나무',
  silver_magnolia: '백목련',
  magnolia: '목련',
  myrsinaleaf_oak: '가시나무',
  camphor_tree: '녹나무',
  celtis_sinensis: '팽나무',
  horse_chestnut: '칠엽수',
  tulipifera: '백합나무',
  liriodendron: '백합나무',
  pinus_thunbergii: '곰솔',
  pinus_densiflora: '소나무',
  black_pine: '곰솔',
  acer_palmatum: '단풍나무',
  acer: '단풍나무',
  acer_buergerianum: '중국단풍',
  trident_maple: '중국단풍',
  firmiana_simplex: '벽오동',
  pin_oak: '대왕참나무',
  quercus_palustris: '대왕참나무',
  quercus: '참나무',
  sophora_japonica: '회화나무',
  styphnolobium_japonicum: '회화나무',
  torulosa: '향나무',
  juniperus: '향나무',
  cedrus_deodara: '개잎갈나무',
  crape_myrtle: '배롱나무',
  lagerstroemia: '배롱나무',
  cornus: '산딸나무',
  prunus_armeniaca: '살구나무',
  cherry: '벚나무',
  prunus: '벚나무',
  pine: '소나무',
  maple: '단풍나무',
  salix: '버드나무',
  populus: '포플러',
  robinia: '아까시나무',
  etc_tree: '기타',
  etc: '기타'
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function fetchPage(pageNo, numOfRows = 500) {
  const url = `${BASE}?serviceKey=${encodeURIComponent(KEY)}&numOfRows=${numOfRows}&pageNo=${pageNo}&resultType=json`
  const res = await fetch(url)
  if (res.status === 403) {
    throw new Error('403 Forbidden — data.go.kr에서 이 API(15040363) 활용신청 승인이 필요합니다.')
  }
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 120))
  const text = await res.text()
  let j
  try { j = JSON.parse(text) } catch { throw new Error('JSON 파싱 실패: ' + text.slice(0, 150)) }
  // 응답 구조는 제공기관마다 다름 — items 배열을 유연하게 탐색
  const body = j?.response?.body || j?.body || j
  const items = body?.items?.item || body?.items || body?.item || []
  const list = Array.isArray(items) ? items : [items].filter(Boolean)
  const total = Number(body?.totalCount ?? body?.total ?? list.length)
  return { list, total }
}

function pickTopSpecies(row) {
  let top = '혼효림', topN = 0, sum = 0
  const mix = []
  for (const [k, v] of Object.entries(row)) {
    if (META_FIELDS.has(k)) continue
    const n = Number(v)
    if (!isFinite(n) || n <= 0) continue
    sum += n
    const ko = SPECIES_KO[k] || k
    mix.push([ko, n])
    if (n > topN) { topN = n; top = ko }
  }
  mix.sort((a, b) => b[1] - a[1])
  return { top, sum, mix: mix.slice(0, 3).map(([s, n]) => `${s}(${n})`).join(', ') }
}

function round(n, p) { const k = Math.pow(10, p); return Math.round(n * k) / k }

async function main() {
  let page = 1
  const all = []
  // 1페이지로 총건수 파악 후 전체 페이징
  const first = await fetchPage(1, 500)
  all.push(...first.list)
  const total = first.total || first.list.length
  const pages = Math.ceil(total / 500)
  console.log(`총 ${total}건 · ${pages}페이지`)
  for (page = 2; page <= pages; page++) {
    const { list } = await fetchPage(page, 500)
    all.push(...list)
    await sleep(150)
  }

  const sites = []
  const counts = {}
  let idx = 0
  for (const row of all) {
    const city = normalizeCity(row.gugun || row.GUGUN || '')
    if (!city) continue
    let lat = Number(row.lat), lng = Number(row.lng)
    let approx = false
    if (!isFinite(lat) || !isFinite(lng) || lat === 0 || lng === 0 || !inRegionBbox(lat, lng)) {
      const c = CITY_CENTROIDS[city]
      if (!c) continue
      lat = c[0]; lng = c[1]; approx = true
    }
    const loc = row.loc_nm || row.sec_timepoint || `${city} 가로수`
    const startEnd = [row.sec_timepoint, row.sec_endpoint].filter(Boolean).join('~')
    const { top, sum, mix } = pickTopSpecies(row)
    const dist = Number(row.plant_distance) || 0
    idx++
    counts[city] = (counts[city] || 0) + 1
    sites.push({
      id: `${siteIdPrefix(city)}-STREET-${String(idx).padStart(4, '0')}`,
      name: startEnd ? `${loc} (${startEnd})` : `${loc} (${city})`,
      type: 'street_tree',
      city,
      address: `${REGION.sido} ${city} ${loc}`.trim(),
      latitude: round(lat, 6),
      longitude: round(lng, 6),
      area_m2: null,
      length_m: dist > 0 ? Math.round(dist) : null,
      main_species: top,
      managing_agency: `${city} 산림녹지과`,
      source_dataset: '부산광역시_구군 가로수 현황',
      source_url: 'https://www.data.go.kr/data/15040363/openapi.do',
      _coord_approx: approx,
      _established_years: null,
      _tree_count: Number(row.total) || sum || null,
      _species_mix: mix || undefined
    })
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(sites, null, 2), 'utf8')
  console.log(`\n생성: ${OUT_FILE}`)
  console.log(`가로수 사이트 ${sites.length}개:`, counts)
}

main().catch((e) => { console.error('실패:', e.message); process.exit(1) })
