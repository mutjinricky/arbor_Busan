# DRYAD 산림 AI 수목관리 의사결정 대시보드

> 산림청·기상청·농진청 등 **산림 공공데이터와 AI**로 도시숲·가로수·공원 등 수목관리 대상의 위험도를 자동 산출하여,
> 산림·녹지 행정 담당자의 "어디를 먼저 관리할지" 의사결정을 지원하는 웹 SaaS.
> 현재 MVP는 **경기 31개 시군 6,918개 사이트**를 9개 공공데이터·플랫폼으로 구현·검증한 1차 파일럿.

**2026 산림 공공데이터·AI 활용 창업경진대회 출품작 (제품 및 서비스 개발 부문)** · 드라이어드(전 나무잇)

---

## 핵심 성과 (요약)

| 지표 | 값 |
|---|---|
| 경기 사이트 수 | **6,918개** (도시공원 4,786 + 가로수 1,489 + 노선·표준지 643) |
| 경기 시군 커버리지 | **31/31개 (100%)** |
| 공공데이터·플랫폼 통합 | **9개 출처** (산림청 3 + 기상청 + 농진청 + KOSIS + 경기기후플랫폼 7개 layer + VWorld) |
| 6요인 실데이터 적용률 | 산불 31/31 · 기상 30/31 · 토양 22/31 시군 + 사이트 821건 · 피해이력 31/31 시군 실측 · 식생 6,305 수관폐쇄율 + 63 활력도 + 582 SDR |
| 위험 등급 분포 (기획서 임계값 80/60/40 그대로) | A 0 · B 7 · C 6,574 · D 337 — 경기는 산불 低 시도라 기본 상태 A·B 거의 없음 (정직한 분포). 시연 임팩트는 `demo_highrisk_*.csv` 업로드로 자연 생성 |

## 대회 적합성 (산림 공공데이터·AI 활용 창업경진대회)

전국 산림 수목관리 의사결정 시스템의 1차 파일럿으로 경기 31개 시군을 구현·검증. 대회 주제·평가기준 매핑:

| 대회 주제 | 본 제품 대응 |
|---|---|
| 산림재난 | 6요인 산불·산사태 위험도 자동 산출 (산림청 산불위험예보 + 경기기후플랫폼 산사태 레이어) |
| 산림관리 | 도시숲·가로수·공원 6,918개 사이트 자원관리 + 우선순위 의사결정 |
| 기후대응 | 산림탄소흡수량·토양탄소취약성 레이어 기반 탄소 흡수량 정량화 |

- **평가기준 대응**: 공공데이터 활용(9개 출처 통합·100% 공개) · AI 기술 활용(6요인 위험도 산정·SDR, 향후 처방적 AI) · AI 서비스(웹 SaaS 대시보드·PDF 보고서) · 독창성(수목 단위 행정 의사결정 보조) · 발전 가능성(전국 확장·수목 EMR 로드맵) · ESG 혁신(탄소·산림재난 대응 행정 효율화)

## 활용 공공데이터·플랫폼

