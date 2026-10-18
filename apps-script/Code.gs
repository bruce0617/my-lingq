// My LingQ 유튜브 자막 서버 (Google Apps Script 웹 앱)
// 사용: https://script.google.com/macros/s/<배포ID>/exec?v=<유튜브 영상 ID>
// 응답: { title, auto, cues: [{t: 초, text}] }  또는  { error }

function doGet(e) {
  let out;
  try {
    const v = (e.parameter.v || '').trim();
    if (!/^[\w-]{11}$/.test(v)) throw new Error('영상 ID가 올바르지 않아요');
    out = fetchTranscript(v, e.parameter.lang || 'en');
  } catch (err) {
    out = { error: String(err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// 유튜브 앱(ANDROID 클라이언트)과 같은 방식으로 자막 목록을 받아 영어 자막을 고름
function fetchTranscript(videoId, lang) {
  const r = UrlFetchApp.fetch('https://www.youtube.com/youtubei/v1/player', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Accept-Language': 'en-US' },
    payload: JSON.stringify({ context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } }, videoId }),
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() !== 200) throw new Error('YouTube 응답 오류 ' + r.getResponseCode());
  const j = JSON.parse(r.getContentText());
  const play = j.playabilityStatus || {};
  if (play.status !== 'OK') throw new Error(play.reason || '재생할 수 없는 영상 (' + play.status + ')');
  const tracks = ((j.captions || {}).playerCaptionsTracklistRenderer || {}).captionTracks || [];
  const ofLang = tracks.filter(t => t.languageCode.indexOf(lang) === 0);
  const track = ofLang.find(t => t.kind !== 'asr') || ofLang[0]; // 사람이 만든 자막 우선
  if (!track) throw new Error('영어 자막이 없는 영상이에요');
  const xml = UrlFetchApp.fetch(track.baseUrl.replace('&fmt=srv3', ''), { muteHttpExceptions: true }).getContentText();
  const cues = [];
  const re = /<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(xml))) {
    const text = decode(m[2]).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text) cues.push({ t: +m[1], text });
  }
  if (!cues.length) throw new Error('자막 내용을 읽지 못했어요');
  return { title: (j.videoDetails || {}).title || '', auto: track.kind === 'asr', cues };
}

function decode(s) {
  return s.replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
