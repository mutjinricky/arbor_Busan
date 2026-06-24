// 수목진료 표준품셈 (2025.6, 산림청) + 건설공사 표준품셈 (2026) 기반 예산 산정.
// 사이트의 규모(_tree_count, area_m2, _mean_dbh_cm)에 따라
//   노무량 × 노임단가 + 자재 + 장비 + 간접비를 곱하여
//   사이트별 추정 예산을 산출한다.
//
// 출처:
//   - 산림청 수목진료 표준품셈 (2025.6.) — formula/ 폴더 PDF
//     §1.4 노임단가, §1.5 품의 할증,
//     §2-1 병해충 방제제 살포 (100L당 + 그루당 살포약량 2D표),
//     §2-3-1 토양 관주처리, §2-5-1 토양물리성 개선,
//     §2-8-2 낙엽활엽수 수관솎기, §2-8-3 고사목 및 위험목 제거,
//     §1-1 진단 (일반/정밀)
//   - 건설공사 표준품셈 (2026) — §4-2-2 조경 식재 단식

// ═══════════════════════════════════════════════════
// §1. 단가
// ═══════════════════════════════════════════════════

// 노임단가 (§1.4, 2025년 기준, 원/일)
const RATE = {
  나무의사: 319_646,
  수목치료기술자: 233_543,
  // 대한건설협회 시중노임 (2025년 기준 추정, 2024년 172,662원 → 약 4% 상승 추세).
  // ⚠️ 정확한 값은 대한건설협회 「건설업 임금실태 조사보고서」 공표값으로 교체 권장.
  보통인부: 180_000,
  // 장비 시간당 단가 = 손료(취득가격×계수×10⁻⁷) + 운전경비(인건비+연료+소모품)
  // 건설공사 표준품셈 §8장 기계경비산정표 기반.
  // 고소작업차 3ton(§2106): 손료 ~13,000 + 운전경비 ~67,000 = ~80,000/hr
  고소작업차_hr: 80_000,
  // 동력분무기 4.85kW(§7210): 손료 ~560 + 운전경비 ~4,400 = ~5,000/hr
  동력분무기_hr: 5_000,
  // 살수차 3,800L(§7204): 손료 ~3,200 + 운전경비 ~32,000 = ~35,000/hr
  방제차량_hr: 35_000
}

// 자재 단가 (원)
const MATERIAL = {
  토양개량제_kg: 800,
  방제제_L: 5_000
}

// ═══════════════════════════════════════════════════
// §1.5 품의 할증 (수목 높이별 노무량 가산)
// ═══════════════════════════════════════════════════
// 고소작업차 사용 기준 — 대부분 도시 가로수/공원 작업은 고소작업차 동반
const HEIGHT_SURCHARGE = [
  [5,   0],      // 5m 미만: 할증 없음
  [10,  0.02],   // 5m~10m: +2%
  [20,  0.04],   // 10m~20m: +4%
  [30,  0.06],   // 20m~30m: +6%
  [9999, 0.08]   // 30m+: +8% (매 10m +2% 가산 간소화)
]

function estimateTreeHeight(dbhCm) {
  if (dbhCm <= 10) return 4
  if (dbhCm <= 20) return 7
  if (dbhCm <= 30) return 10
  if (dbhCm <= 40) return 13
  if (dbhCm <= 60) return 16
  if (dbhCm <= 80) return 19
  return 22
}

function heightSurchargeRate(heightM) {
  for (const [maxH, rate] of HEIGHT_SURCHARGE) {
    if (heightM <= maxH) return rate
  }
  return 0.08
}

// ═══════════════════════════════════════════════════
// 간접비 비율 (§1-1 진단 산식 / 각 표 주석)
// ═══════════════════════════════════════════════════
const OVERHEAD = {
  잡재료비_pct: 0.02,
  공구손료_pct: 0.03,
  일반관리비_pct: 0.06,
  이윤_pct: 0.10,
  부가세_pct: 0.10
}