### 실시간 API
- [산림청 산불위험예보 OpenAPI](https://www.data.go.kr/data/15084817/openapi.do) — 31/31 시군 실시간 산불위험지수 (3시간 갱신)
- [기상청 단기예보 OpenAPI](https://www.data.go.kr/data/15084084/openapi.do) — 30/31 시군 격자별 48h 기상
- [농진청 토양도 V2 OpenAPI](https://www.data.go.kr/data/15144105/openapi.do) — 22/31 시군 토성·자갈·경사

### 정적 통계 / 표준데이터
- [산림청 산불피해대장](https://www.forest.go.kr/) (예년 2016~2025) — **31/31 시군 실측 1,250건** 시군별 분해
- [전국도시공원정보표준데이터](https://www.data.go.kr/data/15012890/standard.do) — 경기 31개 시군 도시공원
- [산림청 도시숲가로수관리 가로수 현황](https://www.data.go.kr/) — 전국 단목 → 도로구간 집계
- [산림청 100대 소나무숲 정보](https://www.data.go.kr/data/15032216/fileData.do)
- 경기도 시군 자체 데이터 (광주 Shapefile · 의왕·안산·양평·광명 단목/노선 + 파주 도시숲표준지)

### 경기 특화 플랫폼 (신규)
- [경기기후플랫폼 WFS](https://climate.gg.go.kr) — **7개 레이어**: 시군 홍수위험도·시군/읍면동 공원평가·산사태·수관폐쇄율·수목높이·토양탄소취약성·산림탄소흡수량
- [VWorld 지오코딩](https://www.vworld.kr) — **6,898/6,918 사이트 정밀 PNU** (99.7%)

> 본 시스템은 대회가 지정한 [산림빅데이터거래소](https://www.bigdata-forest.kr)와 [산림청·소속기관 누리집](https://www.forest.go.kr) 데이터도 활용합니다. 특히 **산림빅데이터거래소의 산림병해충(소나무재선충 등) 발생현황 CSV는 인앱 CSV 업로드로 즉시 연계**되어 병해충 발생지 사이트로 분석됩니다(시연 샘플 `public/samples/demo_pest_bigdata_forest.csv`). 1차 파일럿의 상시 데이터는 위에 명시한 data.go.kr + 경기기후플랫폼 출처를 사용합니다.

---

## 빠른 실행

```bash
# 의존성 설치
npm install

# 개발 서버
npm run dev       # http://localhost:5173

# 정적 빌드
npm run build
```

> ⚠️ 사이트 데이터(`public/sites_real.json`, ~7MB)는 빌드 chunk에서 분리되어 런타임 fetch로 로드됩니다.

## 데이터 갱신 (선택)

전체 데이터를 다시 받으려면 [data.go.kr](https://www.data.go.kr/), [경기기후플랫폼](https://climate.gg.go.kr), [VWorld](https://www.vworld.kr) 서비스키 발급 후:

```bash
# 1. .env 파일에 키 저장
echo "DATA_GO_KR_KEY=your_key_here" > .env
echo "VWORLD_KEY=your_key_here" >> .env
echo "GG_CLIMATE_KEY=your_key_here" >> .env

# 2. 외부 API 자동 수집
node --env-file=.env scripts/fetchExternal.mjs              # 산림청·기상청·농진청
node scripts/buildFireHistoryFromKfsXls.mjs                 # 산림청 산불피해대장 xls → 시군별
node --env-file=.env scripts/fetchSitePnu.mjs               # VWorld 사이트별 PNU
node --env-file=.env scripts/fetchSiteSoil.mjs mountain     # 산지 PNU 토양 (선택)
node --env-file=.env scripts/fetchGgClimate.mjs all         # 경기기후플랫폼 4-Phase
node scripts/buildGgClimateSiteCache.mjs                    # 사이트별 매칭

# 3. ETL 재실행 (모든 캐시 통합 → sites_real.json)
node scripts/etl.mjs

# 4. 데이터 무결성 검사
node scripts/validate.mjs

# 5. PDF 보고서 재생성 (선택)
node scripts/md-to-pdf.mjs
```

---

## 주요 기능

### 데이터 통합
- 9개 공공데이터·플랫폼 자동 통합 (CSV 인코딩 EUC-KR/UTF-8 자동 감지)
- 시군별 위경도 보정, 경기 경계 밖 이상치 자동 처리
- 좌표·도로명·관리기관명·자치구 통합 매칭

### 6요인 위험도 산정 + SDR + 도시숲표준지 등급
- 기상 스트레스 · 산불 위험 · 식생·수종 취약성 · 토양·지형 · 관리공백·노후도 · 피해 이력
- 가중평균 + **기획서 9.2 등급 임계값 그대로** (80/60/40)
- 데이터 우선순위: 사이트별 정밀 > 등급 > 시군 단위 > 시뮬레이션
- 각 요인의 출처를 인앱 모달과 [SCORING.md](SCORING.md)에 100% 공개

### 시각화
- Leaflet 지도 + 클러스터링 마커 (좌표 근사 사이트 점선 표시)
- 시군별 6요인 히트맵 (31×6, sticky header)
- 우선순위 테이블 (5종 정렬 + 좌표근사 배지)

### 워크플로우
- 검색 (대상명·주소·수종·관리기관)
- **PDF 보고서 1클릭** (jsPDF + html2canvas) — 신규 메타데이터(수관폐쇄율·SDR·홍수위험·산사태·도시숲 등급·VWorld PNU) 포함
- 관리이력 입력 모달
- 새올·신문고 형식 민원 CSV → 좌표 기반 자동 매칭 + 위험도 가산점

### 정직성
- 모든 산식·임계값·가중치 공개
- 데이터 출처별 `실데이터` / `추정` / `시뮬레이션` 배지
- 좌표 근사 사이트 별도 표시 (2,132개, 30.8%)
- 데이터 신선도 (9개 출처) 인앱 표시

---

## 기술 스택

- React 18 + Vite 5
- Leaflet · react-leaflet · react-leaflet-cluster
- Tailwind CSS · Pretendard
- jsPDF + html2canvas (PDF 보고서)
- Node.js ETL (csv-parse + iconv-lite + xlsx + shapefile + proj4)

> **데이터 출처 우선순위**: 6요인 모든 점수는 가능한 가장 정밀한 출처를 우선 적용 (사이트별 PNU → 등급 → 시군 단위 → 시뮬레이션). 등급 임계값은 기획서 9.2 그대로 사용하므로 경기 기본 상태에서 A·B 등급이 자연스럽게 적음 — 정직한 분포.

## 디렉토리

```
dryad-mvp/
├── data/
│   ├── raw/                  # 원본 공공데이터 (gitignored)
│   ├── source-csv/           # 경기 31개 시군 도시공원 CSV (커밋용)
│   └── external/             # API 캐시 + 경기기후플랫폼 격자 (gitignored 일부)
├── public/
│   ├── sites_real.json       # ETL 산출물 (빌드 chunk에서 분리, 런타임 fetch)
│   └── samples/              # 시연용 demo CSV (사이트·민원)
├── scripts/
│   ├── etl.mjs                       # 메인 ETL
│   ├── fetchExternal.mjs             # 산림청·기상청·농진청 API
│   ├── buildFireHistoryFromKfsXls.mjs # 산림청 산불피해대장 변환
│   ├── fetchSitePnu.mjs              # VWorld 사이트별 PNU
│   ├── fetchSiteSoil.mjs             # 사이트별 토양
│   ├── fetchGgClimate.mjs            # 경기기후플랫폼 4-Phase
│   ├── buildGgClimateSiteCache.mjs   # 사이트별 매칭
│   ├── etlGwangjuShapefile.mjs       # 광주 Shapefile (.shp + .dbf)
│   └── validate.mjs                  # 데이터 무결성 검사
├── src/
│   ├── App.jsx
│   ├── components/           # Header·MapView·HeatmapView·SiteDetail·SiteReport·…
│   ├── lib/                  # risk·recommend·speciesMatrix·carbon·dataFreshness
│   └── data/                 # 시군 PNU·집계 로더
├── PRODUCT.md
├── SCORING.md
└── README.md
```

---

## 문서

- [PRODUCT.md](PRODUCT.md) — 제품 설명서
- [SCORING.md](SCORING.md) — 6요인 위험도 산정 산식 명세 (정직성 분류 포함)
- [DEMO.md](DEMO.md) — 발표·시연 시나리오
- [제출서류/](../제출서류/) — 기획서·참가신청서·제출 체크리스트

## 한계 및 향후 계획

- AI는 규칙 기반 6요인 산식 + SDR 위에 **Claude(Opus 4.8) LLM 자연어 진단 계층**(사이트별 진단·우선조치 생성, 사용자 API 키로 호출). 처방적 예측 AI (Poisson 산불 예측·CEI·SDR 시계열·WSI·CSM)는 운영 데이터 누적 후 학습 단계 (2027 TIPS)
- 사이트 단위 (단목 단위 아님). 수목 EMR은 2027 로드맵
- 민원·관리이력은 브라우저 메모리 기반. 운영 시 Supabase·자체 DB 연계 예정
- 본 시스템의 추천·점수는 **행정 판단 보조용**이며, 수목 질병의 확정 진단이 아닙니다.

## 라이선스 / 데이터 출처

- 소스코드: 출품작 (라이선스 별도 협의)
- 활용 공공데이터: data.go.kr 공공데이터 이용표준 약관 / 경기기후플랫폼 / VWorld / 산림청 / KOSIS 이용약관 준수

---

*드라이어드 · 2026 산림 공공데이터·AI 활용 창업경진대회 (주최 산림청 / 주관 한국임업진흥원) · 제품 및 서비스 개발 부문*
