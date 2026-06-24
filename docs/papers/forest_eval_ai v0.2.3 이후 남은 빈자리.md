# forest_eval_ai v0.2.4 — 한국 도시 가로수 의사결정 시스템 6개 영역 직접 측정값 조사 결과

## TL;DR
- **영역 2(safety)·영역 4(단가)·영역 5(census)** 일부에서만 직접 측정 수치를 확보했고, **영역 1(수종별 mortality)·영역 3(per-tree hedonic)·영역 6(pruning mortality)**은 한국 맥락에서 직접 측정값이 사실상 부재하여 open_question으로 닫음.
- 가장 큰 가용 자산은 (a) 안효준 외 2025 양버즘 부후 % 측정값, (b) LH 124,179주 16.75% 하자율(다종 합계), (c) 단비뉴스 윤재갑 의원실 데이터(2021 16,000그루 고사 / 2020-2023 11,944주 원인분석), (d) 원주시 445→28주(6.3%) 위험목 판정률, (e) 국토교통부 표준시장단가 가로수 제거 공종 단가집.
- 핵심 빈자리: **수종별 longitudinal mortality(7수종)**·**가로수 단일변수 hedonic 회귀계수(한국)**·**preventive pruning 10년 cohort mortality**는 2024–2025 신규 1차 자료 미발견 → 결론을 보류하고 데이터 수요를 그대로 노출.

---

## Key Findings (요약 평가)

| 영역 | 직접 측정값 확보 수준 | 비고 |
|---|---|---|
| 2 Safety | **중간** (이벤트성 도복 건수, 위험목 비율, 단일 사망사고 5억 KRW 등 일부 수치만) | 그루당 연간 사고 확률·인적/물적 손해 평균액·preventive pruning 효과 직접 비교는 미발견 |
| 1 Mortality | **낮음** (총량 16,000그루/year, LH 합계 16.75%만; 7수종 별도값 없음) | 한국 종별 cadaster 시계열 공개 안 됨 |
| 4 Unit cost | **중간** (KREI 도착도 시장가, 표준시장단가 공종) | 시·군별 낙찰가 통계는 g2b API로만 접근 가능—deep research 한계 |
| 3 Hedonic | **거의 없음** | 가로수 단일 변수 회귀계수가 통합 greenness/streetscape 변수와 분리된 한국 연구 미확인 |
| 5 Census mapping | **데이터 매핑만 가능** | 서울 가로수 위치정보(좌표·수종·수고·DBH·수관너비·활력도) 공개, 단 시계열 X |
| 6 Pruning | **없음** (2024–2025 신규 측정값 없음) | 결론 sealed |

---

## Details

### 파일 1: `dr_2026_korea_safety_accident.json`

