// 부산 16개 구·군의 대표 PNU 코드 매핑 (busanRegion.js의 DISTRICTS에서 파생).
//
// 농진청 토양도 V2 API는 PNU(지번코드, 19자리)로만 토양 단면정보를 조회한다.
// 우리 데이터는 위경도만 있고 PNU는 없으므로, 각 구·군마다 구청·군청 소재 법정동의
// 대표 지번 1건을 샘플링해 그 구·군 전체의 평균 토양 조건 proxy로 사용한다.
// 정밀 산출은 VWorld 사이트별 역지오코딩 PNU(fetchSitePnu)가 우선 적용된다.
//
// PNU 19자리 구성:
//   법정동코드(10) + 산/일반(1: 1=일반·2=산) + 본번(4) + 부번(4)
//   예: 2623010100 + 1 + 0001 + 0000 = 2623010100100010000
//
// 만약 API가 "데이터 없음(코드 301)"을 반환하면 본번을 10, 100, 1000 식으로 늘려가며,
// 또 산지(2)·forestBjdong 후보로 재시도한다(fetchSoilForCity).

import { DISTRICTS } from './busanRegion.js'

export const REPRESENTATIVE_PNU = Object.fromEntries(
  DISTRICTS.map((d) => [
    d.name,
    {
      pnu: `${d.bjdong}100010000`,
      bjdong: d.bjdong,
      name: `${d.name} 대표 법정동 1-0`,
      note: '구청·군청 소재 법정동 대표 지번 (초기 매핑)'
    }
  ])
)

// 도심 구의 1차 PNU(구청 인근)가 토양도 데이터 없음을 반환할 때 시도할
// 산림 법정동 fallback (busanRegion.js의 forestBjdong).
export const FALLBACK_BJDONG = Object.fromEntries(
  DISTRICTS.filter((d) => Array.isArray(d.forestBjdong) && d.forestBjdong.length)
    .map((d) => [d.name, d.forestBjdong])
)

/**
 * 구·군명 리스트를 입력받아 {구·군: PNU} 매핑을 반환한다.
 */
export function buildPnuLookup(cities) {
  const result = {}
  for (const city of cities) {
    const entry = REPRESENTATIVE_PNU[city]
    if (entry) result[city] = entry.pnu
  }
  return result
}

/**
 * 부산 16개 구·군 전체 매핑을 반환 (편의 함수)
 */
export function allBusanPnu() {
  const result = {}
  for (const [city, entry] of Object.entries(REPRESENTATIVE_PNU)) {
    result[city] = entry.pnu
  }
  return result
}

/**
 * PNU 19자리 유효성 검증
 */
export function validatePnu(pnu) {
  if (typeof pnu !== 'string') return false
  if (!/^\d{19}$/.test(pnu)) return false
  const sanIlban = pnu[10]
  if (sanIlban !== '1' && sanIlban !== '2') return false
  return true
}
