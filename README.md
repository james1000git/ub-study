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

## 실황중계 탭 (06 · self-talk narration)

아침 루틴 실황중계 — 행동하는 순간 현재진행형으로 중얼거리는 훈련 세트. 문장 탭 → 뜻·타이밍·용법·대안·축약 펼침 + 발음(TTS).

- **데이터**: `const NARR={…};` 한 줄 (`daily_narration_morning.json` 원본 그대로, 스키마 무변경). `add-data.mjs`와 무관 — 갱신은 새 JSON으로 그 줄만 통째로 교체.
- **배치 사유**: 핸드오프는 "데이터 디렉토리 배치"였으나 이 repo 컨벤션이 내장 DB(자기완결 단일 파일)라 인라인 임베드로 갈음.
- `micro_points`에는 **P번호를 부여하지 않음** — P 체계는 Chat 세션에서 관리(충돌 방지).
- 과거형(차 안 복기 모드)은 데이터에 `past` 필드가 추가된 뒤 구현 — 렌더 시 자동 변환 금지(waking→woke 등 불규칙).
- 헤더의 "실황중계 N" 개수와 리드 문구(버전)는 NARR에서 동적 렌더 — 데이터만 갈아끼워도 stale 없음.

## 동기화 동작

부팅 시 cloudPull, 즐겨찾기 토글 시 디바운스 cloudPush. 네트워크 실패 시 localStorage로 정상 동작.
최초 연결은 로컬∪클라우드 합집합(기존 즐겨찾기 보존), 이후엔 클라우드 기준(삭제 전파).
