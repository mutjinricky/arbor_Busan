import React from 'react'

const FACTORS = [
  {
    key: 'fire_risk_score',
    label: '산불 위험',
    weight: 0.20,
    sourceTier: 'public_only',
    rawSource: {
      label: '산림청 산불위험예보 API',
      url: 'https://www.data.go.kr/data/15084817/openapi.do',
      detail: 'forestPointListSigunguSearchV2 · meanavg (구·군별 0~100 표준 지수)'
    },
    refresh: '매일 8회 (3시간 간격)',
    formula: 'score = meanavg (변환 없음)',
    notes: '🟢 100% 산림청 raw 데이터. 자체 가공 없음.'
  },
  {
    key: 'weather_stress_score',
    label: '기상 스트레스',
    weight: 0.25,
    sourceTier: 'public_plan_mvp',
    rawSource: {
      label: '기상청 단기예보 조회서비스',
      url: 'https://www.data.go.kr/data/15084084/openapi.do',
      detail:
        '구·군 격자별 향후 48~72h 예보 → 최고기온·최저습도·최대풍속·누적강수'
    },
    refresh: '매일 (가장 최근 발표 시각 기준)',
    formula: [
      'raw =',
      '  (최고기온 ≥33℃ → 25 |  ≥30 → 15 |  ≥27 → 8)',
      '+ (최저습도 ≤40% → 20 |  ≤50 → 10)',
      '+ (최대풍속 ≥8m/s → 20 |  ≥5 → 10)',
      '+ (누적강수 ≤5mm → 25 |  ≤10 → 10)',
      'score = round(raw / 90 × 100)'
    ],
    notes:
      '🟦 임계값(33도/40%/8m/s/5mm)·가산점은 기획서 9.3.  🟧 90→100 정규화는 MVP.'
  },
  {
    key: 'vegetation_score',
    label: '식생·수종 취약성',
    weight: 0.15,
    sourceTier: 'public_mvp',
    rawSource: {
      label: '수종 매트릭스 + 수관폐쇄율 + 도시숲표준지 등급 + SDR',
      url: 'https://climate.gg.go.kr',
      detail: '4개 데이터 우선순위 통합 (사이트별 적용)'
    },
    refresh: '데이터셋 갱신 시',
    formula: [
      '우선순위:',
      '  1) 도시숲표준지 활력도 등급 (사이트별, 1~5 → 20~80점)',
      '  2) 수관폐쇄율 + 수종 매트릭스 평균 (사이트별)',
      '  3) 수종 매트릭스만 (나머지)',
      '',
      '수종 매트릭스 v0.1 (100+ 수종):',
      '  소나무 85, 곰솔 88, 잣나무 70, 은행나무 15, 단풍 40 …',
      '수관폐쇄율 점수 = 85 − cvg×60   (0=노출 85, 1=폐쇄 25)',
      '',
      'SDR(과밀) 가산:',
      '  가로수: 0.30본/m+ → +15 (매우 과밀)',
      '         0.20~0.30 → +10 (과밀)',
      '         0.10~0.20 → 0   (정상)',
      '         <0.10     → -5  (여유)',
      '  소나무숲: 본/ha 기준 동일 로직'
    ],
    notes:
      '🟢 도시숲표준지 등급·수관폐쇄율 모두 실측. 🟧 수종 매트릭스 v0.1·SDR 임계값은 MVP. 운영 시 산림청·나무의사 자문 v1.0 캘리브레이션 필요.'
  },
  {
    key: 'soil_score',
    label: '토양·지형',
    weight: 0.10,
    sourceTier: 'public_mvp',
    rawSource: {
      label: '농진청 토양도 V2 + 산사태위험지도·탄소취약성 + 도시숲표준지 배수등급',
      url: 'https://climate.gg.go.kr',
      detail: '5단계 우선순위'
    },
    refresh: '분기 1회 (농진청) · 기타 연 1회',
    formula: [
      '우선순위:',
      '  1) VWorld 사이트 PNU 토양 (사이트별 정밀, 가능 시)',
      '  2) 도시숲표준지 배수등급 (사이트별)',
      '  3) 산사태위험지도 1등급(85점)·취약(65점) + 토양탄소취약성(30~80점)',
      '  4) 농진청 구·군 대표 PNU 토양',
      '  5) 시뮬레이션 fallback',
      '',
      '농진청 산식 (4) — 적용 시:',
      '  토성: 사질 70 / 사양 40 / 식양 20 / 미사 35 / 식질 60',
      '  자갈: 없음 20 / 있음 50 / 심함 80',
      '  경사: 0-2 20 / 2-7 25 / 7-15 40 / 15-30 60 / 30-60 80 / 60+ 95',
      '  score = 토성×0.4 + 자갈×0.3 + 경사×0.3'
    ],
    notes:
      '🟢 VWorld 사이트별 PNU 매핑 확보. 농진청 API 응답 조건 충족 시 사이트별 정밀화 가능. 🟧 도심 공원은 토양도 데이터 부재가 일반적이라 부산/전국 대체 공공데이터(산사태위험지도 등)로 보완.'
  },
  {
    key: 'management_gap_score',
    label: '관리공백·노후도',
    weight: 0.20,
    sourceTier: 'public_proxy',
    rawSource: {
      label: 'CSV 지정고시일 / 식재년도 + 읍면동 공원평가',
      url: 'https://climate.gg.go.kr',
      detail: '연도 기반 점수 + 공원 서비스 부족 가산'
    },
    refresh: '데이터셋 갱신 시',
    formula: [
      '경과년수 = TODAY − 조성·식재년도',
      '  50년+ → 90 · 30~50 → 75 · 15~30 → 60 · 5~15 → 45 · 5미만 → 25 · 미상 → 50',
      '',
      '도시공원 (사이트별) 추가 보정:',
      '  읍면동 공원평가 < 50점 → +(50−점수)×0.3 (서비스 부족 → 관리 우선 ↑)',
      '  읍면동 공원평가 > 70점 → (70−점수)×0.2 (양호 → 관리 우선 ↓)',
      '  최종 score = clamp(원점수 + 보정, 15, 95)'
    ],
    notes:
      '⚠️ "관리공백" 표현이나 실 관리이력 미보유로 "조성·식재 후 경과"를 proxy로 사용. 읍면동 공원평가(사이트별)로 공원 서비스 균형성 보정. 지자체 관리이력 DB 연계 시 정밀화 가능.'
  },
  {
    key: 'damage_history_score',
    label: '피해 이력',
    weight: 0.10,
    sourceTier: 'public_only',
    rawSource: {
      label: '산림청 산불피해대장 (예년 2016~2025) + 구·군 홍수위험도',
      url: 'https://www.forest.go.kr/',
      detail: '구·군별 실측 산불 + 홍수위험 지수'
    },
    refresh: '연 1회 (산림청 통계연보)',
    formula: [
      '우선순위:',
      '  1) 도시숲표준지 고사율 등급 (사이트별, 1~5 → 15~85점)',
      '  2) 산림청 산불 60% + 홍수 40% 가중평균 (모든 사이트)',
      '  3) 시뮬레이션 fallback',
      '',
      '산불 점수 (구·군별 실측):',
      '  score = clamp(15, count_yr×6 + area_ha_yr×0.8, 85)',
      '',
      '홍수 점수 (홍수위험 지수 0~1):',
      '  flood_score = 15 + 홍수지수 × 70',
      '',
      '결합 점수 = 산불×0.6 + 홍수×0.4'
    ],
    notes:
      '🟢 구·군별 실측 데이터로 정밀화 완료 (시도 평균 일률 적용 → 구·군 변별력 高). 자치구 단위는 구·군 단위로 자동 합산.'
  }
]

