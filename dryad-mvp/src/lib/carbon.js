// 사이트별 연간 탄소 흡수량 추정 (tCO2/year) + 고사 예방 탄소 보전 추정
//
// [면적 기반 — 산림·소나무숲·도시공원 폴리곤]
//   산림청 국립산림과학원 「도시숲 탄소흡수량 추정 기준」
//   - 침엽수림: 5.4 / 활엽수림: 7.5 / 혼효림: 6.5 tCO2/ha/yr
//   ※ calibration 주의(조현길팀 직접실측): 수변녹지 1.7 tC/ha(≈6.2 tCO2, 위와 근접) ·
//     희소 civic 녹지 0.65 tC/ha(≈2.4 tCO2). 식재밀도 낮은 도시녹지엔 위 ha계수가 다소 높을 수 있음.
//
// [단목 기반 — 가로수] 국내 가로수 실측 논문으로 교정 (docs/개별수목 탄소 자료_*)
//   - net(관리배출 제외) 0.0202 tCO2/그루/yr = 5.5 kgC × 3.67  (Kim & Jo 2022, 한국 8개 도시 / 논문 15)
//   - gross(격리)       0.0254 tCO2/그루/yr = 6.93 kgC × 3.67 (Na·Lee·Kim 2022, 수원 i-Tree Eco / 논문 21)
//   - 제3 확증: 조현길팀 직접수확법(향토수종) 이팝나무 DBH10cm = 연 5.9 kgC ≈ 0.0217 tCO2 → 위 범위로 수렴.
//   ※ 종전 1.4 tCO2/그루는 ha 계수 오용으로 추정(국내 실측 대비 약 50~70배 과대) → 단목 실측값으로 교정.
//
// [고사 예방 탄소 보전] 고사율을 낮추면 흡수능력 손실을 회피한다(자료 11장).
//   - 식재 확대보다 고사율 저감이 탄소수지에 더 결정적 (Smith 2019 / 논문 7)
//   - 고사율 3.6%(생존율 96.4%)가 10년 후 편익 손익분기선 (Widney 2016)
//
// 한계: 흉고직경·수령·영급 미반영. 정밀화 단계 = DBH(최우선, Lin·Kroll·Nowak 2020 / 논문 5)
//      → 활력도(_vitality_grade) → 수관 광노출 순. AGB·BGB·TB 산식(a·(DBH²·H)^b)으로 고도화.

const CONIFER_KEYWORDS = [
  '소나무',
  '곰솔',
  '해송',
  '잣나무',
  '리기다',
  '편백',
  '화백',
  '측백',
  '주목',
  '향나무',
  '메타세쿼이아',
  '메타세콰이아',
  '메타쉐쿼이어',
  '메타세콰이어',
  '낙엽송',
  '잎갈나무',
  '대왕송',
  '반송',
  '눈주목'
]
const BROADLEAF_KEYWORDS = [
  '은행',
  '느티',
  '벚',
  '왕벚',
  '이팝',
  '단풍',
  '버즘',
  '플라타너스',
  '플라타나스',
  '버드',
  '능수버들',
  '수양',
  '무궁화',
  '배롱',
  '아카시',
  '아까시',
  '참나무',
  '갈참',
  '신갈',
  '굴참',
  '졸참',
  '떡갈',
  '상수리',
  '느릅',
  '회화',
  '튤립',
  '튜울립',
  '백합나무',
  '오리',
  '자작',
  '팽',
  '대왕참',
  '핀오크',
  '칠엽수',
  '마로니에',
  '미루나무',
  '포플러'
]

function speciesType(mainSpecies) {
  if (!mainSpecies) return 'mixed'
  const first = String(mainSpecies)
    .split(/[+,/]/)[0]
    .trim()
  for (const k of CONIFER_KEYWORDS) {
    if (first.includes(k)) return 'conifer'
  }
  for (const k of BROADLEAF_KEYWORDS) {
    if (first.includes(k)) return 'broadleaf'
  }
  return 'mixed'
}

const ABSORPTION_TCO2_PER_HA = {
  conifer: 5.4,
  broadleaf: 7.5,
  mixed: 6.5
}
// 단목 연간 격리량 — 국내 가로수 실측 (위 헤더 주석 근거)
export const TCO2_PER_STREET_TREE_NET = 0.0202 // Kim & Jo 2022 (보수적 기본값)
export const TCO2_PER_STREET_TREE_GROSS = 0.0254 // Na·Lee·Kim 2022 (수원 i-Tree)
const TCO2_PER_STREET_TREE = TCO2_PER_STREET_TREE_NET
const STREET_TREE_SPACING_M = 10 // 가로수 평균 간격

