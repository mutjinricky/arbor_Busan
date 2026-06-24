// AI 추천 조치 문장 생성 (규칙 기반). 기획서 10.2 / 15.4 참조.
// 실제 LLM 호출 대신 위험요인 점수 패턴을 보고 추천 문장을 조립한다.
// 예산은 산림청 수목진료 표준품셈(2025.6)을 기반으로 사이트 규모별 정량 산출.
//
// 조치별 근거 강도 (docs/papers, intervention efficacy 합성):
//   - 관수·정착관리: 생존율 향상에 가장 크고 반복 검증된 효과 (Boyce 2011·Koeser 2014)
//   - 구조(자연형) 전정: 성숙기 구조적 파손↓·수명↑ (UGA). 단 과도한 두절은 부후·도복↑ (안효준 2025)
//   - 토양개량·시비: 생장·토양질·활력 개선이 주효과이며 고사 저감 효과는 제한적

import { estimateActionCost } from './costFormula.js'

const FACTOR_RULES = [
  {
    key: 'management_gap_score',
    threshold: 70,
    actions: ['현장점검', '전정'],
    sentence: (s) => {
      const days = s.risk?.last_management_days
      const gapPhrase =
        days != null
          ? `최근 관리이력 후 ${days}일이 경과하여 관리공백이 누적된 상태`
          : `최근 관리이력이 확인되지 않아 관리공백이 우려되는 상태`
      return `${s.city} ${s.name}은(는) ${gapPhrase}입니다. 보행로 인접 구간을 우선으로 현장점검과 가지 상태 확인이 필요하며, 전정 시 자연형(구조) 전정을 원칙으로 하고 과도한 두절은 부후·도복 위험을 높이므로 지양합니다.`
    }
  },
  {
    key: 'fire_risk_score',
    threshold: 75,
    actions: ['현장점검', '제거'],
    sentence: (s) =>
      `${s.city} ${s.name} 일원은 산불위험 지수가 높아 ${s.main_species} 군락의 고사가지·낙엽 제거와 예찰 강화가 우선 필요합니다.`
  },
  {
    key: 'weather_stress_score',
    threshold: 70,
    actions: ['관수', '현장점검'],
    sentence: (s) =>
      `${s.city} ${s.name}은(는) 고온·건조·무강수 조건이 중첩되어 ${s.main_species}의 수세 저하가 우려됩니다. 관수·정착관리는 생존율 향상에 가장 효과가 큰 조치이므로 관수 점검 및 토양 수분 확인이 우선 필요합니다.`
  },
  {
    key: 'vegetation_score',
    threshold: 65,
    actions: ['방제', '현장점검'],
    sentence: (s) =>
      `${s.main_species} 위주의 단순림 구조로 병해충 확산 시 피해 범위가 크므로 ${s.city} ${s.name}에 대한 정기 방제 검토가 권장됩니다.`
  },
  {
    key: 'damage_history_score',
    threshold: 55,
    actions: ['현장점검', '제거'],
    sentence: (s) =>
      `${s.city} ${s.name} 일원은 과거 산불·병해 등 피해 이력이 누적된 지역으로, 고사목·도복 위험목 사전 점검이 필요합니다.`
  },
  {
    key: 'soil_score',
    threshold: 55,
    actions: ['토양개량'],
    sentence: (s) =>
      `${s.city} ${s.name}은(는) 토성·배수 조건이 불리해 ${s.main_species}의 생장·활력 저하가 우려되어 토양개량(멀칭·퇴비 등)을 검토할 수 있습니다. 토양개량은 생장·토양질 개선이 주효과이며, 고사 위험이 높은 구간은 관수·정착관리를 함께 검토합니다.`
  }
]

export function topFactors(site) {
  const r = site.risk
  return Object.entries(r)
    .filter(([k]) => k.endsWith('_score'))
    .sort((a, b) => b[1] - a[1])
}

export function recommendActions(site) {
  const ranked = topFactors(site)
  const triggered = []

  for (const [factorKey] of ranked) {
    const rule = FACTOR_RULES.find((f) => f.key === factorKey)
    if (!rule) continue
    if (site.risk[factorKey] >= rule.threshold) {
      triggered.push(rule)
    }
    if (triggered.length >= 2) break
  }

  // fallback: 위험요인이 모두 낮으면 정기 관리만 제안
  if (triggered.length === 0) {
    return {
      summary: `${site.city} ${site.name}은(는) 현재 위험요인이 전반적으로 낮으나 ${site.main_species} 정기 관리 사이클 유지가 권장됩니다.`,
      primary: { action: '현장점검', reason: '정기 모니터링' },
      secondary: null,
      estimated_cost_krw: estimateActionCost('현장점검', site)
    }
  }

  const primaryRule = triggered[0]
  const secondaryRule = triggered[1]

  const primaryAction = primaryRule.actions[0]
  const secondaryAction = secondaryRule
    ? secondaryRule.actions[0]
    : primaryRule.actions[1] || null

  const summary =
    primaryRule.sentence(site) +
    (secondaryRule ? ' ' + secondaryRule.sentence(site) : '')

  return {
    summary,
    primary: { action: primaryAction, reason: primaryRule.key },
    secondary: secondaryAction
      ? { action: secondaryAction, reason: secondaryRule?.key || primaryRule.key }
      : null,
    estimated_cost_krw:
      estimateActionCost(primaryAction, site) +
      (secondaryAction ? estimateActionCost(secondaryAction, site) : 0)
  }
}

export function formatKRW(n) {
  if (n == null) return '-'
  return n.toLocaleString('ko-KR') + '원'
}