// ═══════════════════════════════════════════════════
// §2-8-2 낙엽활엽수 수관솎기 (전정, 그루당)
// PDF p.32 전체 29개 구간 (흉고직경 20cm ~ 250cm)
// ═══════════════════════════════════════════════════
const PRUNING_TABLE = [
  [20,   { 나무의사: 0.017, 수목치료기술자: 0.382, 보통인부: 0.096, 고소작업차_hr: 0.72 }],
  [25,   { 나무의사: 0.021, 수목치료기술자: 0.489, 보통인부: 0.121, 고소작업차_hr: 0.76 }],
  [30,   { 나무의사: 0.026, 수목치료기술자: 0.596, 보통인부: 0.148, 고소작업차_hr: 0.89 }],
  [35,   { 나무의사: 0.035, 수목치료기술자: 0.787, 보통인부: 0.198, 고소작업차_hr: 1.45 }],
  [40,   { 나무의사: 0.037, 수목치료기술자: 0.843, 보통인부: 0.211, 고소작업차_hr: 2.05 }],
  [45,   { 나무의사: 0.039, 수목치료기술자: 0.894, 보통인부: 0.228, 고소작업차_hr: 2.11 }],
  [50,   { 나무의사: 0.045, 수목치료기술자: 1.023, 보통인부: 0.247, 고소작업차_hr: 2.35 }],
  [55,   { 나무의사: 0.061, 수목치료기술자: 1.158, 보통인부: 0.294, 고소작업차_hr: 2.65 }],
  [60,   { 나무의사: 0.078, 수목치료기술자: 1.265, 보통인부: 0.328, 고소작업차_hr: 3.16 }],
  [65,   { 나무의사: 0.085, 수목치료기술자: 1.372, 보통인부: 0.382, 고소작업차_hr: 3.66 }],
  [70,   { 나무의사: 0.105, 수목치료기술자: 1.479, 보통인부: 0.396, 고소작업차_hr: 3.97 }],
  [75,   { 나무의사: 0.133, 수목치료기술자: 1.586, 보통인부: 0.430, 고소작업차_hr: 4.47 }],
  [80,   { 나무의사: 0.145, 수목치료기술자: 1.721, 보통인부: 0.476, 고소작업차_hr: 4.74 }],
  [90,   { 나무의사: 0.158, 수목치료기술자: 1.953, 보통인부: 0.534, 고소작업차_hr: 5.01 }],
  [100,  { 나무의사: 0.174, 수목치료기술자: 2.152, 보통인부: 0.592, 고소작업차_hr: 5.28 }],
  [110,  { 나무의사: 0.192, 수목치료기술자: 2.375, 보통인부: 0.660, 고소작업차_hr: 5.45 }],
  [120,  { 나무의사: 0.210, 수목치료기술자: 2.597, 보통인부: 0.728, 고소작업차_hr: 5.62 }],
  [130,  { 나무의사: 0.229, 수목치료기술자: 2.831, 보통인부: 0.784, 고소작업차_hr: 5.74 }],
  [140,  { 나무의사: 0.238, 수목치료기술자: 3.042, 보통인부: 0.854, 고소작업차_hr: 5.98 }],
  [150,  { 나무의사: 0.247, 수목치료기술자: 3.147, 보통인부: 0.889, 고소작업차_hr: 6.10 }],
  [160,  { 나무의사: 0.255, 수목치료기술자: 3.252, 보통인부: 0.920, 고소작업차_hr: 6.22 }],
  [170,  { 나무의사: 0.264, 수목치료기술자: 3.357, 보통인부: 1.386, 고소작업차_hr: 6.34 }],
  [180,  { 나무의사: 0.272, 수목치료기술자: 3.463, 보통인부: 1.438, 고소작업차_hr: 6.46 }],
  [190,  { 나무의사: 0.281, 수목치료기술자: 3.568, 보통인부: 1.491, 고소작업차_hr: 6.58 }],
  [200,  { 나무의사: 0.289, 수목치료기술자: 3.676, 보통인부: 1.597, 고소작업차_hr: 6.70 }],
  [210,  { 나무의사: 0.297, 수목치료기술자: 3.787, 보통인부: 1.653, 고소작업차_hr: 6.82 }],
  [220,  { 나무의사: 0.305, 수목치료기술자: 3.901, 보통인부: 1.711, 고소작업차_hr: 6.94 }],
  [230,  { 나무의사: 0.313, 수목치료기술자: 4.018, 보통인부: 1.771, 고소작업차_hr: 7.06 }],
  [9999, { 나무의사: 0.329, 수목치료기술자: 4.139, 보통인부: 1.833, 고소작업차_hr: 7.18 }]  // 241~250+
]