```json
{
  "paper_id": "deep_research_2026_korea_safety_accident",
  "title": "한국 도시 가로수 안전사고·도복·위험목 직접 측정값 모음",
  "year": 2026,
  "authors": ["deep research curation"],
  "doi": null,
  "query_category": "proposition_a",
  "claims": [
    {
      "claim_type": "economic_loss",
      "metric_name": "성북구청 가로수 도복 사망사고 1심 손해배상 인용액",
      "metric_value": 500000000,
      "metric_unit": "KRW",
      "intervention": "관할 자치구 영조물 관리상 하자에 따른 국가배상",
      "comparison_baseline": "사고 없음",
      "confidence_interval": null,
      "p_value": null,
      "sample_size": 1,
      "study_region": "서울 성북구",
      "species": ["unspecified"],
      "study_period": "2021-08-30 사고 / 1심 판결 후 서울고법 2024-04-26 항소심 유지",
      "source_quote": "성북구청이 망인의 모친 A씨에게 5억 원을 배상하라",
      "page_or_section": "https://www.munhwa.com/article/11435037 (2024-07-12 보도)",
      "extraction_confidence": 0.95,
      "notes": "사용자 제공 1차 사실 재확인. 인적 피해 단일 사망 사고당 평균액 추정의 상한 사례. 화물차 운전자와 공동 책임."
    },
    {
      "claim_type": "risk_factor",
      "metric_name": "원주시 정밀안전진단 대상 가로수 중 고위험목 판정 비율",
      "metric_value": 0.0629,
      "metric_unit": "ratio",
      "intervention": "수간단층촬영·수목활력도 안전진단",
      "comparison_baseline": "전체 진단 대상목",
      "confidence_interval": null,
      "p_value": null,
      "sample_size": 445,
      "study_region": "강원 원주시 (북원로·만대로·시청로 일부 노선)",
      "species": ["Platanus occidentalis", "Quercus palustris", "Ginkgo biloba"],
      "study_period": "2023-06 ~ 2023-07",
      "source_quote": "총 445그루…고위험목으로 밝혀진 28그루를 모두 제거",
      "page_or_section": "https://kwnews.co.kr/page/view/2023080111214337100",
      "extraction_confidence": 0.85,
      "notes": "28/445 = 6.29%. 진단 대상이 이미 위험 의심목으로 선별된 상태이므로 일반 모집단 대비 상한 추정. 한글: 양버즘나무·대왕참나무·은행나무."
    },
    {
      "claim_type": "risk_factor",
      "metric_name": "양천구 지정 노선 위험목 비율 (이미 확보)",
      "metric_value": 0.20,
      "metric_unit": "ratio",
      "intervention": "구 단위 안전진단",
      "comparison_baseline": "노선 내 전체 가로수",
      "confidence_interval": null,
      "p_value": null,
      "sample_size": 350,
      "study_region": "서울 양천구",
      "species": ["unspecified"],
      "study_period": "2025",
      "source_quote": "350주 중 70주가 위험목",
      "page_or_section": "시정일보 2025-07-18 (사용자 사전 제공)",
      "extraction_confidence": 0.7,
      "notes": "사용자가 1차 사실로 사전 제공한 자료. 본 조사에서 새로 확보한 사실은 아니며 schema 일관성 위해 포함."
    },
    {
      "claim_type": "risk_factor",
      "metric_name": "대전 중구 양버즘 도복위험 제거 비율 (이미 확보)",
      "metric_value": 0.0268,
      "metric_unit": "ratio",
      "intervention": "전수 안전진단 후 위험목 제거",
      "comparison_baseline": "관리 대상 양버즘 전수",
      "confidence_interval": null,
      "p_value": null,
      "sample_size": 2500,
      "study_region": "대전 중구",
      "species": ["Platanus occidentalis"],
      "study_period": "2025",
      "source_quote": "2,500주 중 67주 제거",
      "page_or_section": "브레이크뉴스 2025-06-03 (사용자 사전 제공)",
      "extraction_confidence": 0.7,
      "notes": "사용자가 1차 사실로 사전 제공한 자료."
    },
    {
      "claim_type": "vector_dispersal",
      "metric_name": "양버즘 두절형 가지치기 후 수관울폐도(canopy closure)",
      "metric_value": 86.0,
      "metric_unit": "%",
      "intervention": "두절형(heading cut) 가지치기",
      "comparison_baseline": "자연형 69.9%",
      "confidence_interval": null,
      "p_value": null,
      "sample_size": 40,
      "study_region": "서울·대구 (총 40본)",
      "species": ["Platanus occidentalis"],
      "study_period": "2022-06, 2022-09 측정",
      "source_quote": "수관울폐도는 자연형(69.9%)보다 두절형(86.0%)이 높았다",
      "page_or_section": "안효준·박준형·김기우(2025) 농업생명과학연구 59(2):81-88 — https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART003199143",
      "extraction_confidence": 0.95,
      "notes": "사용자 사전 확보 사실의 보조 수치(영역2와 직접 관련—두절형 → 부후·공동·풍하중 증가 메커니즘). 발표연도 2025로 정정(사용자 메모 2024는 오기)."
    },
    {
      "claim_type": "spread_rate",
      "metric_name": "태풍 힌남노 영향 시 경기도 가로수 전도 건수",
      "metric_value": 94,
      "metric_unit": "events",
      "intervention": "태풍 통과 (자연 외력)",
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "경기도 광역",
      "species": ["unspecified"],
      "study_period": "2022-09-05 ~ 2022-09-06",
      "source_quote": "토사 유출 2건, 가로수 전도 94건",
      "page_or_section": "https://www.sisajournal.com/news/articleView.html?idxno=245883",
      "extraction_confidence": 0.85,
      "notes": "단일 태풍 이벤트 누적 건수. 그루당 연간 확률 환산은 모집단 미상으로 schema 외. 경기도 가로수 약 80만 주(추정) 대입 시 0.012%/event이나 추정 환산이므로 별도 보고."
    },
    {
      "claim_type": "open_question",
      "metric_name": "가로수 그루당 연간 가지부러짐·도복 발생 확률",
      "metric_value": null,
      "metric_unit": "events",
      "intervention": null,
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국 전국",
      "species": [],
      "study_period": null,
      "source_quote": null,
      "page_or_section": "보험개발원·손해보험협회·TAAS·KOSIS 검색 결과 가로수 단독 통계 없음",
      "extraction_confidence": 0.0,
      "notes": "TAAS는 가로수-차량 충돌 통계를 별도 분류하지 않음. 보험개발원·손보협회 PDF 보고서에서 가로수 사고 분리 통계 미확인. 자치구별 사고 건수는 정보공개청구가 필요."
    },
    {
      "claim_type": "open_question",
      "metric_name": "preventive pruning 처치군 vs 미처치군 사고 발생률 비교",
      "metric_value": null,
      "metric_unit": "ratio",
      "intervention": "preventive pruning",
      "comparison_baseline": "no pruning",
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국",
      "species": [],
      "study_period": null,
      "source_quote": null,
      "page_or_section": "한국조경학회지·한국임학회지 검색 결과 직접 비교 RCT/cohort 미확인",
      "extraction_confidence": 0.0,
      "notes": "안효준 외 2025는 부후/공동 발생률만, 사고 발생률(낙지·도복)과는 직접 연결 안 됨. mechanistic chain만 가능."
    },
    {
      "claim_type": "open_question",
      "metric_name": "사고당 평균 손해액(인적·물적 분리) KRW",
      "metric_value": null,
      "metric_unit": "KRW",
      "intervention": null,
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국",
      "species": [],
      "study_period": null,
      "source_quote": null,
      "page_or_section": "대법원 종합법률정보 5년치 키워드 검색에서 가로수 손해배상 판결문 단일 사례(성북구청 5억) 외 추가 표본 부재",
      "extraction_confidence": 0.0,
      "notes": "단일 사망사고 5억 KRW만 확인. 부상·차량 파손 평균액 산출에 필요한 표본 부족. 정보공개청구를 통한 자치구 변상 통계가 다음 단계."
    }
  ]
}
```

---

### 파일 2: `dr_2026_korea_species_mortality.json`

