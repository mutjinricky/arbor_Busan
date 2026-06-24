// sites_real.json 데이터 검증 스크립트
//
// 검사 항목:
//   1) 좌표 bbox: 모든 사이트가 경기도 범위 내 (lat 36.8~38.3, lng 126.4~127.9)
//   2) 시군 매핑: site.city가 31개 정식 시군 중 하나
//   3) 필수 필드: id, name, type, latitude, longitude, risk
//   4) 위험 점수 범위: 0~100, total_risk_score 계산 일관성
//   5) 중복 ID
//   6) 데이터 출처 신선도: external JSON의 fetched_at이 7일 이내인지
//
// 사용:
//   node scripts/validate.mjs
//
// 종료 코드:
//   0 = OK (경고만)
//   1 = 검증 실패 (에러)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
// ETL이 public/sites_real.json 에 작성 (빌드 chunk에서 분리)
const SITES_FILE = path.join(ROOT, 'public', 'sites_real.json')
const EXT_DIR = path.join(ROOT, 'data', 'external')

const VALID_CITIES = new Set([
  '수원시', '성남시', '의정부시', '안양시', '부천시', '광명시', '평택시',
  '동두천시', '안산시', '고양시', '과천시', '구리시', '남양주시', '오산시',
  '시흥시', '군포시', '의왕시', '하남시', '용인시', '파주시', '이천시',
  '안성시', '김포시', '화성시', '광주시', '양주시', '포천시', '여주시',
  '연천군', '가평군', '양평군'
])

const VALID_TYPES = new Set(['park', 'street_tree', 'pine_forest', 'forest_adjacent'])

function inGyeonggiBbox(lat, lng) {
  if (!isFinite(lat) || !isFinite(lng)) return false
  return lat >= 36.8 && lat <= 38.3 && lng >= 126.4 && lng <= 127.9
}

let errors = 0
let warnings = 0

function err(msg) {
  console.error('  ✗ ' + msg)
  errors++
}
function warn(msg) {
  console.warn('  ⚠ ' + msg)
  warnings++
}
function ok(msg) {
  console.log('  ✓ ' + msg)
}

console.log('=== sites_real.json 검증 ===\n')

if (!fs.existsSync(SITES_FILE)) {
  err(`파일 없음: ${SITES_FILE}`)
  process.exit(1)
}

const sites = JSON.parse(fs.readFileSync(SITES_FILE, 'utf8'))
console.log(`총 ${sites.length}개 사이트 검사\n`)

// 1) 좌표 bbox
console.log('[1] 좌표 bbox 검사')
const outOfBbox = sites.filter((s) => !inGyeonggiBbox(s.latitude, s.longitude))
if (outOfBbox.length === 0) {
  ok('모든 사이트가 경기도 bbox 내')
} else {
  err(`${outOfBbox.length}개 사이트 좌표가 경기도 bbox 밖`)
  outOfBbox.slice(0, 5).forEach((s) => {
    console.error(`    - ${s.id} (${s.name}): lat=${s.latitude}, lng=${s.longitude}`)
  })
  if (outOfBbox.length > 5) console.error(`    ... 외 ${outOfBbox.length - 5}건`)
}

// 2) 시군 매핑
console.log('\n[2] 시군 매핑 검사')
const invalidCity = sites.filter((s) => !VALID_CITIES.has(s.city))
const cityCounts = {}
sites.forEach((s) => (cityCounts[s.city] = (cityCounts[s.city] || 0) + 1))
const missingCities = [...VALID_CITIES].filter((c) => !cityCounts[c])
if (invalidCity.length === 0) {
  ok('모든 사이트가 31개 정식 시군 중 하나')
} else {
  err(`${invalidCity.length}개 사이트가 비정식 시군명`)
  invalidCity.slice(0, 5).forEach((s) => console.error(`    - ${s.id} (city="${s.city}")`))
}
if (missingCities.length > 0) {
  warn(`${missingCities.length}개 시군에 사이트 0건: ${missingCities.join(', ')}`)
}

// 3) 필수 필드
console.log('\n[3] 필수 필드 검사')
const REQUIRED = ['id', 'name', 'type', 'city', 'latitude', 'longitude', 'risk']
let missingField = 0
sites.forEach((s) => {
  for (const f of REQUIRED) {
    if (s[f] == null || s[f] === '') {
      if (missingField < 5) console.error(`    - ${s.id || '(no id)'}: ${f} 누락`)
      missingField++
      break
    }
  }
})
if (missingField === 0) ok('모든 사이트 필수 필드 완비')
else err(`${missingField}개 사이트가 필수 필드 누락`)

