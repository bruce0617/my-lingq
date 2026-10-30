// My LingQ 로컬 서버: 앱 파일 제공 + 유튜브 자막 자동 가져오기
// 실행: node server.mjs   (같은 Wi-Fi의 아이폰에서 쓰려면: HOST=0.0.0.0 node server.mjs)
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = +(process.env.PORT || 8000);
const HOST = process.env.HOST || '127.0.0.1';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

const decode = s => s
  .replace(/&amp;/g, '&')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// 유튜브 앱(ANDROID 클라이언트)과 같은 방식으로 자막 목록을 받아 영어 자막을 고름
async function fetchTranscript(videoId, lang = 'en') {
  const r = await fetch('https://www.youtube.com/youtubei/v1/player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Language': 'en-US' },
    body: JSON.stringify({ context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } }, videoId }),
  });
  if (!r.ok) throw new Error(`YouTube 응답 오류 ${r.status}`);
  const j = await r.json();
  if (j.playabilityStatus?.status !== 'OK') throw new Error(j.playabilityStatus?.reason || '재생할 수 없는 영상');
  const tracks = j.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const ofLang = tracks.filter(t => t.languageCode.startsWith(lang));
  const track = ofLang.find(t => t.kind !== 'asr') || ofLang[0]; // 사람이 만든 자막 우선, 없으면 자동 자막
  if (!track) throw new Error('영어 자막이 없는 영상이에요');
  const xml = await (await fetch(track.baseUrl.replace('&fmt=srv3', ''))).text();
  const cues = [...xml.matchAll(/<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)]
    .map(m => ({ t: +m[1], text: decode(m[2]).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() }))
    .filter(c => c.text);
  if (!cues.length) throw new Error('자막 내용을 읽지 못했어요');
  return { title: j.videoDetails?.title || '', auto: track.kind === 'asr', cues };
}

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/transcript') {
    const v = url.searchParams.get('v') || '';
    if (!/^[\w-]{11}$/.test(v)) return send(res, 400, { error: '영상 ID가 올바르지 않아요' });
    try { return send(res, 200, await fetchTranscript(v, url.searchParams.get('lang') || 'en')); }
    catch (e) { return send(res, 502, { error: e.message }); }
  }
  // 정적 파일 (프로젝트 폴더 밖은 접근 불가)
  const file = path.join(ROOT, path.normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
  if (!file.startsWith(ROOT + path.sep) || path.basename(file).startsWith('.')) return send(res, 403, 'Forbidden', 'text/plain');
  try { send(res, 200, await fs.readFile(file), TYPES[path.extname(file)] || 'application/octet-stream'); }
  catch { send(res, 404, 'Not found', 'text/plain'); }
}).listen(PORT, HOST, () => console.log(`My LingQ → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`));

// ---------- 밖에서 쓰는 자막 중계 (Tailscale Funnel로 이 포트만 인터넷에 공개) ----------
// /api/transcript 하나만 처리 — 앱 파일·개인 데이터(data/)는 여기서 절대 제공하지 않음
const RELAY_PORT = +(process.env.RELAY_PORT || 8787);
const ALLOWED_ORIGINS = ['https://my-lingq.web.app', 'https://bruce0617.github.io', 'http://localhost:8000'];
const LIMIT_PER_HOUR = 60; // 남용 방지: 집 인터넷이 유튜브에 막히지 않도록
let hits = [];
http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const cors = ALLOWED_ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
  const reply = (code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors });
    res.end(JSON.stringify(body));
  };
  // Chrome 사설망 접근 사전 확인: Tailscale 기기에서는 이 주소가 내부망(100.x)으로 연결됨
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Private-Network': 'true', 'Access-Control-Max-Age': '600' });
    return res.end();
  }
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/api/transcript') return reply(404, { error: 'not found' });
  const now = Date.now();
  hits = hits.filter(t => now - t < 3600_000);
  if (hits.length >= LIMIT_PER_HOUR) return reply(429, { error: '잠시 후 다시 시도해 주세요 (시간당 요청 한도)' });
  hits.push(now);
  const v = url.searchParams.get('v') || '';
  if (!/^[\w-]{11}$/.test(v)) return reply(400, { error: '영상 ID가 올바르지 않아요' });
  try { reply(200, await fetchTranscript(v, url.searchParams.get('lang') || 'en')); }
  catch (e) { reply(502, { error: e.message }); }
}).listen(RELAY_PORT, '127.0.0.1', () => console.log(`자막 중계 → http://127.0.0.1:${RELAY_PORT}/api/transcript`));
