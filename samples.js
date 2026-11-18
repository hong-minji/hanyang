/*
 * 데모 모드에서만 쓰는 예시 카드입니다.
 * Firebase를 연결하면 이 파일의 내용은 보이지 않습니다.
 * 이름과 프로젝트는 모두 지어낸 것입니다.
 */
(function (g) {
  'use strict';

  var FONT = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';

  // 작은 3장짜리 발표 HTML을 만든다. ← → 키와 클릭으로 넘어간다.
  function deck(s) {
    var css =
      '*{box-sizing:border-box;margin:0}html,body{height:100%}' +
      'body{font-family:"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;background:' + s.bg + ';color:' + s.fg + ';overflow:hidden;word-break:keep-all}' +
      '.s{position:absolute;inset:0;display:none;padding:7vh 6vw}.s.on{display:grid}' +
      '.cover{grid-template-columns:1.12fr .88fr;align-items:center;gap:2.4vw}' +
      '.k{font-size:1.75vw;font-weight:700;letter-spacing:.04em;color:' + s.ac + '}' +
      'h1{font-size:6.8vw;line-height:1.08;letter-spacing:-.04em;font-weight:800;margin:1.8vh 0 2.6vh}' +
      '.sub{font-size:2.15vw;line-height:1.5;opacity:.82}' +
      '.team{margin-top:4.5vh;font-size:1.6vw;opacity:.6}' +
      '.art svg{width:100%;height:auto;display:block}' +
      'h2{font-size:3.4vw;letter-spacing:-.03em;font-weight:800;margin-bottom:4.5vh}' +
      '.flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:1.6vw;align-self:start}' +
      '.box{background:' + s.card + ';border-radius:1.4vw;padding:3.4vh 2.2vw;min-height:36vh}' +
      '.box b{display:block;font-size:2.3vw;margin-bottom:1.4vh;color:' + s.ac + '}' +
      '.box p{font-size:1.55vw;line-height:1.55;opacity:.85}' +
      '.ar{font-size:3vw;color:' + s.ac + '}' +
      '.res{grid-template-columns:auto 1fr;align-items:center;gap:5vw}' +
      '.big{font-size:17vw;font-weight:800;letter-spacing:-.05em;line-height:.9;color:' + s.ac + '}' +
      '.res p{font-size:2vw;line-height:1.55}.res small{display:block;margin-top:2vh;font-size:1.4vw;opacity:.6}' +
      '.pg{position:fixed;right:2.4vw;bottom:2.6vh;font-size:1.2vw;opacity:.5}';
    var flow = s.flow.map(function (f, i) {
      return (i ? '<div class="ar">→</div>' : '') + '<div class="box"><b>' + f[0] + '</b><p>' + f[1] + '</p></div>';
    }).join('');
    var js = 'var s=document.querySelectorAll(".s"),i=0,p=document.querySelector(".pg");' +
      'function go(n){i=(n+s.length)%s.length;s.forEach(function(e,k){e.classList.toggle("on",k===i)});p.textContent=(i+1)+" / "+s.length}' +
      'addEventListener("keydown",function(e){if(e.key==="ArrowRight"||e.key===" ")go(i+1);if(e.key==="ArrowLeft")go(i-1)});' +
      'addEventListener("click",function(){go(i+1)});go(0);';
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + s.title + '</title><link rel="stylesheet" href="' + FONT + '"><style>' + css + '</style></head><body>' +
      '<section class="s cover on"><div><div class="k">' + s.kicker + '</div><h1>' + s.h1 + '</h1><p class="sub">' + s.sub + '</p><p class="team">' + s.team + '</p></div><div class="art">' + s.art + '</div></section>' +
      '<section class="s"><div><h2>' + s.h2 + '</h2><div class="flow">' + flow + '</div></div></section>' +
      '<section class="s res"><div class="big">' + s.big + '</div><div><p>' + s.result + '</p><small>' + s.note + '</small></div></section>' +
      '<div class="pg"></div><script>' + js + '<\/script></body></html>';
  }

  function cube(x, y, s, top, left, right) {
    var h = s * 0.58;
    return '<polygon points="' + x + ',' + (y - h) + ' ' + (x + s) + ',' + (y - h / 2) + ' ' + x + ',' + y + ' ' + (x - s) + ',' + (y - h / 2) + '" fill="' + top + '"/>' +
      '<polygon points="' + (x - s) + ',' + (y - h / 2) + ' ' + x + ',' + y + ' ' + x + ',' + (y + s) + ' ' + (x - s) + ',' + (y + s - h / 2) + '" fill="' + left + '"/>' +
      '<polygon points="' + (x + s) + ',' + (y - h / 2) + ' ' + x + ',' + y + ' ' + x + ',' + (y + s) + ' ' + (x + s) + ',' + (y + s - h / 2) + '" fill="' + right + '"/>';
  }

  var artBin = '<svg viewBox="0 0 520 400" xmlns="http://www.w3.org/2000/svg">' +
    '<polygon points="260,170 500,290 260,396 20,290" fill="#DCE8FF"/><polygon points="260,158 500,278 260,384 20,278" fill="#F4F8FF" stroke="#B9CDF5" stroke-width="2"/>' +
    '<g stroke="#B9CDF5" stroke-width="5" stroke-linecap="round"><path d="M84,262 120,280M140,234 176,252M196,206 232,224"/></g>' +
    '<g fill="none" stroke-linecap="round"><path d="M102,268 Q230,-40 372,196" stroke="#C5D6FA" stroke-width="5" stroke-dasharray="1 13"/><path d="M214,212 Q300,60 372,196" stroke="#C5D6FA" stroke-width="5" stroke-dasharray="1 13"/>' +
    '<path d="M158,240 Q262,-10 372,196" stroke="#2F58C2" stroke-width="6" stroke-dasharray="1 13"/></g>' +
    '<ellipse cx="372" cy="318" rx="74" ry="26" fill="none" stroke="#2F58C2" stroke-width="3" stroke-dasharray="7 8"/>' +
    '<ellipse cx="372" cy="312" rx="56" ry="19" fill="#1B3A8A"/><ellipse cx="372" cy="304" rx="56" ry="19" fill="#5B86F0"/>' +
    '<path d="M326,206 L338,300 A34,11 0 0 0 406,300 L418,206 Z" fill="#fff" stroke="#1B3A8A" stroke-width="4" stroke-linejoin="round"/>' +
    '<ellipse cx="372" cy="206" rx="46" ry="15" fill="#CFDDF8" stroke="#1B3A8A" stroke-width="4"/>' +
    '<circle cx="264" cy="104" r="17" fill="#F28A2E" stroke="#C96A14" stroke-width="3"/><path d="M256,98 l8,7M268,96 l-3,9" stroke="#C96A14" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>';

  var artLine = '<svg viewBox="0 0 520 400" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M-10,330 C120,330 110,120 250,120 S380,300 530,250" fill="none" stroke="#FFD43B" stroke-width="16" stroke-linecap="round"/>' +
    '<path d="M-10,330 C120,330 110,120 250,120 S380,300 530,250" fill="none" stroke="#15171C" stroke-width="3" stroke-dasharray="2 18" stroke-linecap="round"/>' +
    '<g transform="translate(232,86) rotate(-6)"><rect x="-44" y="-26" width="88" height="56" rx="12" fill="#F4F4F0"/><rect x="-28" y="-46" width="56" height="26" rx="6" fill="#FFD43B"/>' +
    '<circle cx="-30" cy="34" r="13" fill="#15171C" stroke="#F4F4F0" stroke-width="5"/><circle cx="30" cy="34" r="13" fill="#15171C" stroke="#F4F4F0" stroke-width="5"/>' +
    '<circle cx="-14" cy="0" r="6" fill="#15171C"/><circle cx="14" cy="0" r="6" fill="#15171C"/></g>' +
    '<circle cx="470" cy="262" r="16" fill="none" stroke="#FFD43B" stroke-width="6"/><circle cx="470" cy="262" r="5" fill="#FFD43B"/></svg>';

  var artGrip = '<svg viewBox="0 0 520 400" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="236" y="20" width="48" height="96" rx="10" fill="#3B2A1E"/>' +
    '<path d="M260,110 150,170 150,300" fill="none" stroke="#3B2A1E" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M260,110 370,170 370,300" fill="none" stroke="#3B2A1E" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<rect x="158" y="220" width="20" height="92" rx="8" fill="#F26B21"/><rect x="342" y="220" width="20" height="92" rx="8" fill="#F26B21"/>' +
    '<ellipse cx="260" cy="262" rx="74" ry="96" fill="#FFFDF7" stroke="#3B2A1E" stroke-width="5"/>' +
    '<path d="M214,220 q12,-34 40,-44" fill="none" stroke="#F3E3C8" stroke-width="10" stroke-linecap="round"/>' +
    '<g stroke="#F26B21" stroke-width="5" stroke-linecap="round"><path d="M120,236 96,228M120,264 92,264M120,292 96,300M400,236 424,228M400,264 428,264M400,292 424,300"/></g></svg>';

  var artBal = '<svg viewBox="0 0 520 400" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M40,350 H480" stroke="#0E3B2E" stroke-width="5" stroke-linecap="round"/>' +
    '<g transform="rotate(7 260 300)"><rect x="216" y="70" width="88" height="190" rx="18" fill="#0E3B2E"/><rect x="232" y="92" width="56" height="40" rx="8" fill="#B8F2D0"/>' +
    '<circle cx="248" cy="112" r="6" fill="#0E3B2E"/><circle cx="272" cy="112" r="6" fill="#0E3B2E"/><rect x="236" y="150" width="48" height="8" rx="4" fill="#3FBF83"/><rect x="236" y="168" width="32" height="8" rx="4" fill="#3FBF83"/></g>' +
    '<circle cx="260" cy="300" r="50" fill="#fff" stroke="#0E3B2E" stroke-width="12"/><circle cx="260" cy="300" r="10" fill="#0E3B2E"/>' +
    '<path d="M150,120 q-34,60 -10,130M370,120 q34,60 10,130" fill="none" stroke="#3FBF83" stroke-width="6" stroke-linecap="round" stroke-dasharray="4 14"/></svg>';

  var now = Date.now(), MIN = 60000;
  var codes = {
    'sample-catchbin': deck({
      title: 'CatchBin 결과 발표', bg: '#FFFFFF', fg: '#0F1F47', ac: '#2F58C2', card: '#EEF4FF',
      kicker: 'PHYSICAL AI · 2조', h1: '던지면 받아 주는<br>쓰레기통', sub: '날아오는 종이를 카메라로 보고, 떨어질 자리로 먼저 가서 받습니다.', team: '정다은 · 한지우 · 윤서준 · 강유나',
      art: artBin, h2: '인지 → 판단 → 동작',
      flow: [['인지', '깊이 카메라가 날아오는 종이의 위치를 1초에 60번 잽니다.'], ['판단', '처음 0.2초로 떨어질 자리를 예측합니다.'], ['동작', '바퀴 받침대가 그 자리로 먼저 가서 받습니다.']],
      big: '75%', result: '세 거리에서 60번 던져 45번 받았습니다.<br>예측 오차는 평균 6cm.', note: '목표: 받기 성공률 70% 이상 · 예측 오차 10cm 이내'
    }),
    'sample-linebot': deck({
      title: 'LineBot', bg: '#15171C', fg: '#F4F4F0', ac: '#FFD43B', card: '#22252D',
      kicker: 'PHYSICAL AI · 1조', h1: '선을 따라<br>배달하는 LineBot', sub: '바닥의 노란 선을 카메라로 읽고, 강의실 끝까지 물건을 나릅니다.', team: '정유나 · 한지호 · 오세림',
      art: artLine, h2: '보기 → 정하기 → 움직이기',
      flow: [['보기', '아래를 보는 카메라가 선의 위치를 읽습니다.'], ['정하기', '선이 화면 가운데에서 벗어난 만큼 방향을 고칩니다.'], ['움직이기', '두 바퀴의 속도를 달리해 선 위로 돌아옵니다.']],
      big: '9/10', result: '12 m 코스를 열 번 달려 아홉 번 완주.<br>평균 41초.', note: '실패 1회: 창가의 햇빛 반사로 선을 놓침'
    }),
    'sample-grip': deck({
      title: 'GripSense', bg: '#FFF6E9', fg: '#3B2A1E', ac: '#F26B21', card: '#FFE9CF',
      kicker: 'PHYSICAL AI · 4조', h1: '달걀을 깨지 않는<br>그리퍼', sub: '손가락 끝의 압력 센서로 쥐는 힘을 스스로 줄입니다.', team: '윤가람 · 서다인',
      art: artGrip, h2: '쥐기 → 느끼기 → 줄이기',
      flow: [['쥐기', '그리퍼가 천천히 닫히며 달걀에 닿습니다.'], ['느끼기', '압력 센서 값을 0.02초마다 읽습니다.'], ['줄이기', '정한 값을 넘으면 바로 멈추고 힘을 유지합니다.']],
      big: '92%', result: '달걀 25개 중 23개를 깨지 않고 옮겼습니다.', note: '깨진 2개는 모두 표면이 젖어 있던 경우'
    }),
    'sample-balance': deck({
      title: 'BalanceBot', bg: '#E9FBF1', fg: '#0E3B2E', ac: '#17925A', card: '#CFF3E0',
      kicker: 'PHYSICAL AI · 6조', h1: '두 바퀴로 서는<br>BalanceBot', sub: '기울기 센서로 넘어지는 쪽을 알아채고 그쪽으로 바퀴를 굴립니다.', team: '문채원 · 강도현 · 임수아',
      art: artBal, h2: '재기 → 계산 → 굴리기',
      flow: [['재기', '기울기 센서가 몸이 기운 각도를 잽니다.'], ['계산', '기운 만큼, 기우는 빠르기만큼 힘을 정합니다.'], ['굴리기', '바퀴를 굴려 몸을 다시 세웁니다.']],
      big: '3분 12초', result: '손을 대지 않고 서 있던 가장 긴 시간.<br>처음 기록은 4초였습니다.', note: '살짝 밀어도 다시 섭니다(10회 중 8회)'
    })
  };

  var decks = [
    { id: 'sample-catchbin', name: '정다은', title: 'CatchBin — 던지면 받아 주는 쓰레기통', url: 'https://sites.google.com/view/example-catchbin', note: '60번 던져 45번 받았습니다, 성공률 75%', hasCode: true, m: 3 },
    { id: 'sample-fruit', name: '백승우', title: '색으로 과일을 가르는 컨베이어', url: 'https://sites.google.com/view/example-fruit-sorter', note: '사과와 귤을 카메라로 구분합니다', hasCode: false, m: 6 },
    { id: 'sample-linebot', name: '정유나', title: 'LineBot — 선을 따라 배달하는 로봇', url: '', note: '12 m 코스 열 번 중 아홉 번 완주', hasCode: true, m: 9 },
    { id: 'sample-window', name: '신예린', title: '창문 닦는 로봇 WinBot', url: 'https://gemini.google.com/share/example0001', note: '', hasCode: false, m: 13 },
    { id: 'sample-grip', name: '윤가람', title: 'GripSense — 달걀을 깨지 않는 그리퍼', url: 'https://sites.google.com/view/example-gripsense', note: '압력 센서로 쥐는 힘을 줄입니다', hasCode: true, m: 17 },
    { id: 'sample-pill', name: '노하준', title: '약 챙겨 주는 로봇 PillPal', url: 'https://sites.google.com/view/example-pillpal', note: '정해진 시간에 약통을 밀어 줍니다', hasCode: false, m: 22 },
    { id: 'sample-balance', name: '오세림', title: 'BalanceBot — 두 바퀴로 서는 로봇', url: '', note: '가장 오래 선 기록 3분 12초', hasCode: true, m: 26 },
    { id: 'sample-park', name: '권나은', title: '주차 자리를 알려 주는 ParkEye', url: 'https://gemini.google.com/share/example0002', note: '빈 자리를 세어 입구 화면에 보여 줍니다', hasCode: false, m: 31 },
    { id: 'sample-ball', name: '서다인', title: '탁구공 줍는 로봇', url: 'https://sites.google.com/view/example-ballbot', note: '', hasCode: false, m: 37 }
  ].map(function (d) {
    return { id: d.id, name: d.name, title: d.title, url: d.url, note: d.note, hasCode: d.hasCode, uid: 'sample', sample: true, createdAt: now - d.m * MIN, updatedAt: now - d.m * MIN };
  });

  // 데모 모드의 대시보드에 보일 지어낸 학번
  var sids = {};
  decks.forEach(function (d, i) { sids[d.id] = String(2024000101 + i * 7); });

  g.BOARD_SAMPLES = { decks: decks, codes: codes, sids: sids };
})(window);
