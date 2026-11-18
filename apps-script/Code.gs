/**
 * 실습 메일 보내기 — Google Apps Script 웹 앱
 *
 * 공유보드에서 수강생이 메일 주소를 넣으면, 이 코드가 강사의 Gmail로
 * 정해진 실습 메일 한 통을 그 주소로 보냅니다.
 *
 * 설치: script.google.com 에서 새 프로젝트를 만들고 이 파일 내용을 그대로 붙여 넣습니다.
 *       자세한 순서는 '설정 방법.md'의 2단계를 보세요.
 *
 * 스크립트 속성(프로젝트 설정 → 스크립트 속성)으로 바꿀 수 있는 값 — 모두 선택:
 *   CLASS_CODE        수업 코드. 넣으면 이 코드를 아는 사람만 받을 수 있습니다.
 *   ALLOWED_DOMAINS   받을 수 있는 메일 도메인. 쉼표로 구분 (예: hanyang.ac.kr,gmail.com)
 *   DAILY_CAP         하루에 보낼 최대 통수. 기본 90 (개인 Gmail은 하루 100명까지)
 *   COOLDOWN_MINUTES  같은 주소로 다시 보내기까지 기다릴 시간(분). 기본 3
 *   SHEET_ID          보낸 기록을 남길 Google 스프레드시트의 ID
 *   ENABLED           false 로 두면 보내기를 멈춥니다(수업이 끝난 뒤).
 *   BOARD_URL         메일 맨 위의 ‘공유보드 열기’ 버튼이 가는 주소. 넣지 않으면 아래 MAIL.BOARD_URL 을 씁니다.
 */

var MAIL = {
  SUBJECT: '[실습용] 피지컬AI로봇 실습2 · 프로젝트 결과 발표 안내',
  SENDER_NAME: '피지컬AI로봇 실습2 실습 조교',
  BOARD_URL: 'https://hong-minji.github.io/hanyang/',   // 메일 맨 위의 ‘공유보드 열기’ 버튼이 가는 주소
  DAILY_CAP: 90,
  COOLDOWN_MINUTES: 3,
  PER_ADDRESS_LIMIT: 3,   // 한 주소가 6시간 안에 받을 수 있는 최대 통수
  TIMEZONE: 'Asia/Seoul'
};

/* ------------------------------------------------------------------ 웹 앱 입구 */

// 주소를 브라우저에 그대로 넣으면 상태만 보여 줍니다(메일은 보내지 않음).
function doGet() {
  var p = props_();
  return json_({
    ok: true,
    service: 'practice-mail',
    enabled: p.enabled,
    sentToday: sentToday_(),
    dailyCap: p.cap,
    classCodeRequired: !!p.classCode
  });
}

function doPost(e) {
  var input = {};
  try {
    if (e && e.postData && e.postData.contents) input = JSON.parse(e.postData.contents);
  } catch (err) {
    input = {};
  }
  if (!input.email && e && e.parameter) input = e.parameter;
  var result;
  try {
    result = handle_(input || {});
  } catch (err) {
    console.error(err);
    result = fail_('server', '메일을 보내는 중 문제가 생겼습니다. 잠시 뒤 다시 눌러 주세요.');
  }
  return json_(result);
}

/* ------------------------------------------------------------------ 요청 처리 */

