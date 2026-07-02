#!/usr/bin/env node
// tools/add-data.mjs — 새 학습분(Day 21+)을 index.html 내장 DB에 안전하게 추가
//
// 사용법:
//   node tools/add-data.mjs new-data.json            # 검증 후 추가
//   node tools/add-data.mjs new-data.json --dry-run  # 검증·미리보기만, 파일 안 건드림
//
// new-data.json 형식 (필요한 컬렉션만 넣으면 됨, tools/example-new-data.json 참고):
//   { "patterns": [...], "phrases": [...], "sentences": [...], "narratives": [...], "recall": [...] }
//
// 하는 일:
//   1. index.html에서 DB 한 줄을 추출·파싱
//   2. 새 항목 스키마 검증 (필수 필드·타입·중복·모르는 필드)
//   3. id 자동 부여 (patterns: P다음번호, recall: r+해시+전역번호)
//   4. index.html.bak 백업 후 DB 교체, 헤더의 개수·Day 범위 자동 갱신
//   5. 결과를 다시 파싱해서 자가 검증
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = path.join(ROOT, 'index.html');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const inputPath = args.find((a) => !a.startsWith('--'));
if (!inputPath) {
  console.error('사용법: node tools/add-data.mjs <new-data.json> [--dry-run]');
  process.exit(1);
}

function fail(msg) { console.error('✗ ' + msg); process.exit(1); }
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(16); }

// ---------- 1. 읽기 ----------
const html = fs.readFileSync(HTML, 'utf8');
const dbMatch = html.match(/^const DB=(\{.*\});$/m);
if (!dbMatch) fail('index.html에서 DB 줄(const DB={...};)을 찾지 못했습니다.');
let db;
try { db = JSON.parse(dbMatch[1]); } catch (e) { fail('기존 DB 파싱 실패: ' + e.message); }

let input;
try { input = JSON.parse(fs.readFileSync(inputPath, 'utf8')); } catch (e) { fail('입력 파일 읽기/파싱 실패: ' + e.message); }
if (!input || typeof input !== 'object' || Array.isArray(input)) fail('입력은 {컬렉션: [항목...]} 형태의 객체여야 합니다.');

// ---------- 2. 스키마 ----------
const SCHEMAS = {
  patterns:   { req: { name: 'string', rule: 'string', ex: 'string', week: 'string', cat: 'string' }, opt: { id: 'string' } },
  phrases:    { req: { en: 'string', ko: 'string', day: 'number', week: 'string' }, opt: { star: 'boolean' } },
  sentences:  { req: { en: 'string', ko: 'string', day: 'number', theme: 'string', week: 'string' }, opt: {} },
  narratives: { req: { title: 'string', day: 'number', ko: 'string', en_lines: 'string[]', week: 'string' }, opt: {} },
  recall:     { req: { ko: 'string', en: 'string', week: 'string', topic: 'string', group: 'string' }, opt: { id: 'string', section: 'string' } },
};

function typeOk(v, t) {
  if (t === 'string') return typeof v === 'string' && v.trim() !== '';
  if (t === 'number') return typeof v === 'number' && isFinite(v);
  if (t === 'boolean') return typeof v === 'boolean';
  if (t === 'string[]') return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x.trim() !== '');
  return false;
}

const errors = [];
const warnings = [];
const added = {};

for (const col of Object.keys(input)) {
  if (!SCHEMAS[col]) { errors.push(`알 수 없는 컬렉션 "${col}" — 가능: ${Object.keys(SCHEMAS).join(', ')}`); continue; }
  if (!Array.isArray(input[col])) { errors.push(`"${col}"은 배열이어야 합니다.`); continue; }
  const { req, opt } = SCHEMAS[col];
  input[col].forEach((item, i) => {
    const where = `${col}[${i}]`;
    if (!item || typeof item !== 'object') { errors.push(`${where}: 객체가 아님`); return; }
    for (const [f, t] of Object.entries(req)) {
      if (!(f in item)) errors.push(`${where}: 필수 필드 "${f}" 없음`);
      else if (!typeOk(item[f], t)) errors.push(`${where}.${f}: ${t} 타입이어야 함 (현재: ${JSON.stringify(item[f]).slice(0, 40)})`);
    }
    for (const f of Object.keys(item)) {
      if (!(f in req) && !(f in opt)) errors.push(`${where}: 모르는 필드 "${f}" — 오타인지 확인하세요`);
      else if (f in opt && !typeOk(item[f], opt[f])) errors.push(`${where}.${f}: ${opt[f]} 타입이어야 함`);
    }
  });
}

