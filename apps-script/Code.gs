// My LingQ 유튜브 자막 서버 (Google Apps Script 웹 앱)
// 사용: https://script.google.com/macros/s/<배포ID>/exec?v=<유튜브 영상 ID>
// 응답: { title, auto, cues: [{t: 초, text}], via }  또는  { error }
// 진단: ...exec?v=<ID>&debug=1  → 접속 방식별 결과

// 유튜브가 구글 서버에서 오는 요청을 '봇 확인'으로 막는 경우가 있어
// 여러 클라이언트(앱 종류)로 차례대로 시도함
const CLIENTS = [
  { name: 'ANDROID', ctx: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30 }, ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip' },
  { name: 'IOS', ctx: { clientName: 'IOS', clientVersion: '20.10.4', deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82' }, ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)' },
];
const TRIES = 2; // 봇 확인은 요청마다 달라질 수 있어 방식별로 한 번 더 시도

function doGet(e) {
  const v = ((e && e.parameter.v) || '').trim();
  const lang = (e && e.parameter.lang) || 'en';
  let out;
  if (!/^[\w-]{11}$/.test(v)) out = { error: '영상 ID가 올바르지 않아요' };
  else if (e.parameter.debug) out = diagnose(v, lang);
  else out = fetchTranscript(v, lang);
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function fetchTranscript(videoId, lang) {
  let lastError = '자막을 가져오지 못했어요';
  for (let n = 0; n < TRIES; n++) {
    for (const c of CLIENTS) {
      try {
        const res = tryClient(c, videoId, lang);
        res.via = c.name;
        return res;
      } catch (err) {
        lastError = String(err.message || err);
        if (/자막이 없는|비공개|private|not available|unavailable/i.test(lastError)) return { error: lastError }; // 다른 방식으로도 안 되는 경우
      }
    }
  }
  return { error: lastError };
}

function diagnose(videoId, lang) {
  return CLIENTS.map(c => {
    try { const r = tryClient(c, videoId, lang); return c.name + ': OK ' + r.cues.length + '줄'; }
    catch (err) { return c.name + ': ' + (err.message || err); }
  });
}

function tryClient(c, videoId, lang) {
  const body = { context: { client: Object.assign({ hl: 'en', gl: 'US' }, c.ctx) }, videoId: videoId };
  if (c.embed) body.context.thirdParty = { embedUrl: 'https://www.youtube.com/' };
  const headers = { 'Accept-Language': 'en-US', 'Origin': 'https://www.youtube.com' };
  if (c.ua) headers['User-Agent'] = c.ua;
  const r = UrlFetchApp.fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'post', contentType: 'application/json', headers: headers,
    payload: JSON.stringify(body), muteHttpExceptions: true,
  });
  if (r.getResponseCode() !== 200) throw new Error('YouTube 응답 오류 ' + r.getResponseCode());
  const j = JSON.parse(r.getContentText());
  const play = j.playabilityStatus || {};
  const tracks = ((j.captions || {}).playerCaptionsTracklistRenderer || {}).captionTracks || [];
  // 재생은 막혀도 자막 목록은 오는 경우가 있어 자막이 있으면 그대로 사용
  if (!tracks.length && play.status !== 'OK') throw new Error(play.reason || ('재생할 수 없는 영상 (' + play.status + ')'));
  const ofLang = tracks.filter(t => t.languageCode.indexOf(lang) === 0);
  const track = ofLang.find(t => t.kind !== 'asr') || ofLang[0]; // 사람이 만든 자막 우선
  if (!track) throw new Error('영어 자막이 없는 영상이에요');
  const xml = UrlFetchApp.fetch(track.baseUrl.replace('&fmt=srv3', ''), { muteHttpExceptions: true }).getContentText();
  const cues = [];
  const re = /<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(xml))) {
    const text = decode(m[2]).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text) cues.push({ t: +m[1], text: text });
  }
  if (!cues.length) throw new Error('자막 내용이 비어 있어요');
  return { title: (j.videoDetails || {}).title || '', auto: track.kind === 'asr', cues: cues };
}

function decode(s) {
  return s.replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