function handle_(input) {
  var p = props_();
  var email = String(input.email || '').trim().toLowerCase();
  var name = String(input.name || '').trim().slice(0, 20);
  var classCode = String(input.classCode || '').trim();

  if (!p.enabled) return fail_('closed', '지금은 실습 메일을 보내지 않습니다.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) {
    return fail_('bad_email', '메일 주소를 다시 확인해 주세요.');
  }
  if (p.classCode && classCode !== p.classCode) {
    return fail_('bad_code', '수업 코드가 맞지 않습니다. 강사가 알려 준 코드를 확인해 주세요.');
  }
  if (p.domains.length) {
    var domain = email.split('@')[1];
    var allowed = p.domains.some(function (d) { return domain === d || domain.slice(-(d.length + 1)) === '.' + d; });
    if (!allowed) return fail_('domain', '이 수업에서 쓰는 메일 주소(' + p.domains.join(', ') + ')로만 보낼 수 있습니다.');
  }

  var cache = CacheService.getScriptCache();
  var key = digest_(email);
  if (cache.get('cd_' + key)) {
    return fail_('cooldown', '방금 이 주소로 보냈습니다. 메일함(스팸함 포함)을 먼저 확인하고, ' + p.cooldown + '분 뒤에 다시 눌러 주세요.');
  }
  var count = Number(cache.get('n_' + key) || 0);
  if (count >= MAIL.PER_ADDRESS_LIMIT) {
    return fail_('too_many', '이 주소로는 이미 ' + MAIL.PER_ADDRESS_LIMIT + '번 보냈습니다. 메일함을 확인해 주세요.');
  }

  // 하루 보낼 수 있는 자리를 먼저 하나 잡는다(동시에 눌러도 한도를 넘지 않게).
  var day = today_();
  var store = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return fail_('busy', '요청이 몰렸습니다. 잠시 뒤 다시 눌러 주세요.');
  try {
    var sent = Number(store.getProperty('SENT_' + day) || 0);
    if (sent >= p.cap) return fail_('cap', '오늘 보낼 수 있는 실습 메일이 모두 나갔습니다. 강사에게 알려 주세요.');
    if (MailApp.getRemainingDailyQuota() < 1) return fail_('quota', '오늘 보낼 수 있는 메일 한도가 끝났습니다. 강사에게 알려 주세요.');
    store.setProperty('SENT_' + day, String(sent + 1));
  } finally {
    lock.releaseLock();
  }

  var mail = buildMail_(name);
  try {
    MailApp.sendEmail({ to: email, subject: mail.subject, body: mail.text, htmlBody: mail.html, name: MAIL.SENDER_NAME });
  } catch (err) {
    releaseSlot_(day);
    console.error(err);
    log_(p.sheetId, email, name, '실패: ' + err);
    return fail_('send', '메일을 보내지 못했습니다. 주소를 확인하고 다시 눌러 주세요.');
  }

  cache.put('cd_' + key, '1', Math.max(60, p.cooldown * 60));
  cache.put('n_' + key, String(count + 1), 21600);
  log_(p.sheetId, email, name, '보냄');
  return { ok: true, message: '실습 메일을 보냈습니다.' };
}

/* ------------------------------------------------------------------ 메일 내용 */