// ---------- 3. 중복·일관성 검사 ----------
function dupCheck(col, keyFn, label) {
  if (!input[col]) return;
  const seen = new Set((db[col] || []).map(keyFn));
  input[col].forEach((item, i) => {
    const k = keyFn(item);
    if (k && seen.has(k)) errors.push(`${col}[${i}]: 중복 ${label} — ${String(k).slice(0, 60)}`);
    if (k) seen.add(k);
  });
}
dupCheck('patterns', (p) => p.id || null, 'id');
dupCheck('patterns', (p) => (p.name || '') + '|' + (p.ex || ''), '내용(name+ex)');
dupCheck('phrases', (p) => (p.en || '').toLowerCase().trim(), '표현(en)');
dupCheck('sentences', (s) => (s.en || '').toLowerCase().trim(), '문장(en)');
dupCheck('narratives', (n) => n.title || null, '제목');
dupCheck('recall', (r) => r.id || null, 'id');
dupCheck('recall', (r) => (r.en || '').toLowerCase().trim() + '|' + (r.ko || '').trim(), '카드(en+ko)');

// 새 enum 값은 막지 않되 오타 방지용 경고
function enumWarn(col, field) {
  if (!input[col]) return;
  const known = new Set((db[col] || []).map((x) => x[field]));
  const fresh = [...new Set(input[col].map((x) => x[field]).filter((v) => v && !known.has(v)))];
  if (fresh.length) warnings.push(`${col}.${field}에 새 값 등장: ${fresh.join(', ')} — 새 주차/분류가 맞으면 정상, 오타면 수정`);
}
enumWarn('phrases', 'week'); enumWarn('sentences', 'week'); enumWarn('patterns', 'week');
enumWarn('patterns', 'cat'); enumWarn('recall', 'week'); enumWarn('recall', 'group'); enumWarn('recall', 'topic');

if (errors.length) {
  console.error(`✗ 검증 실패 — ${errors.length}개 문제:\n` + errors.map((e) => '  · ' + e).join('\n'));
  process.exit(1);
}

// ---------- 4. id 자동 부여 + 기본값 ----------
if (input.patterns) {
  let maxP = Math.max(0, ...db.patterns.map((p) => parseInt(String(p.id).replace(/^P/, ''), 10) || 0));
  input.patterns.forEach((p) => { if (!p.id) p.id = 'P' + (++maxP); });
}
if (input.phrases) input.phrases.forEach((p) => { if (!('star' in p)) p.star = false; });
if (input.recall) {
  let idx = db.recall.length;
  const ids = new Set(db.recall.map((r) => r.id));
  input.recall.forEach((r) => {
    if (!r.section) r.section = r.topic;
    if (!r.id) { r.id = 'r' + hash(r.en + '|' + r.ko) + idx; idx++; }
    if (ids.has(r.id)) fail(`recall id 충돌: ${r.id}`);
    ids.add(r.id);
  });
}

// ---------- 5. 병합 + 요약 ----------
const before = {};
for (const col of Object.keys(SCHEMAS)) before[col] = (db[col] || []).length;
for (const col of Object.keys(input)) {
  if (!input[col].length) continue;
  db[col] = (db[col] || []).concat(input[col]);
  added[col] = input[col].length;
}
if (!Object.keys(added).length) fail('추가할 항목이 없습니다.');

console.log('추가 요약:');
for (const [col, n] of Object.entries(added)) console.log(`  ${col}: ${before[col]} → ${before[col] + n} (+${n})`);
warnings.forEach((w) => console.log('  ⚠ ' + w));

if (dryRun) { console.log('✓ dry-run — 검증 통과, 파일은 수정하지 않았습니다.'); process.exit(0); }

// ---------- 6. 쓰기 (백업 + DB 교체 + 헤더 개수/Day 범위 갱신) ----------
fs.writeFileSync(HTML + '.bak', html);
let out = html.replace(/^const DB=\{.*\};$/m, 'const DB=' + JSON.stringify(db) + ';');

const maxDay = Math.max(
  ...db.phrases.map((p) => p.day || 0),
  ...db.sentences.map((s) => s.day || 0),
  ...db.narratives.map((n) => n.day || 0)
);
const counts = { 패턴: db.patterns.length, 표현: db.phrases.length, 문장: db.sentences.length, 서사: db.narratives.length };
out = out.replace(/Day 1[–-]\d+ 전체 · 패턴 \d+ · 표현 \d+ · 문장 \d+ · 서사 \d+ · Recall \d+/,
  `Day 1–${maxDay} 전체 · 패턴 ${counts['패턴']} · 표현 ${counts['표현']} · 문장 ${counts['문장']} · 서사 ${counts['서사']} · Recall ${db.recall.length}`);
out = out.replace(/\(Day 1[–-]\d+\)/, `(Day 1–${maxDay})`);

// 자가 검증: 교체된 줄이 다시 파싱되는지
const check = out.match(/^const DB=(\{.*\});$/m);
try {
  const re = JSON.parse(check[1]);
  for (const col of Object.keys(SCHEMAS)) {
    if (re[col].length !== db[col].length) throw new Error(col + ' 개수 불일치');
  }
} catch (e) { fail('자가 검증 실패, 파일을 수정하지 않았습니다: ' + e.message); }

fs.writeFileSync(HTML, out);
console.log(`✓ 완료 — index.html 갱신 (백업: index.html.bak) · Day 1–${maxDay}`);
console.log('  다음: git diff로 확인 → 브라우저 열어 확인 → commit & push');
