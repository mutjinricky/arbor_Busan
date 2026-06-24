// 사이트별 정밀 PNU(VWorld 결과)로 농진청 토양도 V2 API를 호출하여
// site_soil_cache.json 생성. ETL이 이를 site별 soil_score에 자동 적용.
//
// 전제: scripts/fetchSitePnu.mjs 완료 → data/external/site_pnu_cache.json 존재
//
// 사용:
//   node --env-file=.env scripts/fetchSiteSoil.mjs
//
// 같은 PNU는 한 번만 호출 (시군 같으면 거리 가까운 사이트들이 동일 PNU 갖는 경우 多)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const KEY = process.env.DATA_GO_KR_KEY
if (!KEY) {
  console.error('DATA_GO_KR_KEY 미설정. .env에 추가 후 재실행.')
  process.exit(1)
}

const PNU_CACHE_FILE = path.join(ROOT, 'data', 'external', 'site_pnu_cache.json')
const SOIL_CACHE_FILE = path.join(ROOT, 'data', 'external', 'site_soil_cache.json')

if (!fs.existsSync(PNU_CACHE_FILE)) {
  console.error(`PNU 캐시 없음: ${PNU_CACHE_FILE}`)
  console.error(`먼저 실행: node --env-file=.env scripts/fetchSitePnu.mjs`)
  process.exit(1)
}

const pnuCache = JSON.parse(fs.readFileSync(PNU_CACHE_FILE, 'utf8'))
const soilCache = fs.existsSync(SOIL_CACHE_FILE)
  ? JSON.parse(fs.readFileSync(SOIL_CACHE_FILE, 'utf8'))
  : {}

// 유니크 PNU 목록 — 산지(2)·일반(1) 분리.
// 도시지역 일반 PNU는 토양도 데이터 거의 없으므로 산지 우선 호출, 일반은 옵션.
const ALL_PNUS = [...new Set(Object.values(pnuCache).filter(Boolean))]
const MOUNTAIN_PNUS = ALL_PNUS.filter((p) => p[10] === '2')
const NORMAL_PNUS = ALL_PNUS.filter((p) => p[10] === '1')

const MODE = process.argv[2] || 'mountain' // 'mountain' (default) | 'all'
const uniquePnus = MODE === 'all' ? ALL_PNUS : MOUNTAIN_PNUS

console.log(`PNU 캐시 ${Object.keys(pnuCache).length}건 · 산지 ${MOUNTAIN_PNUS.length} · 일반 ${NORMAL_PNUS.length}`)
console.log(`모드: ${MODE} (대상 ${uniquePnus.length}건)`)
console.log(`이미 토양 캐시: ${Object.keys(soilCache).length}건`)
if (MODE === 'mountain') {
  console.log(`일반 PNU(${NORMAL_PNUS.length}건)는 도시지역으로 토양도 데이터 없을 가능성 ↑. 시군 단위 fallback으로 처리됨.`)
  console.log(`강제 호출 원하면: node scripts/fetchSiteSoil.mjs all`)
}

const TEXTURE_SCORE = {
  '01': 70, '02': 40, '03': 35, '04': 20, '05': 25, '06': 60, '99': 50
}
const GRAVEL_SCORE = { '01': 20, '02': 50, '03': 80, '99': 50 }
const SLOPE_SCORE = {
  '01': 20, '02': 25, '03': 40, '04': 60, '05': 80, '06': 95, '99': 50
}

function calcSoilScore({ qlt, ston, slope }) {
  const t = TEXTURE_SCORE[qlt] ?? 50
  const g = GRAVEL_SCORE[ston] ?? 50
  const s = SLOPE_SCORE[slope] ?? 50
  return Math.round(t * 0.4 + g * 0.3 + s * 0.3)
}

function xmlValue(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
  return m ? m[1].trim() : null
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchSoilForPnu(pnu, attempt = 1) {
  const url = new URL(
    'http://apis.data.go.kr/1390802/SoilEnviron/SoilCharacSctnn/V2/getSoilCharacterSctnn'
  )
  url.searchParams.set('serviceKey', KEY)
  url.searchParams.set('PNU_CD', pnu)
  const res = await fetch(url)
  if (res.status === 429 && attempt < 6) {
    await sleep(2000 * attempt)
    return fetchSoilForPnu(pnu, attempt + 1)
  }
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const xml = await res.text()
  const code = xmlValue(xml, 'Result_Code')
  if (code === '301') return { found: false }
  if (code !== '200') return { found: false, error: code }
  const qlt = xmlValue(xml, 'Deepsoil_Qlt_Cd')
  const ston = xmlValue(xml, 'Deepsoil_Ston_Cd')
  const slope = xmlValue(xml, 'Soilslope_Cd')
  if (!qlt || !ston || !slope) return { found: false }
  return {
    found: true,
    qlt,
    ston,
    slope,
    score: calcSoilScore({ qlt, ston, slope })
  }
}

let processed = 0
let cached = 0
let fetched = 0
let notFound = 0
let failed = 0

for (const pnu of uniquePnus) {
  if (soilCache[pnu]) {
    cached++
    continue
  }
  try {
    const r = await fetchSoilForPnu(pnu)
    if (r.found) {
      soilCache[pnu] = {
        score: r.score,
        texture_code: r.qlt,
        gravel_code: r.ston,
        slope_code: r.slope
      }
      fetched++
    } else {
      soilCache[pnu] = { found: false }
      notFound++
    }
  } catch (e) {
    failed++
    if (failed < 5) console.warn(`[!] ${pnu}: ${e.message}`)
  }
  processed++
  await sleep(200)
  if (processed % 100 === 0) {
    fs.writeFileSync(SOIL_CACHE_FILE, JSON.stringify(soilCache, null, 2), 'utf8')
    console.log(`  진행: ${processed}/${uniquePnus.length} (캐시 ${cached}, 신규 ${fetched}, 데이터없음 ${notFound}, 실패 ${failed})`)
  }
}

fs.writeFileSync(SOIL_CACHE_FILE, JSON.stringify(soilCache, null, 2), 'utf8')
console.log(`\n완료: 캐시 ${cached}, 신규 ${fetched}, 데이터없음 ${notFound}, 실패 ${failed}`)
console.log(`캐시: ${SOIL_CACHE_FILE}`)
console.log(`ETL이 캐시를 읽어 site별 soil_score에 자동 주입`)
