// 전국도시공원정보표준데이터 Open API → data/source-csv/부산광역시_도시공원정보_<날짜>.csv
//
// 전국 도시공원을 페이징 수집해 부산만 필터, ETL이 인식하는 한글 헤더 CSV로 저장한다.
// 그 후 `node scripts/etl.mjs`가 이 CSV를 공원 사이트로 변환한다.
//
// 사용:
//   node --env-file=.env scripts/fetchBusanParks.mjs
//
// API: https://www.data.go.kr/data/15012890/standard.do
//   엔드포인트 http://api.data.go.kr/openapi/tn_pubr_public_cty_park_info_api
//   필수: serviceKey, pageNo, numOfRows, type=json
//
// ⚠️ 이 API는 사용자 data.go.kr 계정에서 "활용신청"이 승인되어야 한다(같은 키 사용).
//    미승인 시 resultCode 30 (SERVICE KEY IS NOT REGISTERED) 가 반환된다.
//
// 응답 필드명이 제공기관 버전에 따라 다를 수 있어, 한글·romanized 후보를 모두 시도하고
// 첫 페이지의 실제 키를 콘솔에 출력한다(불일치 시 FIELD_CANDIDATES 보정).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeCity } from '../src/data/busanRegion.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const KEY = process.env.DATA_GO_KR_KEY
if (!KEY) {
  console.error('DATA_GO_KR_KEY 미설정. node --env-file=.env scripts/fetchBusanParks.mjs')
  process.exit(1)
}

const BASE = 'http://api.data.go.kr/openapi/tn_pubr_public_cty_park_info_api'

const FIELD_CANDIDATES = {
  관리번호: ['mngNo', 'manageNo', '관리번호'],
  공원명: ['parkNm', 'pkNm', 'cyparkNm', 'parkName', '공원명'],
  공원구분: ['parkSe', 'pkSe', 'parkGbn', '공원구분'],
  소재지도로명주소: ['rdnmadr', 'roadNmAddr', '소재지도로명주소'],
  소재지지번주소: ['lnmadr', 'lotnoAddr', 'jibunAddr', '소재지지번주소'],
  위도: ['latitude', 'lat', '위도'],
  경도: ['longitude', 'lng', 'lot', '경도'],
  공원면적: ['parkArea', 'area', '공원면적'],
  지정고시일: ['appnNtcDate', 'designationDate', '지정고시일'],
  관리기관명: ['instNm', 'mngInstNm', 'institutionNm', '관리기관명'],
  데이터기준일자: ['referenceDate', 'baseDate', '데이터기준일자']
}

const CSV_COLS = [
  '관리번호', '공원명', '공원구분', '소재지도로명주소', '소재지지번주소',
  '위도', '경도', '공원면적', '지정고시일', '관리기관명', '데이터기준일자'
]

function pick(row, candidates) {
  for (const c of candidates) {
    if (row[c] != null && String(row[c]).trim() !== '') return String(row[c]).trim()
  }
  return ''
}

function isBusanRow(row) {
  // 시도/주소에 '부산'이 포함되거나, 주소에서 구·군 정규화가 성공하면 부산으로 간주
  const blob = [
    pick(row, FIELD_CANDIDATES.소재지도로명주소),
    pick(row, FIELD_CANDIDATES.소재지지번주소),
    row.ctprvnNm, row.sido, row.시도명
  ].filter(Boolean).join(' ')
  if (blob.includes('부산')) return true
  return false
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function fetchPage(pageNo, numOfRows = 500) {
  const url = `${BASE}?serviceKey=${encodeURIComponent(KEY)}&pageNo=${pageNo}&numOfRows=${numOfRows}&type=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const text = await res.text()
  let j
  try { j = JSON.parse(text) } catch { throw new Error('JSON 파싱 실패: ' + text.slice(0, 200)) }
  const header = j?.response?.header
  if (header && header.resultCode && header.resultCode !== '00') {
    throw new Error(`API ${header.resultCode}: ${header.resultMsg} (활용신청 승인 필요할 수 있음)`)
  }
  const body = j?.response?.body || j
  const items = body?.items?.item || body?.items || []
  const list = Array.isArray(items) ? items : [items].filter(Boolean)
  const total = Number(body?.totalCount ?? list.length)
  return { list, total }
}

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  const first = await fetchPage(1, 500)
  if (first.list[0]) {
    console.log('첫 행 실제 필드명:', Object.keys(first.list[0]).join(', '))
  }
  const all = [...first.list]
  const total = first.total || first.list.length
  const pages = Math.ceil(total / 500)
  console.log(`전국 총 ${total}건 · ${pages}페이지 수집`)
  for (let p = 2; p <= pages; p++) {
    const { list } = await fetchPage(p, 500)
    all.push(...list)
    if (p % 10 === 0) console.log(`  ...${p}/${pages}페이지`)
    await sleep(120)
  }

  const busan = all.filter(isBusanRow)
  console.log(`부산 공원 ${busan.length}건 필터됨`)

  const rows = [CSV_COLS.join(',')]
  let mapped = 0
  for (const row of busan) {
    const jibun = pick(row, FIELD_CANDIDATES.소재지지번주소)
    const road = pick(row, FIELD_CANDIDATES.소재지도로명주소)
    if (normalizeCity(jibun) || normalizeCity(road)) mapped++
    const out = {
      관리번호: pick(row, FIELD_CANDIDATES.관리번호),
      공원명: pick(row, FIELD_CANDIDATES.공원명),
      공원구분: pick(row, FIELD_CANDIDATES.공원구분),
      소재지도로명주소: road,
      소재지지번주소: jibun,
      위도: pick(row, FIELD_CANDIDATES.위도),
      경도: pick(row, FIELD_CANDIDATES.경도),
      공원면적: pick(row, FIELD_CANDIDATES.공원면적),
      지정고시일: pick(row, FIELD_CANDIDATES.지정고시일),
      관리기관명: pick(row, FIELD_CANDIDATES.관리기관명),
      데이터기준일자: pick(row, FIELD_CANDIDATES.데이터기준일자)
    }
    rows.push(CSV_COLS.map((c) => csvCell(out[c])).join(','))
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const outFile = path.join(ROOT, 'data', 'source-csv', `부산광역시_도시공원정보_${today}.csv`)
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  // UTF-8 BOM (ETL readCsvAuto가 UTF-8/EUC-KR 자동 감지)
  fs.writeFileSync(outFile, '﻿' + rows.join('\n'), 'utf8')
  console.log(`\n생성: ${outFile} (${busan.length}행, 구·군 매칭 ${mapped}행)`)
  console.log('이제 `node scripts/etl.mjs` 실행하여 사이트로 변환하세요.')
}

main().catch((e) => { console.error('실패:', e.message); process.exit(1) })