```json
{
  "paper_id": "deep_research_2026_korea_species_mortality",
  "title": "한국 도시 가로수 longitudinal mortality 직접 측정값 매핑 (7수종)",
  "year": 2026,
  "authors": ["deep research curation"],
  "doi": null,
  "query_category": "mechanism",
  "claims": [
    {
      "claim_type": "economic_loss",
      "metric_name": "한국 가로수 연간 고사 그루 수 (전국 합계)",
      "metric_value": 16000,
      "metric_unit": "events",
      "intervention": "현행 관리 체계",
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": 11000000,
      "study_region": "한국 전국",
      "species": ["multispecies"],
      "study_period": "2021",
      "source_quote": "2021년 한 해에만 1만 6000여 그루의 가로수가 고사",
      "page_or_section": "https://www.danbinews.com/news/articleView.html?idxno=26064 (윤재갑 의원실 자료 인용)",
      "extraction_confidence": 0.55,
      "notes": "단비뉴스가 윤재갑 의원실에서 받은 자료를 재인용. 1차 출처(국회 의원실 자료원본) 직접 확인 불가능 — 2차 인용. 분모 1,100만 그루로 환산 시 약 0.145%/yr 이나 추정 환산. 수종별 분리 X."
    },
    {
      "claim_type": "risk_factor",
      "metric_name": "한국 가로수 고사 원인 분포 (2020–2023, 103개 지자체)",
      "metric_value": 11944,
      "metric_unit": "events",
      "intervention": "회귀 후향 분류",
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": 11944,
      "study_region": "한국 전국 103개 시군구",
      "species": ["multispecies"],
      "study_period": "2020-01-01 ~ 2023-12-31",
      "source_quote": "관리 소홀 2443주, 환경/기후 2134주, 재난·사고 1007주",
      "page_or_section": "https://www.danbinews.com/news/articleView.html?idxno=26064",
      "extraction_confidence": 0.6,
      "notes": "고사 원인: 관리소홀 20.4%, 환경/기후 17.9%, 재난·사고 8.4%, 조성불량 8.0%, 자연사 2.7%, 모름 41.9%. 수종별 분리 X. 관리소홀이 직접 사망률 risk_factor로서 가장 큰 비중."
    },
    {
      "claim_type": "infection_rate",
      "metric_name": "LH 53개 아파트 단지 식재 교목 하자율(고사율)",
      "metric_value": 16.75,
      "metric_unit": "%",
      "intervention": "관행 식재 후 무관계 사후관리",
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": 124179,
      "study_region": "한국 전국 53개 LH 아파트 단지",
      "species": ["multispecies"],
      "study_period": "공개 시점 2023 (보도일 기준)",
      "source_quote": "교목 12만4179주 중 2만798주가 고사해 16.75%의 하자율",
      "page_or_section": "http://www.latimes.kr/news/articleView.html?idxno=17402",
      "extraction_confidence": 0.7,
      "notes": "LH 발표를 Landscape Times가 보도. 가로수가 아닌 단지 조경수이지만 한국 도시 식재 환경에서 가장 큰 표본. 기간 미상이나 통상 하자보수기간(2년) 기준일 가능성 높음 → 환산 8.4%/yr 이나 추정 환산이므로 별도 명시."
    },
    {
      "claim_type": "infection_rate",
      "metric_name": "LH 경기북부 상록교목 하자율",
      "metric_value": 41.45,
      "metric_unit": "%",
      "intervention": "동해(凍害) 노출 환경 식재",
      "comparison_baseline": "전국 평균 16.75%",
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "경기 북부",
      "species": ["multispecies (상록교목)"],
      "study_period": "공개 2023",
      "source_quote": "경기북부 상록교목 41.45%, 낙엽교목 34.54%의 하자률",
      "page_or_section": "http://www.latimes.kr/news/articleView.html?idxno=17402",
      "extraction_confidence": 0.65,
      "notes": "동해 risk_factor가 mortality에 미치는 영향 직접 측정값. Pinus densiflora 별도값 미제공. 가로수 7수종 중 메타세쿼이아·소나무 등 한대 적합종 mortality 추정의 보조."
    },
    {
      "claim_type": "infection_rate",
      "metric_name": "세종 6생활권 노각나무 하자율",
      "metric_value": 56.8,
      "metric_unit": "%",
      "intervention": "BRT 도로변 가로변 식재",
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": 632,
      "study_region": "세종특별자치시 6생활권",
      "species": ["Stewartia pseudocamellia"],
      "study_period": "식재 후 약 2년 경과 (보도 2017)",
      "source_quote": "노각나무는 632그루 중 359그루(하자율 56.8%)가 말라 죽었고",
      "page_or_section": "https://www.sjsori.com/news/articleView.html?idxno=21449",
      "extraction_confidence": 0.7,
      "notes": "7대 가로수 수종 중 해당 없음(노각나무). Mortality benchmarking용. 한대지(세종) BRT 환경의 가로변 식재 mortality 상한 사례."
    },
    {
      "claim_type": "infection_rate",
      "metric_name": "세종 2생활권 왕벚나무 하자율",
      "metric_value": 14.7,
      "metric_unit": "%",
      "intervention": "도시변 식재 후 약 2년",
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": 338,
      "study_region": "세종특별자치시 2생활권",
      "species": ["Prunus × yedoensis"],
      "study_period": "보도 2017 기준 (정확 기간 미상)",
      "source_quote": "왕벚나무 역시 338그루 중 50여 그루(하자율 14.7%)",
      "page_or_section": "https://www.sjsori.com/news/articleView.html?idxno=21449",
      "extraction_confidence": 0.65,
      "notes": "한국 7수종 중 첫 번째 — Prunus × yedoensis cohort mortality 직접 측정값. 단 기간이 명시되지 않아 연 환산 불가. 14.7%는 누적값. 추정 환산: 2년 기준이면 약 7.6%/yr이나 별도 명시."
    },
    {
      "claim_type": "treatment_efficacy",
      "metric_name": "의성군 보호조치 적용 수목 고사율 (3년 누적)",
      "metric_value": 0.0,
      "metric_unit": "%",
      "intervention": "친환경 섬유 수목보호대 + 보온재 + 방풍벽",
      "comparison_baseline": "관리하지 않을 때 고사율 (미명시)",
      "confidence_interval": null,
      "p_value": null,
      "sample_size": 277,
      "study_region": "경북 의성군",
      "species": ["Lagerstroemia indica", "Prunus serrulata var."],
      "study_period": "최근 3년",
      "source_quote": "최근 3년간 하자검사에서 보호조치를 적용한 수목의 고사율이 0%",
      "page_or_section": "https://www.kyongbuk.co.kr/news/articleView.html?idxno=4057787",
      "extraction_confidence": 0.5,
      "notes": "표본 277본은 배롱나무·겹벚나무 등 보온대상목. 가로수 7수종과 직접 매핑 약함. 0%는 작은 표본 부정 결과일 수 있고 비교군 부재로 treatment_efficacy 인과추론 약함. 한글: 배롱나무·겹벚나무."
    },
    {
      "claim_type": "open_question",
      "metric_name": "Prunus × yedoensis 도시 가로수 연간 mortality (한국)",
      "metric_value": null,
      "metric_unit": "%",
      "intervention": null,
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국 도시",
      "species": ["Prunus × yedoensis"],
      "study_period": null,
      "source_quote": null,
      "page_or_section": "한국조경학회지·한국임학회지 5년치 검색에서 종별 cohort 직접 측정 미확인",
      "extraction_confidence": 0.0,
      "notes": "세종 14.7% 누적값 외 한국 가로수 환경 종별 longitudinal cohort 직접 측정값 부재."
    },
    {
      "claim_type": "open_question",
      "metric_name": "Ginkgo biloba 도시 가로수 연간 mortality (한국)",
      "metric_value": null,
      "metric_unit": "%",
      "intervention": null,
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국 도시",
      "species": ["Ginkgo biloba"],
      "study_period": null,
      "source_quote": null,
      "page_or_section": "data.go.kr/data.seoul.go.kr 가로수 위치정보 데이터셋은 single-snapshot으로 mortality 시계열 추출 불가",
      "extraction_confidence": 0.0,
      "notes": "서울시 가로수 위치정보 (15014837) 1회 스냅샷. 시계열 비교용 repeated inventory 공개 자료 미확인."
    },
    {
      "claim_type": "open_question",
      "metric_name": "Zelkova serrata, Acer palmatum, Metasequoia glyptostroboides, Platanus × acerifolia, Pinus densiflora 한국 가로수 종별 mortality",
      "metric_value": null,
      "metric_unit": "%",
      "intervention": null,
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국",
      "species": ["Zelkova serrata", "Acer palmatum", "Metasequoia glyptostroboides", "Platanus × acerifolia", "Pinus densiflora"],
      "study_period": null,
      "source_quote": null,
      "page_or_section": "Parhizgar et al. 2025 supplementary 한국 종 데이터 미포함, 산림청·국립생태원·국립산림과학원 발간 가로수 종별 보고서 mortality 직접 측정값 미확인",
      "extraction_confidence": 0.0,
      "notes": "양버즘은 안효준 외 2025의 부후·수관울폐도 직접 측정값은 있으나 mortality 아님. 7수종 모두 신뢰도 high(5+yr repeated inventory) 만족하는 한국 데이터 없음."
    }
  ]
}
```

