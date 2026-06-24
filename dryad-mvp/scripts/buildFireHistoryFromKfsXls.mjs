// 산림청 "예년(16~25)산불피해대장.xls" → data/external/fire_history_sigungu.json
//
// 산림청 산불통계 원본(10년치 개별 산불 사건)에서 부산광역시 행만 추출,
// 구·군 단위로 합산하여 구·군별 실측치 산출. 기존 산림율 추정 데이터를 대체.
//
// 사용:
//   node scripts/buildFireHistoryFromKfsXls.mjs

import XLSX from 'xlsx'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DISTRICT_NAMES, normalizeCity } from '../src/data/busanRegion.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// 입력 파일 후보 경로 (public_data 또는 저장소 raw 폴더)
const XLS_CANDIDATES = [
  'c:/Users/kangh/Busan_mvp/public_data/예년(16~25)산불피해대장.xls',
  path.join(ROOT, 'data', 'raw', '예년(16~25)산불피해대장.xls'),
  path.join(ROOT, 'data', 'source-csv', '예년(16~25)산불피해대장.xls')
]

const xlsPath = XLS_CANDIDATES.find((p) => fs.existsSync(p))
if (!xlsPath) {
  console.error('산불피해대장.xls 파일을 찾을 수 없음. 다음 경로 중 하나에 두세요:')
  XLS_CANDIDATES.forEach((p) => console.error('  ' + p))
  process.exit(1)
}
console.log('입력:', xlsPath)

const OUT_FILE = path.join(ROOT, 'data', 'external', 'fire_history_sigungu.json')

// 부산 16개 정식 구·군 (busanRegion.js)
const VALID_CITIES = DISTRICT_NAMES
// 구·군명 정규화는 busanRegion.normalizeCity 사용 ("부산 해운대"·"해운대구"·"해운대" → "해운대구")

const wb = XLSX.readFile(xlsPath)
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
// 헤더는 2행, 실데이터는 3행부터
const data = rows.slice(3)

const PERIOD_YEARS = 10 // 2016~2025
let totalCount = 0
let totalArea = 0
const byCity = {}
const unmapped = {}

for (const r of data) {
  const sido = String(r[10]).trim()
  if (!sido.includes('부산')) continue
  const cityRaw = String(r[11]).trim()
  const city = normalizeCity(cityRaw)
  const area = Number(r[17] || 0)
  if (!city) {
    unmapped[cityRaw] = (unmapped[cityRaw] || 0) + 1
    continue
  }
  if (!byCity[city]) byCity[city] = { count: 0, area: 0 }
  byCity[city].count++
  byCity[city].area += isFinite(area) ? area : 0
  totalCount++
  totalArea += isFinite(area) ? area : 0
}

console.log(`부산광역시 총 ${totalCount}건 산불 (10년) · 누적 피해면적 ${totalArea.toFixed(1)}ha`)
console.log(`연평균 ${(totalCount / PERIOD_YEARS).toFixed(1)}건/년 · ${(totalArea / PERIOD_YEARS).toFixed(1)}ha/년`)
if (Object.keys(unmapped).length > 0) {
  console.warn('미매핑 시군구:', unmapped)
}
const missingCity = VALID_CITIES.filter((c) => !byCity[c])
if (missingCity.length > 0) {
  console.warn(`산불 0건 시군 (${missingCity.length}개): ${missingCity.join(', ')}`)
}

// 점수 산식: 시군 변별력 확보용
// 양평(최다, ~12.8건/년)이 ~80점, 부천(최소, ~0.2건/년)이 ~15점 floor가 되도록.
// score = max(15, min(85, count_yr × 6 + area_ha_yr × 0.8))
function calcScore(countYr, areaHaYr) {
  const raw = countYr * 6 + areaHaYr * 0.8
  return Math.max(15, Math.min(85, Math.round(raw)))
}

const bySigun = {}
for (const c of VALID_CITIES) {
  const v = byCity[c] || { count: 0, area: 0 }
  const countYr = v.count / PERIOD_YEARS
  const areaHaYr = v.area / PERIOD_YEARS
  bySigun[c] = {
    score: calcScore(countYr, areaHaYr),
    count_yr: Math.round(countYr * 10) / 10,
    area_ha_yr: Math.round(areaHaYr * 100) / 100,
    count_10yr_total: v.count,
    area_10yr_total_ha: Math.round(v.area * 100) / 100,
    source: '산림청 산불피해대장 2016~2025 (실측)'
  }
}

const out = {
  _summary: `부산 16개 구·군 10년 실측 (총 ${totalCount}건, ${totalArea.toFixed(1)}ha)`,
  fetched_at: new Date().toISOString(),
  source: '산림청 산불피해대장 (예년 2016~2025)',
  source_file: path.basename(xlsPath),
  source_url: 'https://www.forest.go.kr/',
  note:
    '✅ 시도 단위 KOSIS 통계가 아닌 산림청 산불피해대장 원본(개별 산불 사건) 구·군별 집계.',
  granularity: 'sigungu_actual',
  reference_year: '2025',
  average_period: '2016-2025 (10년)',
  busan_totals: {
    count_2025: null,
    area_2025_ha: null,
    count_10yr_total: totalCount,
    area_10yr_total_ha: Math.round(totalArea * 100) / 100,
    count_10yr_avg: Math.round((totalCount / PERIOD_YEARS) * 10) / 10,
    area_10yr_avg_ha: Math.round((totalArea / PERIOD_YEARS) * 10) / 10
  },
  score_formula:
    'score = max(15, min(85, count_yr × 6 + area_ha_yr × 0.8)) — 시군 변별력 확보용 정규화',
  by_sigun: bySigun
}

fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8')
console.log(`\n생성: ${OUT_FILE}`)
console.log(`시군별 점수 (상위 5):`)
Object.entries(bySigun)
  .sort((a, b) => b[1].score - a[1].score)
  .slice(0, 5)
  .forEach(([c, v]) =>
    console.log(`  ${c.padEnd(8)} score=${v.score}  ${v.count_yr}건/년  ${v.area_ha_yr}ha/년`)
  )
console.log(`시군별 점수 (하위 5):`)
Object.entries(bySigun)
  .sort((a, b) => a[1].score - b[1].score)
  .slice(0, 5)
  .forEach(([c, v]) =>
    console.log(`  ${c.padEnd(8)} score=${v.score}  ${v.count_yr}건/년  ${v.area_ha_yr}ha/년`)
  )