function buildMail_(name) {
  var hello = name ? name + ' 님, 안녕하세요.' : '안녕하세요.';
  var board = props_().boardUrl;   // https:// 로 시작하는 주소일 때만 버튼을 넣는다
  var rows = [
    ['일시', '2026년 12월 4일(금) 14:00~14:15'],
    ['장소', '제3공학관 204호'],
    ['발표 시간', '발표 10분 + 질의응답 5분'],
    ['발표자료', '웹 주소로 열리는 발표자료, 표지 + 내용 5장'],
    ['꼭 넣을 것', '구조도 1개 · 시연 영상 또는 과정 사진 · 실제로 측정한 값'],
    ['회신 마감', '2026년 12월 2일(수) 18:00까지 이 메일에 회신'],
    ['회신에 적을 것', '팀명 · 발표 제목 · 발표 주소(웹 링크)'],
    ['리허설(선택)', '2026년 12월 3일(목) 17:00~17:30, 같은 장소']
  ];
  var checks = [
    '발표 주소가 로그인하지 않은 창(시크릿 창)에서도 열리는지 확인하기',
    '영상이 발표 장소의 컴퓨터에서 재생되는지 미리 확인하기',
    '발표용 노트북과 HDMI 연결 장치 챙기기',
    '10분 안에 끝나는지 한 번 소리 내어 연습하기'
  ];

  var text = (board ? [
    '▶ 공유보드 열기: ' + board,
    '   (오늘 수업의 실습 안내서 · 실습 자료 · 결과물 올리기가 여기에 있습니다)',
    ''
  ] : []).concat([
    hello,
    '',
    '2조(CatchBin — 던지면 받아 주는 쓰레기통)의 프로젝트 결과 발표 일정을 안내드립니다.',
    ''
  ]).concat(rows.map(function (r, i) { return (i + 1) + '. ' + r[0] + ': ' + r[1]; })).concat([
    '',
    '발표 전 확인할 것',
  ]).concat(checks.map(function (c) { return '- ' + c; })).concat([
    '',
    '일정이 어려우면 회신 마감 전에 이 메일로 알려 주세요.',
    '감사합니다.',
    '',
    MAIL.SENDER_NAME + ' 드림',
    '',
    '※ 이 메일은 「프로젝트 발표자료 제작 특강」의 Gmail 실습을 위해 보낸 연습용 메일입니다.',
    '   일정과 장소는 실습을 위해 지어낸 것이며, 실제 일정이 아닙니다. 답장은 초안까지만 만들어 보고 보내지 않아도 됩니다.'
  ]).join('\n');

  var td = 'padding:10px 14px;border-bottom:1px solid #E6E1D6;font-size:15px;line-height:1.55;vertical-align:top;';
  var tableRows = rows.map(function (r) {
    return '<tr><td style="' + td + 'width:112px;color:#6B665D;font-weight:700;white-space:nowrap;">' + esc_(r[0]) + '</td>' +
      '<td style="' + td + 'color:#17161A;">' + esc_(r[1]) + '</td></tr>';
  }).join('');
  var checkItems = checks.map(function (c) {
    return '<li style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#17161A;">' + esc_(c) + '</li>';
  }).join('');

  // 맨 위에 크게 보이는 ‘공유보드 열기’ 버튼(메일 프로그램에서도 눌리도록 표와 글자만으로 만든다)
  var boardShort = board.replace(/^https:\/\//, '').replace(/\/$/, '');
  var boardRow = !board ? '' :
    '<tr><td style="padding:22px 30px 24px;background:#17161A;">' +
    '<p style="margin:0 0 6px;font-size:12.5px;font-weight:700;letter-spacing:0.06em;color:#F3B5A9;">오늘 수업에서 쓰는 곳</p>' +
    '<p style="margin:0 0 16px;font-size:20px;line-height:1.4;font-weight:800;color:#FFFFFF;letter-spacing:-0.02em;">공유보드 — 실습 안내서 · 실습 자료 · 결과물 올리기</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#E5432A;">' +
    '<a href="' + esc_(board) + '" target="_blank" style="display:inline-block;padding:15px 30px;font-size:18px;font-weight:800;color:#FFFFFF;text-decoration:none;letter-spacing:-0.01em;">공유보드 열기 &rarr;</a>' +
    '</td></tr></table>' +
    '<p style="margin:14px 0 0;font-size:13.5px;line-height:1.6;color:#D9D4C8;">버튼이 눌리지 않으면 이 주소를 누르세요: <a href="' + esc_(board) + '" target="_blank" style="color:#FFFFFF;font-weight:700;text-decoration:underline;">' + esc_(boardShort) + '</a></p>' +
    '</td></tr>';

  var html =
    '<div style="margin:0;padding:24px 12px;background:#F3F0E9;font-family:\'Apple SD Gothic Neo\',\'Malgun Gothic\',\'Noto Sans KR\',sans-serif;">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">12월 4일(금) 14:00 발표, 12월 2일(수) 18:00까지 발표 주소 회신</div>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:0 auto;background:#FFFFFF;border:1px solid #17161A;">' +
    '<tr><td style="padding:0;height:8px;background:#E5432A;font-size:0;line-height:0;">&nbsp;</td></tr>' +
    boardRow +
    '<tr><td style="padding:28px 30px 8px;">' +
    '<div style="display:inline-block;border:1px solid #E5432A;color:#B4301A;font-size:12px;font-weight:700;padding:2px 8px;">실습용 메일</div>' +
    '<h1 style="margin:14px 0 6px;font-size:23px;line-height:1.35;color:#17161A;letter-spacing:-0.02em;">프로젝트 결과 발표 안내</h1>' +
    '<p style="margin:0;font-size:14px;color:#6B665D;">피지컬AI로봇 실습2 · 2조(CatchBin)</p>' +
    '</td></tr>' +
    '<tr><td style="padding:16px 30px 4px;">' +
    '<p style="margin:0 0 10px;font-size:15px;line-height:1.7;color:#17161A;">' + esc_(hello) + '</p>' +
    '<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#17161A;">2조(CatchBin — 던지면 받아 주는 쓰레기통)의 <b>프로젝트 결과 발표</b> 일정을 안내드립니다.</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:2px solid #17161A;">' + tableRows + '</table>' +
    '</td></tr>' +
    '<tr><td style="padding:20px 30px 6px;">' +
    '<p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#17161A;">발표 전 확인할 것</p>' +
    '<ul style="margin:0;padding-left:20px;">' + checkItems + '</ul>' +
    '</td></tr>' +
    '<tr><td style="padding:14px 30px 24px;">' +
    '<p style="margin:0 0 4px;font-size:15px;line-height:1.7;color:#17161A;">일정이 어려우면 회신 마감 전에 이 메일로 알려 주세요.<br>감사합니다.</p>' +
    '<p style="margin:14px 0 0;font-size:15px;color:#17161A;">' + esc_(MAIL.SENDER_NAME) + ' 드림</p>' +
    '</td></tr>' +
    '<tr><td style="padding:14px 30px 18px;background:#F7F5EF;border-top:1px solid #E6E1D6;">' +
    '<p style="margin:0;font-size:12.5px;line-height:1.65;color:#6B665D;">이 메일은 「프로젝트 발표자료 제작 특강」의 Gmail 실습을 위해 보낸 <b>연습용 메일</b>입니다. 일정과 장소는 실습을 위해 지어낸 것이며 실제 일정이 아닙니다. 답장은 초안까지만 만들어 보고, 보내지 않아도 됩니다.</p>' +
    '</td></tr>' +
    '</table></div>';

  return { subject: MAIL.SUBJECT, text: text, html: html };
}

/* ------------------------------------------------------------------ 편집기에서 직접 실행 */

// 처음 한 번 실행하면 권한 승인 창이 뜨고, 승인하면 내 주소로 실습 메일 한 통이 옵니다.
function testSendToMe() {
  var me = Session.getEffectiveUser().getEmail();
  var mail = buildMail_('테스트');
  MailApp.sendEmail({ to: me, subject: mail.subject, body: mail.text, htmlBody: mail.html, name: MAIL.SENDER_NAME });
  console.log('보냄: ' + me + ' / 오늘 남은 한도: ' + MailApp.getRemainingDailyQuota());
}

// 오늘 몇 통 보냈는지, 남은 한도가 얼마인지 실행 기록에 적습니다.
function showStatus() {
  var p = props_();
  console.log('오늘 보낸 실습 메일: ' + sentToday_() + ' / ' + p.cap + ', Gmail 남은 한도: ' + MailApp.getRemainingDailyQuota() +
    ', 켜짐: ' + p.enabled + ', 수업 코드: ' + (p.classCode ? '있음' : '없음') + ', 허용 도메인: ' + (p.domains.join(', ') || '제한 없음'));
}

/* ------------------------------------------------------------------ 도우미 */

function props_() {
  var s = PropertiesService.getScriptProperties();
  var cap = parseInt(s.getProperty('DAILY_CAP'), 10);
  var cooldown = parseFloat(s.getProperty('COOLDOWN_MINUTES'));
  var domains = String(s.getProperty('ALLOWED_DOMAINS') || '').toLowerCase().split(',')
    .map(function (d) { return d.trim().replace(/^@/, ''); })
    .filter(function (d) { return d; });
  return {
    enabled: String(s.getProperty('ENABLED') || 'true').trim().toLowerCase() !== 'false',
    classCode: String(s.getProperty('CLASS_CODE') || '').trim(),
    domains: domains,
    cap: cap > 0 ? cap : MAIL.DAILY_CAP,
    cooldown: cooldown > 0 ? cooldown : MAIL.COOLDOWN_MINUTES,
    sheetId: String(s.getProperty('SHEET_ID') || '').trim(),
    boardUrl: (function (u) { return /^https:\/\/\S+$/.test(u) ? u : ''; })(String(s.getProperty('BOARD_URL') || MAIL.BOARD_URL || '').trim())
  };
}

function today_() {
  return Utilities.formatDate(new Date(), MAIL.TIMEZONE, 'yyyyMMdd');
}

function sentToday_() {
  return Number(PropertiesService.getScriptProperties().getProperty('SENT_' + today_()) || 0);
}

function releaseSlot_(day) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var store = PropertiesService.getScriptProperties();
    var sent = Number(store.getProperty('SENT_' + day) || 0);
    store.setProperty('SENT_' + day, String(Math.max(0, sent - 1)));
  } finally {
    lock.releaseLock();
  }
}

function digest_(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return raw.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('').slice(0, 32);
}

function log_(sheetId, email, name, result) {
  if (!sheetId) return;
  try {
    SpreadsheetApp.openById(sheetId).getSheets()[0].appendRow([new Date(), email, name, result]);
  } catch (err) {
    console.error('기록 실패: ' + err);
  }
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fail_(code, message) {
  return { ok: false, code: code, message: message };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
