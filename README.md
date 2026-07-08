# UB English Study

영어 학습 플래시카드 — 표현·패턴·문장·서사 + 받아쓰기 드릴. upup-cycle의 `/english` 페이지에서 독립한 단독 사이트.

## 구성

- `index.html` — 전체 앱(자기완결, 인라인 CSS/JS + 내장 DB). 빌드 불필요.
- `api/sync.mjs` — 즐겨찾기 기기 간 동기화용 중계 함수. 같은 도메인이라 CORS 불필요.
  - 저장소: Upstash Redis(Vercel 마켓플레이스 연동, 무료 티어). 인증·암호화 없음(개인 학습 즐겨찾기 id만 저장).
  - 환경변수 `KV_REST_API_URL`/`KV_REST_API_TOKEN`(또는 `UPSTASH_REDIS_REST_*`)이 없으면 구 jsonblob으로 폴백.
  - Redis가 빈 최초 GET 때 jsonblob 잔여 데이터를 자동 이관(일회성 시드).
  - 이력: 무가입 jsonblob을 쓰다가 예고 없이 유실된 적이 있어(2026-07) 계정 귀속 저장소로 이전.

## 배포

Vercel 정적 배포(제로 설정). 루트의 `index.html`이 `/`로, `api/sync.mjs`가 `/api/sync`로 서빙됨.

## 새 학습분 추가 (Day 21+)

내장 DB(136KB 한 줄)를 손으로 고치지 말고 스크립트를 쓸 것:

```bash
node tools/add-data.mjs new-data.json --dry-run   # 검증만
node tools/add-data.mjs new-data.json             # 실제 추가 (index.html.bak 백업 자동 생성)
```

- 입력 형식은 `tools/example-new-data.json` 참고. 필요한 컬렉션만 넣으면 됨.
- 필수 필드·타입·중복(기존+신규)·오타 필드를 검증하고, 문제 있으면 아무것도 안 바꿈.
- patterns `id`(P125…)와 recall `id`(r+해시)는 자동 부여. phrases `star`는 false 기본.
- 헤더의 개수(패턴 N · 표현 N …)와 Day 범위도 자동 갱신.
- 새 week/group/cat 값은 허용하되 경고로 알려줌(오타 방지).

## 실황중계 탭 (06 · Daily Narration · self-talk)

하루 전체(기상~귀가) 실황중계 — 행동하는 순간 현재진행형으로 중얼거리는 훈련 세트. 문장 탭 → 뜻·타이밍·용법·대안·변형·축약 펼침 + 발음(TTS) + 시제 토글(실황↔복기 과거형).

- **데이터**: `const NARR={…};` 한 줄 (`daily_narration_v1_9.json` 그대로, 현재 v1.9 = 100문장·18구간). `add-data.mjs`와 무관 — 갱신은 새 JSON으로 그 줄만 통째로 교체.
- **파일명 규칙(2026-07-07 리네이밍)**: `daily_narration_morning*` → `daily_narration*` — v1.9에서 스코프가 하루 전체로 확장되어 morning은 레거시(meta.scope_note 참조). repo에는 JSON 파일이 없고 인라인 임베드라 git mv 대상 없음. **UI 표시명도 meta.title(레거시 "아침 루틴")과 분리**해 "실황중계 · Daily Narration" 고정 표기.
- **배치 사유**: 핸드오프는 "데이터 디렉토리 배치"였으나 이 repo 컨벤션이 내장 DB(자기완결 단일 파일)라 인라인 임베드로 갈음.
- **v1.5 보강(2026-07-07)**: 전 50문장에 `past`(복기용 과거형, 시제 토글로 표시), 22문장에 `vars`(슬롯 변형), micro_points 10→18개. **기존 필드는 무변경, optional 필드만 추가** — 자동 시제 변환은 하지 않고 past도 데이터로 관리(불규칙 동사 안전).
- **v1.6 갱신(2026-07-07, Chat 세션 제작)**: 운전 3문장(차선변경×2, pull over)·도어락 1문장 추가, 점심(10문장)·정리·휴식(5문장) 구간 신설 — 50→69문장·11→13구간, micro_points 18→23개. 신규 문장 전원 `past` 포함.
- **v1.9 갱신(2026-07-07, Chat 세션 제작)**: v1.7·v1.8 포함 — 편의점 계산·세면·준비·흡연 보강, 퇴근·헬스장·샤워·귀가 5구간 신설. 69→100문장·13→18구간, micro_points 23→32개. 콩글리시 교정(treadmill·gym·locker 등).
- **v1.9.1 추가(2026-07-08, 뷰어 측)**: 샤워·마무리에 스킨케어 2문장(moisturizer·face lotion) 추가. 100→102문장. 전체 `no` 재부여(재수록 참조는 `en` 기반이라 영향 없음 — 13개 유지 확인).
- `micro_points`에는 **P번호를 부여하지 않음** — P 체계는 Chat 세션에서 관리(충돌 방지).
- 헤더의 "실황중계 N" 개수와 리드 문구(버전)는 NARR에서 동적 렌더 — 데이터만 갈아끼워도 stale 없음.
- **재수록(뷰 전용, `ST_REFS`)**: 운전 문장을 퇴근·이동(8문장)·귀가(5문장) 구간에 다시 표시 — 이동 중 구간을 오가는 불편 해소. 데이터 무변경, `en` 문자열로 참조(`no`는 버전마다 밀림), ↻ 배지 + 점선 테두리로 원본 구간 표시. 데이터 교체 후 문장 문구가 바뀌면 해당 참조는 조용히 빠지므로 교체 시 재수록 개수 확인할 것.

## 동기화 동작

부팅 시 cloudPull, 즐겨찾기 토글 시 디바운스 cloudPush. 네트워크 실패 시 localStorage로 정상 동작.
최초 연결은 로컬∪클라우드 합집합(기존 즐겨찾기 보존), 이후엔 클라우드 기준(삭제 전파).
