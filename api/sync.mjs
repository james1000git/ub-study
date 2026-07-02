// /api/sync — 영어 플래시카드 즐겨찾기 동기화용 중계 함수
// 브라우저(같은 도메인) ↔ 이 함수 ↔ jsonblob(무가입 무료 저장소)
// 저장 대상은 개인 학습 즐겨찾기 id 목록뿐이라 별도 인증/암호화 없음.
// (2026-07-02 교체: 이전 blob이 이틀 만에 유실됨 — jsonblob은 예고 없이 지워질 수 있음)
const BLOB = 'https://jsonblob.com/api/jsonBlob/019f21bf-2f38-755b-9c18-bfa783975e78';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const r = await fetch(BLOB, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('read ' + r.status);
      const data = await r.json();
      const ids = Array.isArray(data && data.ids) ? data.ids : [];
      return res.status(200).json({ ids });
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      const ids = Array.isArray(body && body.ids)
        ? body.ids.filter((x) => typeof x === 'string').slice(0, 5000)
        : [];
      const r = await fetch(BLOB, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ids, updated: Date.now() }),
      });
      if (!r.ok) throw new Error('write ' + r.status);
      return res.status(200).json({ ok: true, n: ids.length });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(502).json({ error: String((e && e.message) || e) });
  }
}