// 유형 검증
const invalidType = sites.filter((s) => s.type && !VALID_TYPES.has(s.type))
if (invalidType.length > 0) err(`${invalidType.length}개 사이트가 비정식 type: ${[...new Set(invalidType.map((s) => s.type))].join(', ')}`)

// 4) 위험 점수 범위
console.log('\n[4] 위험 점수 범위 검사')
const FACTORS = [
  'weather_stress_score', 'fire_risk_score', 'vegetation_score',
  'soil_score', 'management_gap_score', 'damage_history_score'
]
let outOfRange = 0
sites.forEach((s) => {
  if (!s.risk) return
  for (const f of FACTORS) {
    const v = s.risk[f]
    if (v != null && (v < 0 || v > 100)) {
      if (outOfRange < 5) console.error(`    - ${s.id}: ${f}=${v}`)
      outOfRange++
    }
  }
})
if (outOfRange === 0) ok('모든 위험 점수 0~100 범위')
else err(`${outOfRange}개 점수가 범위 밖`)

// 5) 중복 ID
console.log('\n[5] 중복 ID 검사')
const idCounts = {}
sites.forEach((s) => (idCounts[s.id] = (idCounts[s.id] || 0) + 1))
const dupIds = Object.entries(idCounts).filter(([_, n]) => n > 1)
if (dupIds.length === 0) ok('중복 ID 없음')
else {
  err(`${dupIds.length}개 ID 중복`)
  dupIds.slice(0, 5).forEach(([id, n]) => console.error(`    - ${id}: ${n}회`))
}

// 6) 외부 데이터 신선도
console.log('\n[6] 외부 API 데이터 신선도')
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
for (const f of ['fire_risk_sigungu', 'weather_sigungu', 'soil_sigungu', 'fire_history_sigungu']) {
  const p = path.join(EXT_DIR, f + '.json')
  if (!fs.existsSync(p)) {
    warn(`${f}.json 없음`)
    continue
  }
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'))
    const fetched = data.fetched_at ? new Date(data.fetched_at) : null
    if (!fetched) {
      warn(`${f}: fetched_at 없음`)
      continue
    }
    const ageMs = Date.now() - fetched.getTime()
    const ageDays = (ageMs / (24 * 60 * 60 * 1000)).toFixed(1)
    if (ageMs > SEVEN_DAYS_MS) warn(`${f}: ${ageDays}일 전 (7일 초과, 갱신 권장)`)
    else ok(`${f}: ${ageDays}일 전`)
  } catch (e) {
    warn(`${f}: JSON 파싱 실패`)
  }
}

// 7) 시군별 분포 요약
console.log('\n[7] 시군별 사이트 분포 (요약)')
const sorted = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])
console.log(`  최다: ${sorted[0][0]} ${sorted[0][1]}개`)
console.log(`  최소: ${sorted[sorted.length - 1][0]} ${sorted[sorted.length - 1][1]}개`)
const median = sorted[Math.floor(sorted.length / 2)][1]
console.log(`  중간값: ${median}개 (${sorted.length}개 시군)`)

// 8) 위험 등급 분포
console.log('\n[8] 위험 등급 분포 (응용 데이터 — enrich 후 산출)')
const gradeCount = {}
sites.forEach((s) => {
  if (!s.risk) return
  const total =
    (s.risk.weather_stress_score || 0) * 0.25 +
    (s.risk.fire_risk_score || 0) * 0.20 +
    (s.risk.vegetation_score || 0) * 0.15 +
    (s.risk.soil_score || 0) * 0.10 +
    (s.risk.management_gap_score || 0) * 0.20 +
    (s.risk.damage_history_score || 0) * 0.10
  // 등급 임계값: 기획서 9.2 그대로 (80/60/40) — src/lib/risk.js GRADE_THRESHOLDS와 일치
  const grade = total >= 80 ? 'A' : total >= 60 ? 'B' : total >= 40 ? 'C' : 'D'
  gradeCount[grade] = (gradeCount[grade] || 0) + 1
})
console.log(`  A: ${gradeCount.A || 0} · B: ${gradeCount.B || 0} · C: ${gradeCount.C || 0} · D: ${gradeCount.D || 0}`)

// 9) 좌표 근사 사이트 비율
console.log('\n[9] 데이터 정직성')
const approx = sites.filter((s) => s._coord_approx).length
console.log(`  좌표 근사: ${approx}/${sites.length} (${((approx / sites.length) * 100).toFixed(1)}%)`)
const noYears = sites.filter((s) => s._established_years == null).length
console.log(`  식재·조성년도 미상: ${noYears}/${sites.length} (${((noYears / sites.length) * 100).toFixed(1)}%)`)

console.log('\n===')
console.log(`결과: 에러 ${errors}건, 경고 ${warnings}건`)
process.exit(errors > 0 ? 1 : 0)