---

### 파일 3: `dr_2026_korea_unit_costs.json`

```json
{
  "paper_id": "deep_research_2026_korea_unit_costs",
  "title": "한국 시군별 가로수 식재·정비·제거 단가 직접 측정값",
  "year": 2026,
  "authors": ["deep research curation"],
  "doi": null,
  "query_category": "proposition_b",
  "claims": [
    {
      "claim_type": "intervention_cost",
      "metric_name": "왕벚나무 신규 식재용 R10cm급 도착도 시장가",
      "metric_value": 200000,
      "metric_unit": "KRW",
      "intervention": "메워심기용 가로수 묘목 도착도",
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국 전국 평균 (KREI 임업관측)",
      "species": ["Prunus × yedoensis"],
      "study_period": "2023-12 기준 (보도 2024-03)",
      "source_quote": "왕벚나무와 은행나무는 지난해 12월 기준 각각 20만 원, 15만 원",
      "page_or_section": "https://www.danbinews.com/news/articleView.html?idxno=26064",
      "extraction_confidence": 0.7,
      "notes": "단비뉴스가 KREI 임업관측 데이터를 인용. 식재비·운반비·관리비는 미포함, 도착도 시장가만. 시·군 발주 낙찰가는 일반적으로 이보다 높음. 사용자가 사전에 언급한 KREI 통권 644호의 자료와 일치."
    },
    {
      "claim_type": "intervention_cost",
      "metric_name": "은행나무 신규 식재용 R10cm급 도착도 시장가",
      "metric_value": 150000,
      "metric_unit": "KRW",
      "intervention": "메워심기용 가로수 묘목 도착도",
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국 전국 평균",
      "species": ["Ginkgo biloba"],
      "study_period": "2023-12",
      "source_quote": "은행나무는…각각 20만 원, 15만 원",
      "page_or_section": "https://www.danbinews.com/news/articleView.html?idxno=26064",
      "extraction_confidence": 0.7,
      "notes": "동상."
    },
    {
      "claim_type": "intervention_cost",
      "metric_name": "건설공사 표준시장단가 가로수 제거 공종 (DB***)",
      "metric_value": null,
      "metric_unit": "KRW",
      "intervention": "굴삭기 사용 가로수 제거",
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국 전국 적용",
      "species": [],
      "study_period": "2025년 상반기 적용 (국토교통부 2025-01)",
      "source_quote": "소각비용 등이 요구되는 경우는 별도로 계상하여야 하며, 가로수 제거에는",
      "page_or_section": "국토교통부·한국건설기술연구원 「2025년 상반기 건설공사표준시장단가 적용공종 및 단가」 — https://files-scs.pstatic.net/2024/12/30/IOFpj7Mywo/2025년_상반기_적용_건설공사_표준시장단가.pdf",
      "extraction_confidence": 0.6,
      "notes": "PDF 본문에 가로수 제거 공종이 별도 코드로 존재함을 확인. 단가 수치 자체는 PDF 표 내부에 있으며 본 조사에서 표 내부 수치까지는 추출하지 못함. 직접 측정값으로 인용하려면 PDF 표 직접 확인 필요. 시·군 낙찰가는 이 표준단가 × 낙찰률 (적격심사 87.745% 등)."
    },
    {
      "claim_type": "intervention_cost",
      "metric_name": "전국 적격심사 낙찰하한율 (10억 미만 공사)",
      "metric_value": 89.745,
      "metric_unit": "%",
      "intervention": "2026-01-30 이후 입찰공고분",
      "comparison_baseline": "변경전 87.745%",
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국 전국",
      "species": [],
      "study_period": "2026-01-30 시행",
      "source_quote": "10억 미만 공사는 89.745%, 50억~10억 공사는 88.745%",
      "page_or_section": "https://www.bidq.co.kr/bidq/bids/index/summary",
      "extraction_confidence": 0.85,
      "notes": "가로수 식재·정비 공사 발주 대부분이 10억 미만이므로 낙찰가 = 표준단가 × 0.89745. 시·군 단가 추정의 핵심 계수."
    },
    {
      "claim_type": "open_question",
      "metric_name": "시·군별 가로수 식재 그루당 평균 낙찰가 (5년 통계)",
      "metric_value": null,
      "metric_unit": "KRW",
      "intervention": null,
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국 시·군",
      "species": [],
      "study_period": "2020-2024",
      "source_quote": null,
      "page_or_section": "나라장터 g2b.go.kr OpenAPI(15129397) 직접 쿼리 필요 — deep research에서 1만+ 입찰 결과 일괄 추출 불가",
      "extraction_confidence": 0.0,
      "notes": "공공데이터포털 「전국낙찰정보표준데이터」(15023681) 및 「조달청 나라장터 낙찰정보서비스」 OpenAPI를 키워드 '가로수 식재' 등으로 5년치 추출하면 가능. 본 조사는 deep research 도구 한계로 미수행. 다음 단계는 API 호출 스크립트 작성."
    },
    {
      "claim_type": "open_question",
      "metric_name": "양버즘나무 R10cm급 도착도 시장가",
      "metric_value": null,
      "metric_unit": "KRW",
      "intervention": null,
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국 전국",
      "species": ["Platanus × acerifolia"],
      "study_period": null,
      "source_quote": null,
      "page_or_section": "KREI 임업관측 통권 644호에 미포함 (사용자 메모와 일치)",
      "extraction_confidence": 0.0,
      "notes": "사용자 사전 메모대로 KREI 자료에서 양버즘만 누락. 한국조경수협회 또는 산림조합 묘목센터 가격 조회 필요."
    }
  ]
}
```

