// LLM(Claude) 기반 자연어 수목 진단·조치 생성.
//
// 본 앱은 백엔드가 없는 정적 SPA이므로, 사용자가 자신의 Anthropic API 키를
// 입력하면 브라우저에서 Messages API를 직접 호출한다. 키는 localStorage에만
// 저장되고 서버로 전송되지 않으며, 저장소(repo)에 커밋되지 않는다.
//
// 규칙 기반 6요인 산식(recommend.js)이 산출한 위험요인·점수·추천을 입력으로 주고,
// Claude가 행정 담당자용 자연어 진단 보고를 생성한다 → "AI 기술 활용 / AI 서비스".
//
// 모델: claude-opus-4-8 (Anthropic 최신 Opus). thinking 미사용(빠른 응답),
// effort low로 간결·신속. 출력은 한국어 최종 답변만.

import { RISK_FACTOR_LABELS } from './risk.js'

const KEY_STORAGE = 'dryad_anthropic_key'
const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-opus-4-8'

export function getApiKey() {
  try {
    return localStorage.getItem(KEY_STORAGE) || ''
  } catch {
    return ''
  }
}

export function setApiKey(key) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key.trim())
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    /* localStorage 비활성 환경 무시 */
  }
}

export function hasApiKey() {
  return !!getApiKey()
}

// 사이트의 정량 데이터를 LLM 입력용 텍스트로 직렬화 (산식 결과를 그대로 전달)
function buildSiteContext(site, rec, complaints = []) {
  const factors = Object.entries(site.risk || {})
    .filter(([k]) => k.endsWith('_score'))
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `  - ${RISK_FACTOR_LABELS[k] || k}: ${v}/100`)
    .join('\n')

  const lines = [
    `대상: ${site.name} (${site.city}, ${site.type})`,
    `주요 수종: ${site.main_species || '미상'}`,
    `관리기관: ${site.managing_agency || '미상'}`,
    `종합 위험도: ${site.total_risk_score}/100 (${site.risk_grade}등급)`,
    `6요인 점수(높을수록 위험):\n${factors}`
  ]
  if (site._vitality_grade != null) lines.push(`도시숲표준지 활력도 등급: ${site._vitality_grade}/5 (1=최상,5=고사직전)`)
  if (site._sdr_density != null) lines.push(`밀도(SDR): ${site._sdr_density} ${site._sdr_unit || '본/m'}`)
  if (site._forest_carbon_uptake != null) lines.push(`산림 탄소흡수량: ${site._forest_carbon_uptake.toFixed(3)} tCO2/yr`)
  if (rec) {
    lines.push(`규칙기반 추천(참고): ${rec.primary?.action}${rec.secondary ? ', ' + rec.secondary.action : ''} / 예상비용 ${rec.estimated_cost_krw?.toLocaleString()}원`)
  }
  if (complaints && complaints.length) {
    const types = complaints.slice(0, 8).map((c) => c.type).join(', ')
    lines.push(`접수 민원 ${complaints.length}건 (유형: ${types})`)
  }
  return lines.join('\n')
}

const SYSTEM_PROMPT = [
  '당신은 산림청·지자체 산림·녹지 담당 공무원을 돕는 수목관리 의사결정 보조 AI입니다.',
  '제공된 공공데이터 기반 6요인 위험도 점수와 메타데이터만 근거로, 행정 담당자가 바로 쓸 수 있는 진단을 작성하세요.',
  '형식: (1) 핵심 위험 요약 1문장, (2) 우선 조치 2~3개를 근거와 함께 불릿으로, (3) 한 줄 주의(현장 확인 필요).',
  '한국어로, 군더더기 없이 8문장 이내. 점수에 없는 사실을 지어내지 말고, 제공된 수치를 근거로 인용하세요.',
  '탐색적 사고 과정은 출력하지 말고 최종 보고만 작성하세요. 이는 행정 판단 보조이며 수목 질병의 확정 진단이 아닙니다.'
].join(' ')

/**
 * Claude로 자연어 진단 생성. 실패 시 Error throw.
 * @returns {Promise<string>} 진단 텍스트
 */
export async function generateDiagnosis(site, rec, complaints = []) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('NO_KEY')

  const userContent =
    '다음 수목관리 대상의 위험도 데이터를 바탕으로 진단·조치를 작성해 주세요.\n\n' +
    buildSiteContext(site, rec, complaints)

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // 브라우저에서 직접 호출 시 CORS 허용 (사용자 본인 키 사용)
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }]
    })
  })

  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = j?.error?.message || ''
    } catch {
      /* ignore */
    }
    if (res.status === 401) throw new Error('API 키가 올바르지 않습니다 (401).')
    if (res.status === 429) throw new Error('요청 한도 초과 (429). 잠시 후 다시 시도하세요.')
    throw new Error(`API 오류 ${res.status}${detail ? ': ' + detail : ''}`)
  }

  const data = await res.json()
  // refusal 등 비정상 정지 처리
  if (data.stop_reason === 'refusal') {
    throw new Error('모델이 응답을 거부했습니다.')
  }
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
  if (!text) throw new Error('빈 응답을 받았습니다.')
  return text
}