// ═══════════════════════════════════════════════════
// §2-8-3 고사목 및 위험목 제거 (그루당)
// 장비 + 인력 노무량 합산. + 고소작업차(Note 10: §2-8-2 장비 시간 적용)
// ═══════════════════════════════════════════════════
const REMOVAL_TABLE = [
  [20,   { 나무의사: 0.064 + 0.304, 수목치료기술자: 0.143 + 0.741, 보통인부: 0.018 + 0.190, 고소작업차_hr: 0.72 }],
  [30,   { 나무의사: 0.152 + 0.644, 수목치료기술자: 0.364 + 1.339, 보통인부: 0.046 + 0.342, 고소작업차_hr: 0.89 }],
  [40,   { 나무의사: 0.304 + 0.912, 수목치료기술자: 0.741 + 2.223, 보통인부: 0.094 + 0.570, 고소작업차_hr: 2.05 }],
  [50,   { 나무의사: 0.456 + 1.368, 수목치료기술자: 1.105 + 3.328, 보통인부: 0.142 + 0.854, 고소작업차_hr: 2.35 }],
  [60,   { 나무의사: 0.760 + 1.976, 수목치료기술자: 1.836 + 4.810, 보통인부: 0.224 + 1.234, 고소작업차_hr: 3.16 }],
  [70,   { 나무의사: 1.824 + 2.736, 수목치료기술자: 4.446 + 6.669, 보통인부: 0.570 + 1.710, 고소작업차_hr: 3.97 }],
  [80,   { 나무의사: 2.184 + 3.032, 수목치료기술자: 5.317 + 7.397, 보통인부: 0.656 + 1.896, 고소작업차_hr: 4.74 }],
  [90,   { 나무의사: 2.608 + 3.360, 수목치료기술자: 6.357 + 8.203, 보통인부: 0.754 + 2.100, 고소작업차_hr: 5.01 }],
  [9999, { 나무의사: 3.200 + 3.760, 수목치료기술자: 7.605 + 9.035, 보통인부: 0.866 + 2.330, 고소작업차_hr: 5.28 }]  // 91~100+
]

// ═══════════════════════════════════════════════════
// §2-1 병해충 방제제 살포 — 그루당 살포약량 (DBH 기준, 평균 수고 가정)
// PDF p.18 2D 표(흉고경×수고)를 DBH 1D 테이블로 간소화.
// 각 DBH에 대해 평균 수고를 가정(estimateTreeHeight)하여 대표값 추출.
// ═══════════════════════════════════════════════════
const SPRAY_VOLUME_L = [
  [10,  12],    // DBH≤10cm, 수고~6m → ~12L
  [15,  30],    // 수고~8m
  [20,  60],    // 수고~9m
  [25,  100],   // 수고~10m
  [30,  150],   // 수고~12m
  [35,  210],   // 수고~13m
  [40,  300],   // 수고~14m
  [50,  500],   // 수고~16m
  [60,  700],   // 수고~18m
  [70,  960],   // 수고~19m
  [80,  1200],  // 수고~20m
  [9999, 1500]  // 81+
]