// 성목 1주 탄소축적 증가분(gross) — 라이다 직접 실측 참고치 (논문 20)
//   Yang 2025 수원 MMS: 중앙값 27.1 kgC/주/yr = 0.0995 tCO2 (DBH 실측 1.4cm/yr + 수종별 상대생장식).
//   ※ 차량 접근 도로의 '성목 중앙값'이라 어린나무 포함 전체 합산 기본값으로는 과대(약 4배).
//      따라서 합산 흡수량에는 쓰지 않고, '성목 1주 잠재' 참고치로만 노출한다.
export const KGC_PER_MATURE_TREE_LIDAR = 27.1
export const TCO2_PER_MATURE_TREE_LIDAR = 0.0995

// ─── 연간 고사율(mortality) 파라미터 — 도시수목 mortality 문헌 (docs/papers) ───
// 생애단계를 먼저 분리하는 것이 문헌 공통 권고. 출처:
//   - 기정착(established) baseline: 독일 95.9만 그루 cadaster (Parhizgar 2025)
//       활엽 1.3% · 침엽 2.2% · 가로수 평균 1.4% (크기 클수록 활엽 사망률↓)
//   - 신규식재(establishment) cohort: Hilbert 2019 리뷰 (코호트 4.4~6.5%),
//       Florida·NYC cohort — 관리 부실 5~10% · 정착관리 양호 1~4%
const MORTALITY_ESTABLISHED = { broadleaf: 0.013, conifer: 0.022, mixed: 0.014 }
const MORTALITY_NEWLY_PLANTED = 0.06 // 신규식재 코호트 전형 (Hilbert 4.4~6.5% 상단)
const ESTABLISHMENT_YEARS = 5 // 식재 후 정착기로 보는 기간 (문헌 공통 3~5년)

// 도시숲표준지 고사율 등급(1~5, 1=최상)→ 연간 고사율. 상대 건강등급을 절대값에 매핑.
//   등급1≈기정착 활엽 baseline(1.3%) · 등급2≈침엽 baseline(2.2%) · 등급3≈US 가로수 전형(3.6%)
//   · 등급4≈정착코호트 상단(6%) · 등급5≈가혹지 상한(8%, Nyelele 2019 Bronx)
const MORTALITY_RATE_BY_GRADE = { 1: 0.013, 2: 0.022, 3: 0.036, 4: 0.06, 5: 0.08 }

// 관수·정착관리(establishment management) 적용 시 사망률 multiplier.
//   Boyce 2011(stewardship 0.30)·Koeser 2014(관수 0.09~0.43) → 보수적 중앙값 0.40 (range 0.25~0.60).
//   "무엇을 바르거나 주입하는 것"(비료 0.95~1.05·전정 ≈1.0)보다 생존 효과가 가장 크고 반복 검증됨.
const STEWARDSHIP_MULTIPLIER = 0.4

/**
 * 단일 사이트의 연간 탄소 흡수량 추정 (tCO2/yr).
 * 면적 또는 길이 정보가 없으면 0.
 */
export function estimateAnnualCarbon(site) {
  if (!site) return 0
  const type = speciesType(site.main_species)
  if (site.type === 'street_tree') {
    if (!site.length_m || site.length_m <= 0) return 0
    const treeCount = site.length_m / STREET_TREE_SPACING_M
    return treeCount * TCO2_PER_STREET_TREE
  }
  // 도시공원·소나무숲·산림인접지: 면적 기반
  if (!site.area_m2 || site.area_m2 <= 0) return 0
  const ha = site.area_m2 / 10000
  const rate = ABSORPTION_TCO2_PER_HA[type] ?? ABSORPTION_TCO2_PER_HA.mixed
  // 도시공원은 관리 보정 +10%
  const adjustment = site.type === 'park' ? 1.1 : 1.0
  return ha * rate * adjustment
}

/**
 * 가로수 사이트의 '성목 1주 잠재 흡수' 참고치 (라이다 직접 실측, Yang 2025).
 * 전체 평균이 아닌 성목 상한 참고용 — 합산 흡수량 계산에는 쓰지 않는다.
 * @returns {{ perTreeKgc:number, perTreeTco2:number, treeCount:number, siteTco2:number } | null}
 */