---

### 파일 4: `dr_2026_korea_hedonic.json`

```json
{
  "paper_id": "deep_research_2026_korea_hedonic",
  "title": "한국 부동산 hedonic 회귀에서 가로수 단일 변수 marginal value",
  "year": 2026,
  "authors": ["deep research curation"],
  "doi": null,
  "query_category": "proposition_b",
  "claims": [
    {
      "claim_type": "open_question",
      "metric_name": "한국 도시 hedonic 회귀에서 가로수 단일 변수 marginal value",
      "metric_value": null,
      "metric_unit": "%",
      "intervention": null,
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국",
      "species": [],
      "study_period": null,
      "source_quote": null,
      "page_or_section": "An et al. 2023 Sci Rep PMC10730891, Han·Woo·Lee 2025 PLOS ONE pone.0323495, Ki & Lee 2021 Landscape Urban Plan 103920 — 모두 통합 streetscape/greenness 변수 사용",
      "extraction_confidence": 0.0,
      "notes": "검색 결과 한국에서 가로수 변수를 공원·NDVI·streetscape green 변수와 분리한 hedonic 회귀계수가 학술지에 보고된 사례를 확인하지 못함. (a) An et al. 2023 부산: greenness ratio 통합변수, 부의 회귀계수 일부 유의 — 한국 가로수만 분리 X. (b) Han·Woo·Lee 2025 서울 단독주택: SHAP 기반 streetscape 통합 변수 — 가로수만 분리 X. (c) Ki & Lee 2021 서울: green view index 통합 변수, 양의 보행 효과. 신뢰도 기준 미달(통합변수만 = low) → 보고하지 않음."
    },
    {
      "claim_type": "open_question",
      "metric_name": "Donovan & Butry 2010 Portland $7020/tree 한국 적용 후속 연구",
      "metric_value": null,
      "metric_unit": "KRW",
      "intervention": null,
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국",
      "species": [],
      "study_period": null,
      "source_quote": null,
      "page_or_section": "국토연구원·서울연구원·한국부동산원 발간자료 검색 결과 가로수 그루당 marginal value Donovan-Butry 방법 한국 직접 적용 사례 미확인",
      "extraction_confidence": 0.0,
      "notes": "사용자 메모대로 한국 적용 후속 연구 부재 확인. 한국부동산학회지·한국감정평가학회지 검색에서도 가로수 단일 변수 분리 hedonic 미확인. 정책적 함의: 한국 BCR 모델은 Donovan-Butry 외부 transfer로 진행하되 transfer error band를 명시해야 함."
    }
  ]
}
```