// ═══════════════════════════════════════════════════
// §4-3-5 교목 식재 (건설공사 표준품셈 2026, 흉고직경 기준)
// 기계시공 소형: 조경공 3 + 보통인부 1 + 굴착기(0.4m³)
// 기계시공 대형: 조경공 3 + 보통인부 1 + 굴착기(0.6m³) + 크레인
// 그루당 노무량 = 직종인원 / 시공량(주/일)
// ═══════════════════════════════════════════════════
const PLANTING_TABLE = [
  // 기계시공 소형 (조경공 3 + 보통인부 1)
  [6,   { 조경공: 3 / 45, 보통인부: 1 / 45 }],  // ≤5(6)cm: 45주/일
  [8,   { 조경공: 3 / 22, 보통인부: 1 / 22 }],  // 6~7(7~8)cm: 22주/일
  [11,  { 조경공: 3 / 17, 보통인부: 1 / 17 }],  // 8~9(9~11)cm: 17주/일
  [20,  { 조경공: 3 / 12, 보통인부: 1 / 12 }],  // 10~17(12~20)cm: 12주/일
  // 기계시공 대형 (조경공 3 + 보통인부 1 + 대형장비)
  [29,  { 조경공: 3 / 9,  보통인부: 1 / 9 }],   // 18~24(21~29)cm: 9주/일
  [41,  { 조경공: 3 / 7,  보통인부: 1 / 7 }],   // 25~34(30~41)cm: 7주/일
  [53,  { 조경공: 3 / 5,  보통인부: 1 / 5 }],   // 35~44(42~53)cm: 5주/일
  [9999, { 조경공: 3 / 4,  보통인부: 1 / 4 }]    // 45~50(54~60)cm+: 4주/일
]
// 조경공 일당 (대한건설협회 시중노임 2025 추정, ⚠️ 교체 필요)
const RATE_조경공 = 235_000
// DBH 21cm+ 대형 식재 시 굴착기(0.6m³) + 크레인 장비비 추가 (시간당)
const PLANTING_EQUIP_HR = 150_000  // 굴착기+크레인 합계 시간당 추정
// 묘목 가격 (조달청 단가 기준 추정, 규격별)
const STOCK_PRICE = [
  [8,   20_000],
  [12,  45_000],
  [17,  80_000],
  [25,  150_000],
  [35,  280_000],
  [9999, 450_000]  // 36+
]

// ═══════════════════════════════════════════════════
// 유틸
// ═══════════════════════════════════════════════════

function lookupByDbh(table, dbhCm) {
  for (const [maxDbh, rates] of table) {
    if (dbhCm <= maxDbh) return rates
  }
  return table[table.length - 1][1]
}

function lookupScalar(table, key) {
  for (const [maxKey, val] of table) {
    if (key <= maxKey) return val
  }
  return table[table.length - 1][1]
}

function laborCost(qty) {
  let cost = 0
  for (const role of ['나무의사', '수목치료기술자', '보통인부']) {
    cost += (qty[role] || 0) * RATE[role]
  }
  return cost
}

function equipmentCost(qty) {
  let cost = 0
  for (const eq of ['고소작업차_hr', '동력분무기_hr', '방제차량_hr']) {
    cost += (qty[eq] || 0) * RATE[eq]
  }
  return cost
}

function applyOverhead(laborWon, materialWon, equipmentWon) {
  const 잡재료비 = materialWon * OVERHEAD.잡재료비_pct
  const 공구손료 = laborWon * OVERHEAD.공구손료_pct
  const 소계 = laborWon + materialWon + equipmentWon + 잡재료비 + 공구손료
  const 일반관리비 = 소계 * OVERHEAD.일반관리비_pct
  const 이윤 = (소계 + 일반관리비) * OVERHEAD.이윤_pct
  const 공급가액 = 소계 + 일반관리비 + 이윤
  const 부가세 = 공급가액 * OVERHEAD.부가세_pct
  return Math.round(공급가액 + 부가세)
}

// ═══════════════════════════════════════════════════
// 사이트 규모 추정
// ═══════════════════════════════════════════════════

function siteScale(site) {
  let treeCount = site._tree_count || 0
  let meanDbh = site._mean_dbh_cm || 0
  let area = site.area_m2 || 0

  if (treeCount === 0) {
    if (site.type === 'park' && area > 0) {
      treeCount = Math.max(10, Math.round(area / 100))
    } else if (site.type === 'pine_forest') {
      const ha = area > 0 ? area / 10000 : 5
      treeCount = Math.max(20, Math.round(ha * 100))
    } else if (site.type === 'street_tree' && site.length_m > 0) {
      treeCount = Math.max(10, Math.round(site.length_m / 4))
    } else {
      treeCount = 30
    }
  }
  if (meanDbh === 0) {
    meanDbh = site.type === 'pine_forest' ? 35 : 25
  }
  if (area === 0) {
    area = site.length_m > 0 ? site.length_m * 3 : treeCount * 100
  }
  return { treeCount, meanDbh, area }
}

