// 시연용 샘플 데이터와 ETL이 생성한 실제 공공데이터(/sites_real.json)를 합쳐
// 단일 SITES 배열을 노출한다. 각 사이트에는 data_source 태그가 붙는다.
//   - 'real'   : 산림 공공데이터 ETL 산출물 (부산 16개 구·군 파일럿, 런타임 fetch로 분리됨)
//   - 'sample' : 시연용 보조 샘플 (코드 인라인)
//
// 사이트 데이터는 public/sites_real.json 에 두어 빌드 chunk에서 분리.
// useSites() 훅으로 비동기 로딩, 준비 전에는 sample만 표시.

import { useEffect, useState } from 'react'
import { SAMPLE_SITES, INITIAL_RECORDS } from './sites.js'

const tagged = (arr, source) => arr.map((s) => ({ ...s, data_source: source }))

// 모듈 캐시 — 한 번 fetch한 결과를 페이지 내내 재사용
let _cache = null
let _promise = null

async function loadRealSites() {
  if (_cache) return _cache
  if (_promise) return _promise
  _promise = (async () => {
    try {
      // Vite는 BASE_URL을 환경변수로 노출하지만, /sites_real.json 절대경로로 충분
      const res = await fetch(`${import.meta.env.BASE_URL || '/'}sites_real.json`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      _cache = Array.isArray(data) ? data : []
    } catch (e) {
      console.warn('sites_real.json 로드 실패 — sample만 사용:', e.message)
      _cache = []
    }
    return _cache
  })()
  return _promise
}

function mergeSites(realSites) {
  const merged = []
  const seen = new Set()
  for (const s of tagged(realSites, 'real')) {
    if (seen.has(s.id)) continue
    seen.add(s.id)
    merged.push(s)
  }
  for (const s of tagged(SAMPLE_SITES, 'sample')) {
    if (seen.has(s.id)) continue
    seen.add(s.id)
    merged.push(s)
  }
  return merged
}

/**
 * 사이트 데이터 비동기 로딩 훅.
 * 초기 렌더 시 sample만 반환 → fetch 완료 후 real+sample 통합 반환.
 */
export function useSites() {
  const [state, setState] = useState(() => {
    if (_cache) {
      const merged = mergeSites(_cache)
      return { sites: merged, realCount: _cache.length, sampleCount: SAMPLE_SITES.length, loading: false }
    }
    return { sites: tagged(SAMPLE_SITES, 'sample'), realCount: 0, sampleCount: SAMPLE_SITES.length, loading: true }
  })
  useEffect(() => {
    if (_cache) return
    let cancelled = false
    loadRealSites().then((real) => {
      if (cancelled) return
      const merged = mergeSites(real)
      setState({ sites: merged, realCount: real.length, sampleCount: SAMPLE_SITES.length, loading: false })
    })
    return () => {
      cancelled = true
    }
  }, [])
  return state
}

export { INITIAL_RECORDS }
export {
  TYPE_LABELS,
  ACTION_TYPES,
  ACTION_UNIT_COST
} from './sites.js'