---

### 파일 5: `dr_2026_korea_census_mapping.json`

```json
{
  "paper_id": "deep_research_2026_korea_census_mapping",
  "title": "한국 가로수 census 데이터 매핑 — 데이터 보유 기관 식별",
  "year": 2026,
  "authors": ["deep research curation"],
  "doi": null,
  "query_category": "mechanism",
  "claims": [
    {
      "claim_type": "detection_accuracy",
      "metric_name": "서울시 가로수 위치정보 데이터셋 보유 컬럼",
      "metric_value": 289000,
      "metric_unit": "events",
      "intervention": "공공데이터 개방",
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": 289000,
      "study_region": "서울특별시 (종로구 미포함)",
      "species": ["multispecies"],
      "study_period": "2024년 말 기준",
      "source_quote": "수목명, 품계수종, 수고, 흉고지름, 수관너비, 품계활력, 품계위치",
      "page_or_section": "https://www.data.go.kr/dataset/15014837/fileData.do (서울시 가로수 위치정보 WGS1984)",
      "extraction_confidence": 0.85,
      "notes": "요구 컬럼 매핑: tree_id=수목고유번호 ✓, x=경도 ✓, y=위도 ✓, species=품계수종(라틴 미공개, 한글) ⚠, dbh_cm=흉고지름 ✓, crown_asymmetry=수관너비(대칭성 X) ⚠, ndvi=X ✗, elevation_m=X ✗, mean_temp_c=X ✗. 시계열 X — 2012년 1회 구축 + 2024 트리맵 현행화 작업 진행 중. 서울시 정원도시국 조경과(2133-2849) 데이터 공유 협약 신청 가능."
    },
    {
      "claim_type": "detection_accuracy",
      "metric_name": "서울시 가로수 트리맵 시스템 (2026 운영 개시)",
      "metric_value": 289000,
      "metric_unit": "events",
      "intervention": "스마트서울맵 연동 + 일련번호 부여",
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": 289000,
      "study_region": "서울특별시",
      "species": ["multispecies"],
      "study_period": "2023 데이터 수집 → 2024 좌표·일련번호 → 2025 현행화 → 2026 운영",
      "source_quote": "스마트서울맵과 연동돼 있어 지역별·도로 노선별·수종별 가로수 정보를 제공",
      "page_or_section": "https://news.seoul.go.kr/env/archives/567149",
      "extraction_confidence": 0.85,
      "notes": "전국 최초 시계열 구축 기반. 시계열 mortality 추출이 2026년부터 가능해질 것. 데이터 협약 1순위 기관."
    },
    {
      "claim_type": "detection_accuracy",
      "metric_name": "전국 가로수길 표준데이터 보유 기관 매핑",
      "metric_value": null,
      "metric_unit": "events",
      "intervention": "공공데이터포털 표준데이터셋",
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국 전국 (지자체별)",
      "species": [],
      "study_period": "월별 갱신",
      "source_quote": "가로수길명, 가로수종류, 가로수수량, 식재연도, 관리기관명",
      "page_or_section": "https://www.data.go.kr/data/15021145/standard.do",
      "extraction_confidence": 0.75,
      "notes": "그루별(개체) 데이터가 아닌 노선(line)별 집계 데이터. 1만+ 개체 census와 직접 일치 X. 그러나 시·군 식재 연도 메타가 있어 cohort 추적 보조에 활용 가능."
    },
    {
      "claim_type": "open_question",
      "metric_name": "1만+ 그루 공개 census + NDVI/elevation/mean_temp/crown_asymmetry 통합 데이터셋",
      "metric_value": null,
      "metric_unit": "events",
      "intervention": null,
      "comparison_baseline": null,
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "한국",
      "species": [],
      "study_period": null,
      "source_quote": null,
      "page_or_section": "data.go.kr·data.seoul.go.kr·산림청 검색 결과 NDVI·기온·관 비대칭 통합 가로수 census 부재",
      "extraction_confidence": 0.0,
      "notes": "데이터 협약 신청 우선순위: (1) 서울시 정원도시국 — 트리맵 raw + 위치정보, (2) 수원시 도시숲정책과 — 시범사업 cadaster, (3) 국립산림과학원 도시숲연구과 — LiDAR 기반 raw point cloud 일부 보유 가능성. NDVI는 환경부 환경공간정보서비스(EGIS) 또는 KOMPSAT/Landsat 별도 결합 필요. mean_temp_c는 기상청 ASOS/AWS 1km 격자 결합. crown_asymmetry는 LiDAR 또는 deep learning 별도 산출."
    }
  ]
}
```

---

### 파일 6: `dr_2026_preventive_pruning_2025.json`