// ═══════════════════════════════════════════════════
// 조치별 비용 함수
// ═══════════════════════════════════════════════════

// 전정 — §2-8-2 수관솎기 + §1.5 할증
function 비용_전정(site) {
  const { treeCount, meanDbh } = siteScale(site)
  const r = lookupByDbh(PRUNING_TABLE, meanDbh)
  const heightM = estimateTreeHeight(meanDbh)
  const surcharge = 1 + heightSurchargeRate(heightM)

  const qty = {
    나무의사: r.나무의사 * treeCount * surcharge,
    수목치료기술자: r.수목치료기술자 * treeCount * surcharge,
    보통인부: r.보통인부 * treeCount * surcharge,
    고소작업차_hr: r.고소작업차_hr * treeCount
  }
  return applyOverhead(laborCost(qty), 0, equipmentCost(qty))
}

// 제거 — §2-8-3 고사목 + 고소작업차(Note 10) + §1.5 할증
function 비용_제거(site) {
  const { treeCount, meanDbh } = siteScale(site)
  const targetCount = Math.max(1, Math.round(treeCount * 0.1))
  const r = lookupByDbh(REMOVAL_TABLE, meanDbh)
  const heightM = estimateTreeHeight(meanDbh)
  const surcharge = 1 + heightSurchargeRate(heightM)

  const qty = {
    나무의사: r.나무의사 * targetCount * surcharge,
    수목치료기술자: r.수목치료기술자 * targetCount * surcharge,
    보통인부: r.보통인부 * targetCount * surcharge,
    고소작업차_hr: (r.고소작업차_hr || 0) * targetCount
  }
  const labor = laborCost(qty)
  const equip = equipmentCost(qty)
  // Note (8): 발생재 폐기물 처리비 별도 → 노무비 15% 가산 가정
  return applyOverhead(labor, 0, equip + labor * 0.15)
}

// 방제 — §2-1 + 살포약량 2D → 1D + §1.5 할증
function 비용_방제(site) {
  const { treeCount, meanDbh } = siteScale(site)
  const perTreeL = lookupScalar(SPRAY_VOLUME_L, meanDbh)
  const totalL = treeCount * perTreeL
  const units100L = totalL / 100
  const heightM = estimateTreeHeight(meanDbh)
  const surcharge = 1 + heightSurchargeRate(heightM)

  const qty = {
    나무의사: 0.02 * units100L * surcharge,
    수목치료기술자: 0.146 * units100L * surcharge,
    보통인부: 0.073 * units100L * surcharge,
    동력분무기_hr: 0.152 * units100L,
    방제차량_hr: 0.218 * units100L
  }
  const labor = laborCost(qty)
  const equip = equipmentCost(qty)
  const material = totalL * MATERIAL.방제제_L
  return applyOverhead(labor, material, equip)
}

// 관수 — §2-3-1 토양 관주처리. 그루당 관주량은 DBH 비례.
function 비용_관수(site) {
  const { treeCount, meanDbh } = siteScale(site)
  // 관주량: DBH(cm) × 2L (경험적 — 20cm 나무 40L, 50cm 나무 100L)
  const perTreeL = Math.max(20, meanDbh * 2)
  const totalL = treeCount * perTreeL
  const units100L = totalL / 100

  const qty = {
    나무의사: 0.031 * units100L,
    수목치료기술자: 0.125 * units100L,
    보통인부: 0.052 * units100L,
    동력분무기_hr: 0.152 * units100L,
    방제차량_hr: 0.218 * units100L
  }
  return applyOverhead(laborCost(qty), 0, equipmentCost(qty))
}

// 토양개량 — §2-5-1 토양물리성 개선 (㎡당)
function 비용_토양개량(site) {
  const { treeCount } = siteScale(site)
  // 그루당 개선 면적: 수관 하부 약 πr²≈5~12㎡ → 평균 8㎡ 가정
  const m2 = treeCount * 8
  const qty = {
    나무의사: 0.082 * m2,
    수목치료기술자: 0.220 * m2,
    보통인부: 0.073 * m2
  }
  const labor = laborCost(qty)
  const material = 120 * m2 * MATERIAL.토양개량제_kg
  return applyOverhead(labor, material, 0)
}

