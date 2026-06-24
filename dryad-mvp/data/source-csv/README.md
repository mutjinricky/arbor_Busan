# 부산 공공데이터 원본 CSV

ETL 재현성을 위해 저장소에 두는 **원본 공공데이터** CSV 위치. `public/sites_real.json` 은 이 파일들 + `data/external/busan_street_trees.json`(가로수 API 결과)로부터 자동 생성됩니다.

## 현재 상태

- 경기도 원본 CSV(31개 시군)는 `_gyeonggi_archive/` 로 이동(부산 버전에서 미사용, 보관용).
- **부산 도시공원 CSV는 `node --env-file=.env scripts/fetchBusanParks.mjs` 로 자동 생성**됩니다
  (data.go.kr 전국도시공원정보표준데이터 API → 부산 필터 → `부산광역시_도시공원정보_<날짜>.csv`).
  ※ 이 API는 사용자 data.go.kr 계정에서 **활용신청 승인**이 필요합니다(미승인 시 resultCode 30).

## 부산 데이터 소스 요약

| 데이터 | 취득 방법 | 비고 |
|---|---|---|
| 도시공원 | `scripts/fetchBusanParks.mjs` | 전국도시공원 표준데이터 API(15012890) — **활용신청 필요** |
| 가로수 | `scripts/fetchBusanStreetTrees.mjs` → `data/external/busan_street_trees.json` | 부산_구군 가로수 현황 API(15040363) — **활용신청 필요**. 전국 산림청 가로수 CSV에는 부산 미수록 |
| 산불위험(실시간) | `scripts/fetchExternal.mjs` | 산림청 산불위험예보(1400377) — ✅ 승인됨, 부산 16개 구·군 |
| 기상 스트레스 | `scripts/fetchExternal.mjs` | 기상청 단기예보(1360000) — ✅ 승인됨 |
| 토양·지형 | `scripts/fetchExternal.mjs` | 농진청 토양도 V2(1390802) — ✅ 승인됨, 12/16 구·군 |
| 피해이력(산불) | `scripts/buildFireHistoryFromKfsXls.mjs` | 예년(16~25)산불피해대장.xls(전국→부산 필터) — ✅ |
| 사이트별 정밀 PNU·토양 | `scripts/fetchSitePnu.mjs` → `scripts/fetchSiteSoil.mjs` | VWorld 역지오코딩 — ✅ (사이트 생성 후 실행) |

## 재실행 순서 (API 승인 후)

```bash
# 1) 부산 사이트 데이터 수집
node --env-file=.env scripts/fetchBusanParks.mjs          # 도시공원 → source-csv CSV
node --env-file=.env scripts/fetchBusanStreetTrees.mjs    # 가로수 → external json

# 2) 위험요인 실데이터 (이미 승인된 API)
node --env-file=.env scripts/fetchExternal.mjs            # 산불·기상·토양
node scripts/buildFireHistoryFromKfsXls.mjs               # 산불피해이력

# 3) 통합 ETL
node scripts/etl.mjs                                      # → public/sites_real.json

# 4) (선택) 사이트별 정밀 PNU·토양
node --env-file=.env scripts/fetchSitePnu.mjs
node --env-file=.env scripts/fetchSiteSoil.mjs
node scripts/etl.mjs                                      # 재실행하여 정밀 토양 반영
```

## 라이선스

모든 데이터는 **공공데이터포털 이용표준 약관**(data.go.kr)에 따라 자유 이용·재배포 가능.
