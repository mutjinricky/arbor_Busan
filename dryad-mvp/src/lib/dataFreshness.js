// 외부 데이터의 fetched_at·기준일을 한 곳에서 노출.
// fetchExternal.mjs / 기타 수집기가 생성한 JSON의 fetched_at 또는 별도 필드를 읽음.

import fireRisk from '../../data/external/fire_risk_sigungu.json'
import weather from '../../data/external/weather_sigungu.json'
import soil from '../../data/external/soil_sigungu.json'
import fireHistory from '../../data/external/fire_history_sigungu.json'

function formatDate(iso) {
  if (!iso) return '미상'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${da} ${h}:${mi}`
}

function ageLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const hours = Math.round((Date.now() - d) / (1000 * 60 * 60))
  if (hours < 1) return '방금'
  if (hours < 24) return `${hours}시간 전`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}일 전`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}개월 전`
  return `${Math.round(months / 12)}년 전`
}

export const DATA_FRESHNESS = [
  {
    key: 'fire_risk',
    label: '산불 위험 (실시간)',
    source: '산림청 산불위험예보 API',
    fetched_at: fireRisk?.fetched_at,
    reference: fireRisk?.by_sigun
      ? Object.values(fireRisk.by_sigun)[0]?.analdate
      : null,
    refresh: '3시간 간격 (산림청 표준)',
    granularity: '구·군 (16/16)'
  },
  {
    key: 'weather',
    label: '기상 스트레스 (실시간)',
    source: '기상청 단기예보 API',
    fetched_at: weather?.fetched_at,
    reference: weather
      ? `${weather.base_date} ${weather.base_time} 발표`
      : null,
    refresh: '하루 8회 (02·05·08·11·14·17·20·23시)',
    granularity: '구·군 격자 (16/16)'
  },
  {
    key: 'soil',
    label: '토양·지형',
    source: '농진청 토양도 V2 API',
    fetched_at: soil?.fetched_at,
    reference: '농진청 분기별 갱신',
    refresh: '분기 1회',
    granularity: '구·군 대표 PNU (12/16)'
  },
  {
    key: 'damage_history',
    label: '피해 이력',
    source: '산림청 산불피해대장 (예년 2016~2025)',
    fetched_at: fireHistory?.fetched_at,
    reference: fireHistory
      ? `${fireHistory.average_period} 평균 (${fireHistory.busan_totals?.count_10yr_avg}건/년)`
      : null,
    refresh: '연 1회 (산림청 통계연보)',
    granularity: '구·군 실측 (산불피해대장)'
  },
  {
    key: 'vegetation',
    label: '식생·수종 취약성',
    source: '수종 매트릭스 v0.1 + 도시숲표준지 등급 + SDR(과밀)',
    fetched_at: null,
    reference: '복합 — 사이트별 매칭',
    refresh: '데이터셋 갱신 시',
    granularity: '사이트별 (수종 매트릭스 + 활력도 등급 + SDR)'
  },
  {
    key: 'management_gap',
    label: '관리공백·노후도',
    source: '도시공원·가로수 표준데이터 (지정고시일·식재년도)',
    fetched_at: null,
    reference: 'CSV 갱신 시',
    refresh: 'data.go.kr 표준데이터 갱신 주기',
    granularity: '사이트별 (지정고시일·식재년도 proxy)'
  },
  // 보조 데이터 (위험 모델에 직접 또는 간접 기여)
  {
    key: 'vworld',
    label: 'VWorld 정밀 지오코딩 (보조)',
    source: 'VWorld 역지오코딩 API',
    fetched_at: null,
    reference: '사이트별 19자리 PNU 매핑',
    refresh: '사이트 추가 시',
    granularity: '사이트별 정밀 PNU'
  }
]

export { formatDate, ageLabel }