// 보식 — 건설공사 표준품셈 §4-3-5 교목 식재 (기계시공) + 묘목비
function 비용_보식(site) {
  const { treeCount, meanDbh } = siteScale(site)
  const target = Math.max(3, Math.round(treeCount * 0.05))
  const plantDbh = Math.min(meanDbh, 25) // 보식은 보통 소경목
  const r = lookupByDbh(PLANTING_TABLE, plantDbh)
  const stockPrice = lookupScalar(STOCK_PRICE, plantDbh)

  const labor = target * (
    (r.조경공 || 0) * RATE_조경공 +
    (r.보통인부 || 0) * RATE.보통인부
  )
  const material = target * stockPrice
  // DBH 21cm+ 대형 교목은 굴착기+크레인 장비비 추가 (1그루 ~0.5hr 가정)
  const equip = plantDbh > 20 ? target * 0.5 * PLANTING_EQUIP_HR : 0
  return applyOverhead(labor, material, equip)
}

// 현장점검 — §1-1 진단 + 면적/수종 가중
function 비용_현장점검(site) {
  const { area } = siteScale(site)
  // 면적 기준 가중 (§1-1 주 (1))
  let weight = 1.0
  if (area > 500) weight = 2.5
  else if (area > 300) weight = 2.0
  else if (area > 100) weight = 1.5
  // 수종 수 기준 가중 (OR 조건 — 더 큰 쪽 적용)
  const speciesStr = site.main_species || ''
  const speciesCount = speciesStr.split(/[+·,/]/).filter(Boolean).length || 1
  let speciesWeight = 1.0
  if (speciesCount >= 7) speciesWeight = 2.0
  else if (speciesCount >= 5) speciesWeight = 1.5
  weight = Math.max(weight, speciesWeight)

  const labor = 1 * RATE.나무의사 // 현장진단 0.5인 + 보고서 0.5인 = 1.0인
  const expense = 50_000 + 20_000 + 30_000 // 여비(공무원여비규정) + 진단서 발급비 + 장비·분석 기본
  const 소계 = (labor + expense) * weight
  const 일관 = 소계 * OVERHEAD.일반관리비_pct
  const 이윤 = (소계 + 일관) * OVERHEAD.이윤_pct
  const 공급 = 소계 + 일관 + 이윤
  const 부가 = 공급 * OVERHEAD.부가세_pct
  return Math.round(공급 + 부가)
}

// ═══════════════════════════════════════════════════
// 외부 인터페이스
// ═══════════════════════════════════════════════════

const ACTION_TO_FN = {
  전정: 비용_전정,
  제거: 비용_제거,
  방제: 비용_방제,
  관수: 비용_관수,
  토양개량: 비용_토양개량,
  보식: 비용_보식,
  현장점검: 비용_현장점검
}

export function estimateActionCost(action, site) {
  const fn = ACTION_TO_FN[action]
  if (!fn) return 0
  return fn(site)
}

export function allActionCosts(site) {
  const out = {}
  for (const action of Object.keys(ACTION_TO_FN)) {
    out[action] = estimateActionCost(action, site)
  }
  return out
}

export const FORMULA_META = {
  source: '산림청 수목진료 표준품셈 (2025.6.) + 건설공사 표준품셈 (2026)',
  rate_year: '2025',
  rates: RATE,
  notes: [
    '나무의사·수목치료기술자 노임단가: 수목진료 표준품셈 §1.4 (2025년)',
    '보통인부·조경공 노임단가: 대한건설협회 시중노임 (추정값 — 갱신 필요)',
    '§1.5 품의 할증 (수목 높이별 +2~8%, 고소작업차 기준) 적용',
    '살포약량: §2-1 그루당 살포약량 표 (흉고경×수고 → DBH 1D 간소화)',
    '간접비: 잡재료비 2%, 공구손료 3%, 일반관리비 6%, 이윤 10%, 부가세 10%',
    '사이트 규모(tree_count·mean_dbh·area)로부터 자동 수량 환산'
  ]
}
