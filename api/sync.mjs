// /api/sync — 영어 플래시카드 학습 데이터 동기화용 중계 함수
// 브라우저(같은 도메인) ↔ 이 함수 ↔ Upstash Redis(Vercel 마켓플레이스, 계정 귀속이라 유실 없음)
// 저장 대상: 즐겨찾기(ids) + 오답 덱(wrongs) + 간격반복 상태(srs) + 일별 학습 통계(stats).
// 개인 학습 데이터뿐이라 인증/암호화 없음.
//
// Upstash 미연결(환경변수 없음) 시엔 기존 jsonblob으로 폴백.
// Redis가 비어 있으면 첫 GET 때 jsonblob 데이터를 자동 이관(일회성 시드).
// (jsonblob은 예고 없이 지워진 전력이 있어 2026-07 Upstash로 이전)
const KEY = 'ub:bookmarks';
const BLOB = 'https://jsonblob.com/api/jsonBlob/019f21bf-2f38-755b-9c18-bfa783975e78';

function redisEnv() {
  // Vercel 마켓플레이스 연동 시 이름이 KV_* 또는 UPSTASH_* 로 생성됨 — 둘 다 지원
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

function cleanList(v) {
  // 필드가 아예 없으면 null(구버전 클라이언트 구분용), 있으면 문자열만 걸러서 반환
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 5000) : null;
}

function cleanObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function pack(data) {
  return {
    ids: (data && cleanList(data.ids)) || [],
    wrongs: (data && cleanList(data.wrongs)) || [],
    srs: (data && cleanObj(data.srs)) || {},
    stats: (data && cleanObj(data.stats)) || {},
  };
}

async function redisGet(env) {
  const r = await fetch(`${env.url}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${env.token}` },
  });
  if (!r.ok) throw new Error('redis read ' + r.status);
  const j = await r.json();
  if (!j || typeof j.result !== 'string') return null; // 키 없음
  try {
    return pack(JSON.parse(j.result));
  } catch (e) {
    return null;
  }
}

async function redisSet(env, data) {
  const r = await fetch(`${env.url}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.token}` },
    body: JSON.stringify({ ids: data.ids, wrongs: data.wrongs, srs: data.srs, stats: data.stats, updated: Date.now() }),
  });
  if (!r.ok) throw new Error('redis write ' + r.status);
}

async function blobGet() {
  const r = await fetch(BLOB, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('read ' + r.status);
  return pack(await r.json());
}

async function blobSet(data) {
  const r = await fetch(BLOB, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ids: data.ids, wrongs: data.wrongs, srs: data.srs, stats: data.stats, updated: Date.now() }),
  });
  if (!r.ok) throw new Error('write ' + r.status);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const env = redisEnv();
  try {
    if (req.method === 'GET') {
      if (env) {
        let data = await redisGet(env);
        if (data === null) {
          // Redis가 빈 최초 1회: jsonblob에 남은 데이터가 있으면 자동 이관
          data = { ids: [], wrongs: [] };
          try {
            const old = await blobGet();
            if (old.ids.length || old.wrongs.length) { await redisSet(env, old); data = old; }
          } catch (e) { /* jsonblob이 이미 죽었으면 빈 상태로 시작 — 기기 로컬이 채워줌 */ }
        }
        return res.status(200).json(data);
      }
      return res.status(200).json(await blobGet());
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      const ids = (body && cleanList(body.ids)) || [];
      let wrongs = body ? cleanList(body.wrongs) : null;
      let srs = body ? cleanObj(body.srs) : null;
      let stats = body ? cleanObj(body.stats) : null;
      if (wrongs === null || srs === null || stats === null) {
        // 구버전 클라이언트(필드 없음): 저장돼 있던 데이터를 지우지 않게 보존
        try {
          const cur = env ? await redisGet(env) : await blobGet();
          if (wrongs === null) wrongs = (cur && cur.wrongs) || [];
          if (srs === null) srs = (cur && cur.srs) || {};
          if (stats === null) stats = (cur && cur.stats) || {};
        } catch (e) { wrongs = wrongs || []; srs = srs || {}; stats = stats || {}; }
      }
      const data = { ids, wrongs, srs, stats };
      if (env) await redisSet(env, data);
      else await blobSet(data);
      return res.status(200).json({ ok: true, n: ids.length, w: wrongs.length });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(502).json({ error: String((e && e.message) || e) });
  }
}
