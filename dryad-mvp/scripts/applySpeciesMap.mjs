// data/species_code_map.json의 TRE 코드 매핑을 public/sites_real.json에 적용.
// 사용자가 코드표를 확보한 뒤 species_code_map.json을 채우고 본 스크립트 실행.
//
// 사용:
//   node scripts/applySpeciesMap.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { vegetationScoreFromSpecies } from '../src/lib/speciesMatrix.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const MAP_FILE = path.join(ROOT, 'data', 'species_code_map.json')
const SITES_FILE = path.join(ROOT, 'public', 'sites_real.json')

if (!fs.existsSync(MAP_FILE)) {
  console.error(`매핑 파일 없음: ${MAP_FILE}`)
  process.exit(1)
}
if (!fs.existsSync(SITES_FILE)) {
  console.error(`사이트 파일 없음: ${SITES_FILE}`)
  process.exit(1)
}

const map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'))
const mappings = map.mappings || {}
const filled = Object.entries(mappings).filter(([_, v]) => v != null && v !== '')

if (filled.length === 0) {
  console.error('매핑이 비어있음 — data/species_code_map.json의 mappings 값을 채운 뒤 재실행')
  console.error('예시:')
  console.error('  "TRE001": "은행나무"')
  process.exit(1)
}

console.log(`매핑 ${filled.length}개 코드 적용 시작`)
filled.forEach(([k, v]) => console.log(`  ${k} → ${v}`))

const sites = JSON.parse(fs.readFileSync(SITES_FILE, 'utf8'))
let changed = 0
for (const site of sites) {
  if (!/^TRE/.test(site.main_species)) continue
  const mapped = mappings[site.main_species]
  if (!mapped) continue
  const oldCode = site.main_species
  site.main_species = mapped
  // 식생 점수 재계산
  const newScore = vegetationScoreFromSpecies(mapped)
  if (site.risk && site._vitality_grade == null) {
    // 도시숲표준지 등급이 있는 경우는 그쪽 우선 (assignRisk 로직과 일치)
    site.risk.vegetation_score = newScore
  }
  if (!site._mapping_history) site._mapping_history = []
  site._mapping_history.push({ from: oldCode, to: mapped, at: new Date().toISOString() })
  changed++
}

fs.writeFileSync(SITES_FILE, JSON.stringify(sites, null, 2), 'utf8')
map._last_updated = new Date().toISOString()
fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2), 'utf8')
console.log(`\n완료: ${changed}개 사이트의 수종 코드 → 수종명 변환`)
console.log(`갱신: ${SITES_FILE}`)