export function matureTreePotential(site) {
  if (!site || site.type !== 'street_tree') return null
  if (!site.length_m || site.length_m <= 0) return null
  const treeCount = site.length_m / STREET_TREE_SPACING_M
  return {
    perTreeKgc: KGC_PER_MATURE_TREE_LIDAR,
    perTreeTco2: TCO2_PER_MATURE_TREE_LIDAR,
    treeCount,
    siteTco2: treeCount * TCO2_PER_MATURE_TREE_LIDAR
  }
}

/**
 * 사이트 배열 합계 (tCO2/yr).
 */
export function totalAnnualCarbon(sites) {
  return sites.reduce((sum, s) => sum + estimateAnnualCarbon(s), 0)
}

/**
 * 사이트의 연간 고사율(0~1)과 데이터 출처를 반환.
 * 우선순위: 도시숲표준지 고사율 등급(real) > 생애단계·수종군 baseline(simulation).
 *   - 신규식재(식재 후 ESTABLISHMENT_YEARS 이내): 정착코호트 전형
 *   - 기정착: 수종군별(침엽 2.2% / 활엽 1.3% / 혼효 1.4%, Parhizgar 2025)
 */
export function siteMortalityRate(site) {
  const g = site?._mortality_grade
  if (g != null && MORTALITY_RATE_BY_GRADE[g] != null) {
    return { rate: MORTALITY_RATE_BY_GRADE[g], source: 'real' }
  }
  const age = site?._established_years
  if (age != null && age <= ESTABLISHMENT_YEARS) {
    return { rate: MORTALITY_NEWLY_PLANTED, source: 'simulation' }
  }
  const type = speciesType(site?.main_species)
  return {
    rate: MORTALITY_ESTABLISHED[type] ?? MORTALITY_ESTABLISHED.mixed,
    source: 'simulation'
  }
}

/**
 * 고사 예방으로 보전되는 탄소량 추정.
 *
 * 관수·정착관리(establishment management) 적용 시 사망률이 현재의 약 40%로 감소한다는
 * 문헌 근거(Boyce 2011·Koeser 2014, multiplier 0.25~0.60)를 목표 고사율에 적용한다.
 * years년 후 추가로 유지되는 흡수능력 비율 = (1-목표)^y - (1-현재)^y 를
 * 현재 연간 흡수량에 곱해 "years년 후 유지되는 추가 연간 흡수량(tCO2/yr)"을 얻는다.
 * 식재 확대보다 고사율 저감이 탄소수지에 더 결정적이라는 Smith(2019) 근거와 직결.
 *
 * @returns {{ annual:number, currentRate:number, targetRate:number, years:number, source:string }}
 */
export function estimateAvoidedCarbonLoss(
  site,
  { years = 10, multiplier = STEWARDSHIP_MULTIPLIER } = {}
) {
  const annual = estimateAnnualCarbon(site)
  const { rate, source } = siteMortalityRate(site)
  const targetRate = rate * multiplier
  const empty = { annual: 0, currentRate: rate, targetRate, years, source }
  if (!annual || rate <= targetRate) return empty
  const retainedFraction =
    Math.pow(1 - targetRate, years) - Math.pow(1 - rate, years)
  return {
    annual: annual * Math.max(0, retainedFraction),
    currentRate: rate,
    targetRate,
    years,
    source
  }
}

/**
 * 사이트 배열의 고사 예방 보전량 합계 (years년 후 유지되는 추가 연간 tCO2/yr).
 */
export function totalAvoidedCarbonLoss(sites, opts) {
  return sites.reduce(
    (sum, s) => sum + estimateAvoidedCarbonLoss(s, opts).annual,
    0
  )
}

/**
 * 표시용 포맷 (만톤·천톤·톤 자동 단위).
 */
export function formatCarbon(tco2) {
  if (tco2 == null || !isFinite(tco2)) return '-'
  if (tco2 >= 10000) {
    return (tco2 / 10000).toFixed(1) + '만 tCO₂'
  }
  if (tco2 >= 1000) {
    return (tco2 / 1000).toFixed(1) + '천 tCO₂'
  }
  if (tco2 >= 1) {
    return Math.round(tco2).toLocaleString() + ' tCO₂'
  }
  return tco2.toFixed(2) + ' tCO₂'
}

/**
 * 직관적 비유 (자동차 연간 배출량 환산).
 *   승용차 1대 연간 평균 배출량 ≈ 2.4 tCO2 (환경부 기준)
 */
export function carbonAsCarsEquivalent(tco2) {
  if (!tco2 || tco2 <= 0) return null
  return Math.round(tco2 / 2.4)
}
