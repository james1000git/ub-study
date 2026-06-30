# UB English Study

영어 학습 플래시카드 — 표현·패턴·문장·서사 + 받아쓰기 드릴. upup-cycle의 `/english` 페이지에서 독립한 단독 사이트.

## 구성

- `index.html` — 전체 앱(자기완결, 인라인 CSS/JS + 내장 DB). 빌드 불필요.
- `api/sync.mjs` — 즐겨찾기 기기 간 동기화용 중계 함수. 같은 도메인이라 CORS 불필요.
  - 저장소: 무가입 jsonblob. 인증·암호화 없음(개인 학습 즐겨찾기 id만 저장).
  - upup-cycle 시절과 **같은 blob URL**을 써서 기존 즐겨찾기가 그대로 이어짐.

## 배포

Vercel 정적 배포(제로 설정). 루트의 `index.html`이 `/`로, `api/sync.mjs`가 `/api/sync`로 서빙됨.

## 동기화 동작

부팅 시 cloudPull, 즐겨찾기 토글 시 디바운스 cloudPush. 네트워크 실패 시 localStorage로 정상 동작.
최초 연결은 로컬∪클라우드 합집합(기존 즐겨찾기 보존), 이후엔 클라우드 기준(삭제 전파).