const TIER_BADGE = {
  public_only: { label: '🟢 100% 공공데이터', cls: 'bg-forest-100 text-forest-800 border-forest-300' },
  public_plan_mvp: { label: '🟢 raw + 🟦 기준 + 🟧 정규화', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  public_mvp: { label: '🟢 raw + 🟧 변환', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  public_proxy: { label: '🟢 raw + 🟧 proxy 해석', cls: 'bg-amber-50 text-amber-800 border-amber-200' }
}

export default function ScoringInfoModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-base font-bold text-slate-900">
              위험도 산정 산식·출처
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              6요인 raw 데이터 · 변환 산식 · 정직성 분류 (모든 산식 공개)
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-auto px-6 py-4">
          <SectionHeader />

          <ul className="mt-4 space-y-5">
            {FACTORS.map((f) => (
              <FactorCard key={f.key} factor={f} />
            ))}
          </ul>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
            <div className="mb-1 font-semibold text-slate-800">
              정직성 요약
            </div>
            <ul className="list-disc pl-4">
              <li>
                <strong>Raw 입력 데이터</strong>: 공공데이터·공식 통계{' '}
                <strong className="text-forest-700">100%</strong> — 산림청·기상청·농진청·KOSIS·표준데이터셋
              </li>
              <li>
                <strong>가중치·등급 컷오프</strong>: 기획서 9.1·9.2 인용 (외부 근거 없음, 합리적 기본값)
              </li>
              <li>
                <strong>raw → 0~100 점수 변환 산식</strong>: MVP 합리적 기본값 (5개 요인). 운영 시 전문가 자문 캘리브레이션 필요
              </li>
            </ul>
          </div>

          <div className="mt-4 text-[11px] text-slate-500">
            전체 명세서: <code className="rounded bg-slate-100 px-1.5 py-0.5">SCORING.md</code> · 코드: <code className="rounded bg-slate-100 px-1.5 py-0.5">src/lib/risk.js</code>, <code className="rounded bg-slate-100 px-1.5 py-0.5">src/lib/speciesMatrix.js</code>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHeader() {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold text-slate-800">종합 위험도 산식</div>
      <pre className="mt-1.5 overflow-x-auto rounded bg-white p-2 text-[11px] leading-relaxed text-slate-700">
{`종합 위험도
= 기상 스트레스   × 0.25
+ 산불 위험       × 0.20
+ 식생·수종      × 0.15
+ 토양·지형      × 0.10
+ 관리공백·노후도 × 0.20
+ 피해 이력      × 0.10

등급: 80+ A · 60+ B · 40+ C · 0+ D    (출처: 기획서 9.1 / 9.2)`}
      </pre>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        <Legend tone="forest" label="🟢 PUBLIC 공공데이터" />
        <Legend tone="blue" label="🟦 PLAN 기획서 인용" />
        <Legend tone="amber" label="🟧 MVP 합리적 기본값" />
      </div>
    </div>
  )
}

function Legend({ tone, label }) {
  const cls = {
    forest: 'bg-forest-50 text-forest-700 border-forest-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200'
  }[tone]
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function FactorCard({ factor }) {
  const tier = TIER_BADGE[factor.sourceTier]
  const formulaLines = Array.isArray(factor.formula)
    ? factor.formula
    : [factor.formula]

  return (
    <li className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <div className="text-sm font-bold text-slate-900">
            {factor.label}
            <span className="ml-2 text-[11px] font-normal text-slate-500">
              가중치 × {factor.weight}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-600">
            {factor.rawSource.url ? (
              <a
                href={factor.rawSource.url}
                target="_blank"
                rel="noreferrer"
                className="text-forest-700 hover:underline"
              >
                {factor.rawSource.label} ↗
              </a>
            ) : (
              <span className="font-medium text-slate-700">
                {factor.rawSource.label}
              </span>
            )}
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="text-slate-500">{factor.refresh}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {factor.rawSource.detail}
          </div>
        </div>
        <span
          className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tier.cls}`}
        >
          {tier.label}
        </span>
      </div>

      <div className="border-b border-slate-100 px-4 py-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          변환 산식
        </div>
        <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-700">
          {formulaLines.join('\n')}
        </pre>
      </div>

      <div className="px-4 py-2.5">
        <div className="text-[11px] leading-relaxed text-slate-600">
          {factor.notes}
        </div>
      </div>
    </li>
  )
}
