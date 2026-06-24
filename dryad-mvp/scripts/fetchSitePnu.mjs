// VWorld 지오코딩 API로 사이트별 정밀 PNU를 조회하여 site._pnu에 저장.
// 이후 ETL의 soilFromCity 대신 사이트별 PNU로 토양 데이터를 가져오면
// 시군당 1건 샘플링 → 사이트당 1건 정밀 매핑으로 정확도 大 향상.
//
// 사용:
//   1. VWorld 무료 키 발급: https://www.vworld.kr (가입 → "API 인증키 발급")
//   2. .env에 추가: VWORLD_KEY=your_key_here
//   3. node --env-file=.env scripts/fetchSitePnu.mjs
//
// 출력: public/sites_real.json 의 각 사이트에 _pnu 필드 추가 + data/external/site_pnu_cache.json
// 주의:
//   - 무료 키 일일 호출 제한 (보통 1000~5000회). 사이트 6,918개 → 여러 날 분할 또는 유료 키
//   - 본 스크립트는 캐시(site_pnu_cache.json) 사용 → 중단 시 재실행하면 이어서 진행
//   - 좌표 → 주소 → PNU 변환을 단계별로 수행 (역지오코딩 + 지번 매칭)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const KEY = process.env.VWORLD_KEY
if (!KEY) {
  console.error('VWORLD_KEY 미설정. .env에 추가 후 재실행.')
  console.error('  발급: https://www.vworld.kr')
  process.exit(1)
}

const SITES_FILE = path.join(ROOT, 'public', 'sites_real.json')
const CACHE_FILE = path.join(ROOT, 'data', 'external', 'site_pnu_cache.json')

const sites = JSON.parse(fs.readFileSync(SITES_FILE, 'utf8'))
const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchPnuByLatLng(lat, lng) {
  // VWorld 좌표 → 지번 변환 API (역지오코딩 + parcel)
  const url = new URL('https://api.vworld.kr/req/address')
  url.searchParams.set('service', 'address')
  url.searchParams.set('request', 'getAddress')
  url.searchParams.set('version', '2.0')
  url.searchParams.set('crs', 'epsg:4326')
  url.searchParams.set('point', `${lng},${lat}`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('type', 'parcel')
  url.searchParams.set('zipcode', 'false')
  url.searchParams.set('simple', 'false')
  url.searchParams.set('key', KEY)

  const res = await fetch(url)
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const j = await res.json()
  if (j?.response?.status !== 'OK') return null
  const result = j.response.result?.[0]
  if (!result) return null
  // structure: { level4LC: "4159110100", level5: "27-2공" or "산100" } 등
  // PNU 19자리 = 법정동코드(10) + 산일반(1) + 본번(4) + 부번(4)
  const s = result.structure
  if (!s || !s.level4LC) return null
  const bjdCode = s.level4LC
  const level5 = String(s.level5 || '').trim()
  // "산100", "산 100-2" → 산지(2)
  // "27-2공", "100", "27-2" → 일반(1)
  const isMountain = /^산/.test(level5)
  const numPart = level5.replace(/^산\s*/, '').match(/^(\d+)(?:-(\d+))?/)
  if (!numPart) return null
  const sanIlban = isMountain ? '2' : '1'
  const main = String(numPart[1]).padStart(4, '0')
  const sub = numPart[2] ? String(numPart[2]).padStart(4, '0') : '0000'
  return bjdCode + sanIlban + main + sub
}

let processed = 0
let cached = 0
let fetched = 0
let failed = 0
let saveInterval = 0

for (const site of sites) {
  if (cache[site.id]) {
    site._pnu = cache[site.id]
    cached++
    continue
  }
  try {
    const pnu = await fetchPnuByLatLng(site.latitude, site.longitude)
    if (pnu) {
      cache[site.id] = pnu
      site._pnu = pnu
      fetched++
    } else {
      failed++
    }
  } catch (e) {
    failed++
    if (failed < 5) console.warn(`[!] ${site.id}: ${e.message}`)
  }
  processed++
  await sleep(150) // ~6 req/s, 무료 키 제한 회피
  if (++saveInterval % 50 === 0) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8')
    console.log(`  진행: ${processed}/${sites.length} (캐시 ${cached}, 신규 ${fetched}, 실패 ${failed})`)
  }
}

fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8')
console.log(`\n완료: 캐시 ${cached}, 신규 ${fetched}, 실패 ${failed}`)
console.log(`캐시: ${CACHE_FILE}`)
console.log(`ETL이 캐시를 읽어 site._pnu 필드에 자동 주입 — 다음 npm run etl 시 적용됨`)
