# Arbor Busan — 부산 수목·산림 위험 관리 MVP

부산광역시 16개 구·군의 도시공원·가로수를 대상으로 **6대 위험요인**(산불위험·기상 스트레스·토양·피해이력·식생 취약성·관리공백)을 공공데이터로 산출해 선제적 관리 우선순위를 제시하는 대시보드입니다. (나무잇 / Arbor)

## 데이터 현황

- **사이트 1,440개** — 도시공원 666 + 가로수 774 (16개 구·군 전체)
- 위험요인 실데이터: 산불위험(산림청)·기상(기상청)·토양(농진청 토양도, 사이트별 PNU)·피해이력(산불피해대장)·식생(수종 매트릭스)

## 구조

```
dryad-mvp/            React + Vite 대시보드 (앱 본체)
  src/                컴포넌트·위험 모델·지역 설정(busanRegion.js)
  scripts/            ETL + 공공데이터 수집 스크립트
  data/               external(API 산출 JSON) · source-csv(부산 도시공원 CSV)
  public/sites_real.json   ETL 산출 통합 데이터셋
docs/papers/          위험·비용 모델 근거 연구논문
formula/              산림청 수목진료 표준품셈 (비용 산식 근거)
public_data/          공공데이터 원본 다운로드 (부산 도시공원 CSV·산불피해대장 등)
```

## 실행

```bash
cd dryad-mvp
npm install
npm run dev          # 개발 서버 (http://localhost:5173)
npm run build        # 프로덕션 빌드
```

데이터 재생성(공공데이터 API 키 필요, `dryad-mvp/.env`):

```bash
node --env-file=.env scripts/fetchBusanParks.mjs        # 도시공원 (전국도시공원 표준데이터)
node --env-file=.env scripts/fetchBusanStreetTrees.mjs  # 가로수 (부산 구군 가로수 현황)
node --env-file=.env scripts/fetchExternal.mjs          # 산불·기상·토양
node scripts/buildFireHistoryFromKfsXls.mjs             # 산불피해이력
node --env-file=.env scripts/fetchSitePnu.mjs           # 사이트별 정밀 PNU (VWorld)
node --env-file=.env scripts/fetchSiteSoil.mjs all      # 사이트별 토양 (농진청)
node scripts/etl.mjs                                    # 통합 → public/sites_real.json
```

## 데이터 출처

공공데이터포털(data.go.kr) 이용표준 약관에 따른 공공데이터: 산림청 산불위험예보·산불피해대장, 기상청 단기예보, 농촌진흥청 토양도 V2, 전국도시공원정보표준데이터, 부산광역시 구군 가로수 현황, VWorld.