```json
{
  "paper_id": "deep_research_2026_preventive_pruning_2025",
  "title": "Preventive pruning ↦ mortality 직접 측정값 (2024–2025 long-term cohort)",
  "year": 2026,
  "authors": ["deep research curation"],
  "doi": null,
  "query_category": "mechanism",
  "claims": [
    {
      "claim_type": "treatment_efficacy",
      "metric_name": "Boston street tree repeated inventory mortality (관련 cohort 베이스라인)",
      "metric_value": 3.06,
      "metric_unit": "%",
      "intervention": "현행 도시 관리 (preventive pruning 명시 X)",
      "comparison_baseline": "Boston 농촌 산림 1.41%/yr",
      "confidence_interval": [2.81, 3.31],
      "p_value": null,
      "sample_size": null,
      "study_region": "Boston, MA, USA",
      "species": ["multispecies"],
      "study_period": "2005/06 → 2014",
      "source_quote": "3.06 ± 0.25% yr−1 in street trees; 1.41 ± 0.04% yr−1 in rural",
      "page_or_section": "Smith·Dearborn·Hutyra (2019) PLOS ONE PMC6505744 — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6505744/",
      "extraction_confidence": 0.85,
      "notes": "preventive pruning 처치군 대비 미처치군의 직접 mortality 차이를 보고하지 않음. 도시 vs 농촌 비교만. 사용자가 요구한 'preventive pruning이 mortality를 직접 감소시키는 측정값'에 직접 부합하지 않음. 2024–2025 발표 아님(2019)."
    },
    {
      "claim_type": "open_question",
      "metric_name": "preventive pruning 처치군 vs 대조군 mortality (10년 cohort, 2024–2025)",
      "metric_value": null,
      "metric_unit": "%",
      "intervention": "structural/preventive pruning",
      "comparison_baseline": "no structural pruning",
      "confidence_interval": null,
      "p_value": null,
      "sample_size": null,
      "study_region": "global",
      "species": [],
      "study_period": "2024–2025",
      "source_quote": null,
      "page_or_section": "USDA Treesearch / Arboriculture & Urban Forestry / Urban Forestry & Urban Greening 2024–2025 검색 결과 직접 비교 RCT/cohort 미확인",
      "extraction_confidence": 0.0,
      "notes": "Petrova·Michael·Pratt 2025 (PMC12084175) systematic review는 dieback 원인 분류만, pruning intervention 효과 비교 X. Vogt·Hauer·Fischer 2015 review는 pruning 비용·편익 정성 분석. 결론: no new direct measurement evidence in 2024–2025. preventive_pruning mortality efficacy 측정값 = 0 (직접측정 부재). 본 영역은 결과 보고 sealed."
    }
  ]
}
```

---

## summary.md

### (a) Evidence Tables — 영역별 핵심 직접 측정값

**영역 2 (Safety)**

| metric | value | source | confidence |
|---|---|---|---|
| 단일 가로수 도복 사망사고 1심 인정액 | 500,000,000 KRW | 서울고법 2024-04-26 항소심 | 0.95 |
| 원주시 진단 대상 중 고위험목 비율 | 6.29% (28/445) | 강원일보 2023-08-01 | 0.85 |
| 양천구 위험목 비율 | 20% (70/350) | 시정일보 2025-07-18 | 0.70 (사용자 사전제공) |
| 대전 중구 양버즘 제거 비율 | 2.68% (67/2500) | 브레이크뉴스 2025-06-03 | 0.70 (사용자 사전제공) |
| 양버즘 두절형 vs 자연형 수관울폐도 | 86.0% vs 69.9% (n=40) | 안효준 외 2025 농생연구 59(2) | 0.95 |
| 태풍 힌남노 경기도 가로수 전도 | 94 events (2022-09-05/06) | 시사저널 2022-09-06 | 0.85 |

**영역 1 (Mortality)**

| metric | value | source | confidence |
|---|---|---|---|
| 한국 가로수 연간 고사 (2021) | 16,000 events | 윤재갑 의원실/단비뉴스 | 0.55 |
| LH 53단지 교목 하자율 | 16.75% (20,798/124,179) | LH/Landscape Times | 0.70 |
| LH 경기북부 상록교목 하자율 | 41.45% | LH/Landscape Times | 0.65 |
| 세종 6생활권 노각나무 | 56.8% (359/632) | 세종의소리 | 0.70 |
| 세종 2생활권 왕벚나무 | 14.7% (50/338) | 세종의소리 | 0.65 |
| 의성군 보호조치 수목 고사율 | 0% (n=277, 3년) | 경북일보 | 0.50 |

**영역 4 (Unit cost)**

| metric | value | source | confidence |
|---|---|---|---|
| 왕벚 R10cm 도착도 | 200,000 KRW | KREI/단비뉴스 2024-03 | 0.70 |
| 은행 R10cm 도착도 | 150,000 KRW | KREI/단비뉴스 2024-03 | 0.70 |
| 적격심사 낙찰하한율 (10억 미만) | 89.745% (2026-01-30 시행) | bidq.co.kr | 0.85 |

**영역 3 (Hedonic per-tree)**: 직접 측정값 0개

**영역 5 (Census mapping)**: 직접 데이터셋 식별 — 서울시 트리맵(289천주, 2026 운영), 서울 가로수 위치정보(15014837)

**영역 6 (Pruning)**: 2024–2025 신규 직접 측정값 0개 — sealed

### (b) Parameter Recommendations (key·범위·confidence)

