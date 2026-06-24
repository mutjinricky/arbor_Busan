import React, { useMemo } from 'react'
import { formatKRW } from '../lib/recommend.js'
import {
  totalAnnualCarbon,
  totalAvoidedCarbonLoss,
  formatCarbon,
  carbonAsCarsEquivalent
} from '../lib/carbon.js'

export default function SummaryCards({ sites, totalEstimatedCost }) {
  const total = sites.length
  const highRisk = sites.filter((s) => s.risk_grade === 'A').length
  const weekInspect = sites.filter(
    (s) => s.risk_grade === 'A' || s.risk_grade === 'B'
  ).length
  const fireLinked = sites.filter((s) => s.risk.fire_risk_score >= 70).length

  const totalCarbon = useMemo(() => totalAnnualCarbon(sites), [sites])
  const carsEquiv = carbonAsCarsEquivalent(totalCarbon)
  const avoidedCarbon = useMemo(() => totalAvoidedCarbonLoss(sites, { years: 10 }), [sites])
  const avoidedCars = carbonAsCarsEquivalent(avoidedCarbon)

  const cards = [
    {
      label: '전체 관리 대상',
      value: total + '개',
      tone: 'slate'
    },
    {
      label: '고위험 (A등급)',
      value: highRisk + '개',
      tone: 'red'
    },
    {
      label: '이번 주 점검 권장',
      value: weekInspect + '개',
      tone: 'orange'
    },
    {
      label: '산불위험 연계 구역',
      value: fireLinked + '개',
      tone: 'amber'
    },
    {
      label: '예상 관리 예산',
      value: formatKRW(totalEstimatedCost),
      tone: 'forest',
      small: true
    },
    {
      label: '연간 탄소 흡수량',
      value: formatCarbon(totalCarbon),
      sub: carsEquiv ? `≈ 승용차 ${carsEquiv.toLocaleString()}대/년 배출량` : null,
      tone: 'forest',
      small: true,
      tooltip:
        '면적(산림청 도시숲 ha계수)·가로수 단목 실측 기반. 단목값은 보수적 순흡수 0.0202 tCO₂/그루/yr(Kim&Jo 2022), 격리 기준은 0.0254(Na·Lee·Kim 2022 수원 i-Tree). 어린나무 포함 전체 평균이며, 성목 1주 잠재는 약 0.0995 tCO₂(27.1 kgC, 라이다 실측 Yang 2025)로 더 큼. 보존 시 흡수, 고사·소실 시 동일량 손실.'
    },
    {
      label: '고사 예방 탄소 보전',
      value: avoidedCarbon > 0 ? '+' + formatCarbon(avoidedCarbon) + '/yr' : '-',
      sub: avoidedCars ? `10년 후 ≈ 승용차 ${avoidedCars.toLocaleString()}대/년분 유지` : '고사율 데이터 필요',
      tone: 'forest',
      small: true,
      tooltip:
        '관수·정착관리(establishment management) 적용 시 고사율이 약 40%로 감소(Boyce 2011·Koeser 2014)할 때 10년 후 유지되는 추가 연간 흡수량. 식재 확대보다 고사율 저감이 탄소수지에 더 결정적(Smith 2019). 고사율 baseline은 도시숲표준지 등급, 미보유 시 생애단계·수종군별(기정착 활엽 1.3%·침엽 2.2%, 신규식재 6%, Parhizgar 2025·Hilbert 2019).'
    }
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((c) => (
        <Card key={c.label} {...c} />
      ))}
    </div>
  )
}

function Card({ label, value, sub, tone, small, tooltip }) {
  const toneClass =
    {
      slate: 'text-slate-900',
      red: 'text-red-600',
      orange: 'text-orange-600',
      amber: 'text-amber-600',
      forest: 'text-forest-700'
    }[tone] || 'text-slate-900'

  return (
    <div
      className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
      title={tooltip}
    >
      <div className="text-[11px] text-slate-500">{label}</div>
      <div
        className={`mt-1 font-bold ${toneClass} ${
          small ? 'text-sm' : 'text-xl'
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>
      )}
    </div>
  )
}