| Parameter | Range | Confidence | 근거 |
|---|---|---|---|
| `safety.fatal_event_payout_KRW` | 5e8 (point estimate, 단일사례) | low | n=1 사례 |
| `safety.high_risk_tree_ratio` (진단 대상 중) | 2.7%–20% (범위) | medium | 3개 자치구 사례, 모집단 상이 |
| `safety.high_risk_tree_ratio` (전체 진단대상 중 고위험판정) | ~6%–7% | medium | 원주시 6.29% 단일 |
| `mortality.korea_annual_baseline` | 0.10%–0.20%/yr | low | 16k/11M 환산, 지자체 절반 미보고 |
| `mortality.korea_2yr_cohort_high_risk_site` | 14%–57% | low | 세종 BRT, LH 단지 |
| `unit_cost.sapling_cherry_KRW` | 200,000 (R10cm 도착도, +식재비·운반비 시 1.5–2배) | medium | KREI 2023-12 |
| `unit_cost.sapling_ginkgo_KRW` | 150,000 (R10cm) | medium | KREI 2023-12 |
| `unit_cost.bid_award_ratio` | 0.89745 (10억 미만 공사) | high | 비드큐 2026 적용 |
| `hedonic.per_tree_marginal_KRW` | **DNF — Donovan-Butry transfer 권장** | n/a | 한국 직접 측정 부재 |
| `pruning.heading_cut_decay_increase` | 자연형 0% → 두절형 검출됨 (binary) + 수관울폐도 +16.1pp | high | 안효준 외 2025, n=40 |
| `pruning.preventive_mortality_reduction` | **DNF** (no 2024–2025 evidence) | n/a | sealed |

### (c) Open Questions (다음 조사 단계)

1. **Safety**: 보험개발원·손보협회 PDF 직접 입수 + TAAS micro-data API 정보공개청구 (가로수 사고 분류코드 신설 필요).
2. **Mortality**: 서울시 트리맵 2026 운영 후 1년 + 2년 시점 시계열 mortality 추출. 윤재갑 의원실 자료 원본 PDF 직접 확보(국회의안정보시스템).
3. **Unit cost**: 나라장터 OpenAPI(15129397)에 키워드 '가로수 식재', '가로수 정비', '고사목 제거' 5년치 일괄 추출 스크립트 작성 — 시·군별 그루당 평균 낙찰가 산출.
4. **Hedonic**: 국토교통부 실거래가 + 서울 가로수 위치정보를 결합해 가로수 단일 변수 분리 hedonic 회귀를 직접 수행 — Donovan-Butry 방법론 한국 적용 1차 연구 자체가 빈자리.
5. **Census**: 데이터 협약 신청 1순위 = 서울시 정원도시국(트리맵 raw), 2순위 = 수원시 도시숲정책과, 3순위 = 국립산림과학원 도시숲연구과(LiDAR).
6. **Preventive pruning**: 안효준 외 2025의 부후·공동 발생 → mortality 연결을 위해 동일 표본 5년 후 추적조사 한국 연구 의뢰 필요. 외국 cohort에서도 2024–2025 직접 측정값 없음 — 이 영역의 결론은 v0.3에서도 보류 권장.

---

## Caveats

- **2차 인용 risk**: 윤재갑 의원실 16,000그루/year 수치, LH 53단지 16.75% 하자율은 1차 보고서를 직접 보지 못하고 단비뉴스/Landscape Times를 통해 인용한 값이라 extraction_confidence 0.55–0.70로 낮춤. 본격적인 의사결정 시스템 입력으로 쓰려면 원본 보고서 직접 확보 필요.
- **수종별 분리 mortality**: 7수종 전부에 대해 한국 도시 환경 longitudinal cohort 직접 측정값을 확보하지 못함. 세종 사례(왕벚 14.7%, 노각 56.8%)는 식재 직후 ~2년 누적 하자율로 정상 cohort mortality와 다름(LH 발주의 하자보수 책임기간이 2년이라는 제도적 효과가 데이터에 반영). 외국 데이터(Smith et al. 2019 Boston 3.06%/yr) 외부 transfer 시 한국 종 적합성 가정 필요.
- **시·군별 낙찰가**: 본 deep research에서 g2b API를 직접 호출하지 못해 점단위 수치 부재. 2025년 상반기 표준시장단가 PDF에 가로수 제거 공종이 포함되어 있음을 확인했으나 표 내부 구체 수치까지는 본문 추출 한계.
- **Hedonic**: 한국 학술지에서 가로수 단일 변수가 streetscape/NDVI 통합변수와 분리되어 보고된 회귀계수가 사실상 없음. Donovan-Butry $7,020/tree(2010 USD, Portland)는 외국 transfer 그대로 쓰지 말고 transfer error band를 포함해야 한다는 점이 본 조사의 가장 큰 함의.
- **Preventive pruning**: 사용자가 요구한 "10-year preventive pruning mortality cohort" 직접 측정값은 2024–2025 영문·국문 모두 미확인. v0.3의 multi-objective BCR에서 이 메커니즘 가지를 모델에서 제외하거나, 안효준 외 2025의 부후·공동 발생률 → 풍하중 mechanistic chain으로 우회하여 연결할 것을 권고.
- **단일 사망사고 5억 KRW의 일반화 위험**: 단일 판결문의 인적 피해 인용액을 그대로 평균값으로 쓰면 안 됨. 부상사고·물적 피해는 별도 표본이 필요하며, 평균은 사망 사고 빈도가 매우 낮으므로 mode가 아닌 expected loss로 계산해야 함.
- **추정 환산 명시 원칙**: 본 보고서는 schema 핵심 규칙 1에 따라, 어느 출처에도 직접 등장하지 않는 숫자는 metric_value에 넣지 않고 모두 notes 또는 별도 추정 환산 텍스트로 분리했음 (예: 16,000/11,000,000 = 0.145%/yr 환산은 schema 외 본문 비고로만 명시).