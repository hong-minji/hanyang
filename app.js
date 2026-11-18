/*
 * 공유보드 화면 동작.
 *  - 사람이 적은 글자는 모두 textContent 로만 넣습니다(HTML로 해석하지 않음).
 *  - 붙여 넣은 HTML 코드는 sandbox 를 건 iframe 안에서만 그립니다.
 */
(function () {
  'use strict';

  var CFG = window.BOARD_CONFIG || {};
  var INFO = CFG.classInfo || {};
  var LINKS = CFG.links || {};
  var MAIL = CFG.mail || {};
  var ASK_SID = !(CFG.submit && CFG.submit.askStudentId === false);   // 학번 칸을 쓸지
  var LIMIT = { name: 30, title: 60, note: 80, url: 500, codeBytes: 900 * 1024 };

  // 다른 사이트 안에 넣을 수 있다고 알려진 호스팅만 주소로 바로 미리보기를 띄운다.
  var FRAMEABLE = [/\.github\.io$/, /\.web\.app$/, /\.firebaseapp\.com$/, /\.netlify\.app$/, /\.vercel\.app$/, /\.pages\.dev$/];
  var HOSTS = [
    [/^sites\.google\.com$/, 'Google Sites'],
    [/^(gemini\.google\.com|g\.co)$/, 'Gemini 공유 링크'],
    [/\.github\.io$/, 'GitHub Pages'],
    [/\.(web\.app|firebaseapp\.com)$/, 'Firebase Hosting'],
    [/\.netlify\.app$/, 'Netlify'],
    [/\.vercel\.app$/, 'Vercel'],
    [/\.pages\.dev$/, 'Cloudflare Pages'],
    [/^docs\.google\.com$/, 'Google Docs'],
    [/^drive\.google\.com$/, 'Google Drive'],
    [/(^|\.)youtube\.com$|^youtu\.be$/, 'YouTube']
  ];
  var PALETTE = [
    ['#1B2A4E', '#F2B632', '#FFFFFF'], ['#0F4C3A', '#E9DFC7', '#FFFFFF'], ['#7A1E22', '#F3A59A', '#FFFFFF'],
    ['#E5432A', '#17161A', '#FFFFFF'], ['#2B4C9B', '#9FD0FF', '#FFFFFF'], ['#17161A', '#E5432A', '#FFFFFF'],
    ['#E8B520', '#17161A', '#17161A']
  ];

  var store = window.BoardStore.create();
  var state = { decks: [], loaded: false, q: '', sort: 'new', editing: null, open: true, cards: new Map(), codes: new Map(), firstPaint: true, flashId: null };

  function $(s) { return document.querySelector(s); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function bytes(s) { return new Blob([s]).size; }
  function kb(n) { return String(Math.ceil(n / 1024)); }

  function hostOf(url) { try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ''; } }
  function hostInfo(url) {
    var h = hostOf(url);
    if (!h) return { label: '이 보드에 올린 코드', frameable: false };
    var label = h.replace(/^www\./, '');
    for (var i = 0; i < HOSTS.length; i++) if (HOSTS[i][0].test(h)) { label = HOSTS[i][1]; break; }
    return { label: label, frameable: FRAMEABLE.some(function (r) { return r.test(h); }) };
  }
  function normUrl(raw) {
    var v = (raw || '').trim();
    if (!v) return { ok: true, url: '' };
    if (/^http:\/\//i.test(v)) return { ok: false, msg: 'https:// 로 시작하는 주소만 받습니다. 주소 맨 앞을 확인해 주세요.' };
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
    var u;
    try { u = new URL(v); } catch (e) { return { ok: false, msg: '주소 모양이 아닙니다. 브라우저 주소창의 주소를 그대로 복사해 주세요.' }; }
    if (u.protocol !== 'https:' || u.hostname.indexOf('.') < 0) return { ok: false, msg: 'https:// 로 시작하는 웹 주소만 받습니다.' };
    if (u.href.length > LIMIT.url) return { ok: false, msg: '주소가 너무 깁니다(500자까지).' };
    return { ok: true, url: u.href };
  }
  function timeText(ms) {
    var d = new Date(ms), now = new Date();
    var hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    return d.toDateString() === now.toDateString() ? hm : (d.getMonth() + 1) + '. ' + d.getDate() + '. ' + hm;
  }
  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 3200);
  }
  function setStatus(sel, msg, kind) { var n = $(sel); n.textContent = msg || ''; n.className = 'status' + (kind ? ' ' + kind : ''); }

  /* ---------- 미리보기 ---------- */
  function poster(d) {
    var h = hash(d.id || (d.name + '|' + d.title));
    var p = PALETTE[h % PALETTE.length];
    var box = el('div', 'poster m' + ((h >>> 5) % 5));
    box.style.setProperty('--pb', p[0]); box.style.setProperty('--pa', p[1]); box.style.setProperty('--pf', p[2]);
    box.appendChild(el('div', 'po-host', hostInfo(d.url).label));
    var title = d.title || '발표 제목';
    box.appendChild(el('div', 'po-title' + (title.length > 16 ? ' long' : ''), title));
    box.appendChild(el('div', 'po-name', d.name || '이름 또는 조'));
    return box;
  }
  // 카드의 ‹ › 버튼이 보낸 신호를 받아, 미리보기 안의 발표에 ← → 키를 대신 눌러 준다(코드 미리보기에만 넣는다).
  var BRIDGE = '<script>(function(){function press(key,code){["keydown","keyup"].forEach(function(t){var e;' +
    'try{e=new KeyboardEvent(t,{key:key,code:key,bubbles:true,cancelable:true});}catch(x){return;}' +
    'try{Object.defineProperty(e,"keyCode",{get:function(){return code;}});Object.defineProperty(e,"which",{get:function(){return code;}});}catch(x){}' +
    '(document.body||document.documentElement).dispatchEvent(e);});}' +
    'addEventListener("message",function(e){if(e.source!==parent)return;var d=e.data;if(!d||d.board!=="nav")return;' +
    'if(d.dir==="next")press("ArrowRight",39);else if(d.dir==="prev")press("ArrowLeft",37);});})();<\/script>';

  function frameFor(kind, value) {
    var f = document.createElement('iframe');
    f.setAttribute('tabindex', '-1');
    f.setAttribute('scrolling', 'no');
    f.setAttribute('referrerpolicy', 'no-referrer');
    f.title = '미리보기 — 안을 눌러 직접 넘겨 볼 수 있습니다';
    f._kind = kind;
    if (kind === 'code') {
      // 스크립트는 돌지만 이 사이트의 저장소·쿠키에는 닿지 못한다(allow-same-origin 을 주지 않음).
      f.setAttribute('sandbox', 'allow-scripts');
      f.srcdoc = value + '<style>html,body{overflow:hidden!important}::-webkit-scrollbar{display:none!important}</style>' + BRIDGE;
    } else {
      f.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      f.src = value;
    }
    return f;
  }
  function fit(shot) {
    var f = shot.querySelector('iframe');
    if (f && shot.clientWidth) f.style.transform = 'scale(' + (shot.clientWidth / 1280) + ')';
  }
  var ro = new ResizeObserver(function (entries) { entries.forEach(function (e) { fit(e.target); }); });

  // 미리보기 아래의 ‹ › 버튼. 붙여 넣은 코드로 띄운 미리보기에서만 쓴다.
  function navButtons(shot) {
    var box = el('div', 'ctl-nav');
    [['prev', '‹', '이전 장'], ['next', '›', '다음 장']].forEach(function (b) {
      var btn = el('button', 'nav-btn', b[1]); btn.type = 'button'; btn.title = b[2]; btn.setAttribute('aria-label', b[2]);
      btn.addEventListener('click', function () {
        var f = shot.querySelector('iframe');
        if (f && f._kind === 'code' && f.contentWindow) f.contentWindow.postMessage({ board: 'nav', dir: b[0] }, '*');
      });
      box.appendChild(btn);
    });
    box.hidden = true;
    return box;
  }
  function syncNav(shot, nav) {
    var f = shot.querySelector('iframe');
    nav.hidden = !(f && f._kind === 'code');
    // 버튼 줄에 보일 것이 하나도 없으면 줄째로 숨긴다.
    var row = nav.parentNode;
    if (row) row.hidden = !Array.prototype.some.call(row.children, function (c) { return !c.hidden; });
  }

  function previewKey(d) {
    if (d.hasCode) return 'c:' + d.updatedAt;
    if (hostInfo(d.url).frameable) return 'u:' + d.url;
    return 'p:' + d.name + '|' + d.title + '|' + d.url;
  }
  function getCode(d) {
    var k = d.id + ':' + d.updatedAt;
    if (!state.codes.has(k)) state.codes.set(k, store.getCode(d.id).catch(function () { return null; }));
    return state.codes.get(k);
  }
  function mount(card) {
    var d = card._deck, shot = card._shot, key = previewKey(d);
    if (card._mounted === key) return;
    card._mounted = key;
    clear(shot); shot.classList.remove('loading');
    if (d.hasCode) {
      shot.classList.add('loading');
      getCode(d).then(function (code) {
        if (card._mounted !== key) return;
        shot.classList.remove('loading'); clear(shot);
        if (code) { shot.appendChild(frameFor('code', code)); fit(shot); }
        else shot.appendChild(poster(d));
        syncNav(shot, card._nav);
      });
    } else if (hostInfo(d.url).frameable) {
      shot.appendChild(frameFor('url', d.url)); fit(shot);
    } else {
      shot.appendChild(poster(d));
    }
    syncNav(shot, card._nav);
  }
  function unmount(card) {
    // 화면에서 멀어진 iframe 은 내려서 브라우저를 가볍게 한다. 포스터는 가벼우니 둔다.
    if (card._shot.querySelector('iframe')) { clear(card._shot); card._mounted = null; }
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var card = e.target._card; if (!card) return;
      card._near = e.isIntersecting;
      if (e.isIntersecting) mount(card); else unmount(card);
    });
  }, { rootMargin: '700px 0px' });

  /* ---------- 카드 ---------- */
  function buildCard(d) {
    var art = el('article', 'piece');
    var frame = el('div', 'frame');
    var shot = el('div', 'shot'); shot._card = art;
    // 미리보기 아래의 버튼 줄: ‹ › (넘겨 보기) · 사이트 바로 가기
    var ctl = el('div', 'ctl'), nav = navButtons(shot);
    var site = el('a', 'site-btn', '사이트 바로 가기 ↗'); site.target = '_blank'; site.rel = 'noopener noreferrer';
    ctl.appendChild(nav); ctl.appendChild(site);
    frame.appendChild(shot); frame.appendChild(ctl);

    var plaque = el('div', 'plaque');
    var no = el('span', 'no');
    var title = el('h3'), who = el('p', 'who'), memo = el('p', 'memo'), meta = el('div', 'meta');
    plaque.appendChild(no); plaque.appendChild(title); plaque.appendChild(who); plaque.appendChild(memo); plaque.appendChild(meta);
    art.appendChild(frame); art.appendChild(plaque);

    art._shot = shot; art._nav = nav; art._site = site; art._no = no; art._title = title; art._who = who; art._memo = memo; art._meta = meta;

    site.addEventListener('click', function (ev) {
      if (art._deck.sample) { ev.preventDefault(); toast('데모용 예시 카드라서 열리는 주소가 없습니다.'); }
    });
    updateCard(art, d);
    return art;
  }

  function updateCard(card, d) {
    card._deck = d;
    var info = hostInfo(d.url);
    // 사이트 바로 가기: 적어 낸 주소를 새 탭으로 연다(주소를 내지 않았으면 버튼이 없다).
    card._site.hidden = !d.url;
    card._site.href = d.url && !d.sample ? d.url : '#wall';
    card._site.setAttribute('aria-label', d.name + '의 결과물 “' + d.title + '” 사이트 바로 가기');
    card._title.textContent = d.title;
    card._who.textContent = d.name;
    card._memo.textContent = d.note; card._memo.hidden = !d.note;

    var meta = card._meta; clear(meta);
    var mine = !!store.uid && d.uid === store.uid;
    if (mine) meta.appendChild(el('span', 'tag mine', '내 결과물'));
    meta.appendChild(el('span', 'tag', info.label));
    meta.appendChild(el('span', '', timeText(d.createdAt)));
    if (mine) {
      meta.appendChild(el('span', 'sp'));
      var edit = el('button', 'text-btn', '고치기'); edit.type = 'button';
      edit.hidden = !state.open;   // 접수가 닫히면 고칠 수 없다(내리기는 된다)
      edit.addEventListener('click', function () { startEdit(card._deck); });
      var del = el('button', 'text-btn danger', '지우기'); del.type = 'button';
      del.addEventListener('click', function () {
        if (del.dataset.sure) { removeDeck(card._deck); return; }
        del.dataset.sure = '1'; del.textContent = '정말 내릴까요?';
        setTimeout(function () { delete del.dataset.sure; del.textContent = '지우기'; }, 4000);
      });
      meta.appendChild(edit); meta.appendChild(del);
    }
    // 포스터는 가벼우니 바로 띄우고, 코드·주소 미리보기는 화면 가까이 왔을 때만 띄운다.
    if (card._near || previewKey(d).charAt(0) === 'p') mount(card);
    syncNav(card._shot, card._nav);
  }

  function match(d, q) {
    if (!q) return true;
    return (d.name + ' ' + d.title + ' ' + d.note).toLowerCase().indexOf(q) >= 0;
  }

  function render() {
    if (!state.loaded) return;
    var grid = $('#grid');
    var asc = state.decks.slice().sort(function (a, b) { return a.createdAt - b.createdAt; });
    var no = {}; asc.forEach(function (d, i) { no[d.id] = i + 1; });
    var list = state.decks.slice();
    if (state.sort === 'name') list.sort(function (a, b) { return a.name.localeCompare(b.name, 'ko') || a.createdAt - b.createdAt; });
    else list.sort(function (a, b) { return b.createdAt - a.createdAt; });

    var seen = {}, shown = 0;
    list.forEach(function (d, i) {
      var card = state.cards.get(d.id);
      if (!card) {
        card = buildCard(d);
        card.style.setProperty('--i', state.firstPaint ? Math.min(i, 14) : 0);
        state.cards.set(d.id, card);
        io.observe(card._shot); ro.observe(card._shot);
      } else {
        updateCard(card, d);
      }
      card._no.textContent = 'N° ' + pad(no[d.id]);
      if (grid.children[i] !== card) grid.insertBefore(card, grid.children[i] || null);
      var vis = match(d, state.q);
      card.hidden = !vis; if (vis) shown++;
      seen[d.id] = true;
    });
    state.cards.forEach(function (card, id) {
      if (seen[id]) return;
      io.unobserve(card._shot); ro.unobserve(card._shot); card.remove(); state.cards.delete(id);
    });
    state.firstPaint = false;

    var total = state.decks.length;
    $('#wallCount').textContent = '';   // 개수는 보여 주지 않는다
    var empty = $('#empty');
    empty.hidden = shown > 0;
    if (!shown) {
      $('#emptyTitle').textContent = total ? '찾는 결과물이 없습니다' : '아직 올라온 결과물이 없습니다';
      $('#emptyText').textContent = total ? '이름이나 제목을 다르게 적어 보세요.' : '첫 번째로 올려 보세요. 위의 ‘내 결과물 올리기’에서 올리면 여기에 보입니다.';
    }

    if (state.flashId && state.cards.has(state.flashId)) {
      var c = state.cards.get(state.flashId); state.flashId = null;
      setTimeout(function () {
        c.scrollIntoView({ behavior: 'smooth', block: 'center' });
        c.classList.add('flash'); setTimeout(function () { c.classList.remove('flash'); }, 2000);
      }, 60);
    }
  }

  /* ---------- 올리기 · 고치기 · 내리기 ---------- */
  var fName = $('#fName'), fTitle = $('#fTitle'), fUrl = $('#fUrl'), fNote = $('#fNote'), fCode = $('#fCode'), fSid = $('#fSid');
  if (!ASK_SID) $('#fSidField').hidden = true;

  function readForm() {
    return { name: fName.value.trim(), title: fTitle.value.trim(), note: fNote.value.trim(), code: fCode.value.trim() ? fCode.value : '', sid: fSid.value.trim() };
  }
  function updateCodeSize() {
    var n = bytes(fCode.value), node = $('#codeSize');
    node.textContent = kb(n) + ' KB / 900 KB';
    node.classList.toggle('over', n > LIMIT.codeBytes);
  }
  var tryTimer, tryNav = navButtons($('#tryShot'));
  $('#tryCtl').appendChild(tryNav);
  ro.observe($('#tryShot'));   // 접혀 있다가 펼쳐질 때 미리보기 크기를 다시 맞춘다

  /* 올리기 칸은 평소에 접혀 있다. 버튼, 머리글의 ‘결과물 올리기’, 카드의 ‘고치기’가 펼친다. */
  function setSubmitOpen(on) {
    $('#submit').classList.toggle('open', on);
    $('#submitBody').hidden = !on;
    var t = $('#submitToggle');
    t.setAttribute('aria-expanded', String(on));
    t.textContent = on ? '접기' : '올리기 열기';
    t.classList.toggle('primary', !on); t.classList.toggle('line', on);
    if (on) fit($('#tryShot'));
  }
  $('#submitToggle').addEventListener('click', function () { setSubmitOpen($('#submitBody').hidden); });
  function updateTry() {
    clearTimeout(tryTimer);
    tryTimer = setTimeout(function () {
      var f = readForm(), u = normUrl(fUrl.value);
      var d = { id: '', name: f.name, title: f.title, url: u.ok ? u.url : '', note: f.note };
      $('#tryTitle').textContent = f.title || '발표 제목';
      $('#tryName').textContent = f.name || '이름 또는 조';
      $('#tryNote').textContent = f.note; $('#tryNote').hidden = !f.note;
      $('#tryHost').textContent = d.url ? hostInfo(d.url).label : (f.code ? '이 보드에 올린 코드' : '주소 없음');
      var shot = $('#tryShot'); clear(shot);
      if (f.code && bytes(f.code) <= LIMIT.codeBytes) { shot.appendChild(frameFor('code', f.code)); fit(shot); }
      else if (d.url && hostInfo(d.url).frameable) { shot.appendChild(frameFor('url', d.url)); fit(shot); }
      else shot.appendChild(poster(d));
      syncNav(shot, tryNav);
    }, 350);
  }
  [fName, fTitle, fUrl, fNote, fCode].forEach(function (n) { n.addEventListener('input', updateTry); });
  fCode.addEventListener('input', updateCodeSize);
  ro.observe($('#tryShot'));

  $('#pickFile').addEventListener('click', function () { $('#fileInput').click(); });
  $('#fileInput').addEventListener('change', function () {
    var file = this.files && this.files[0]; this.value = '';
    if (!file) return;
    if (file.size > LIMIT.codeBytes) { setStatus('#deckStatus', '파일이 900 KB보다 큽니다. 사진이나 영상을 파일 안에 넣었다면 Drive 주소로 바꿔 보세요.', 'bad'); return; }
    var r = new FileReader();
    r.onload = function () { fCode.value = String(r.result || ''); updateCodeSize(); updateTry(); setStatus('#deckStatus', file.name + ' 을 불러왔습니다.', ''); };
    r.readAsText(file);
  });
  $('#clearCode').addEventListener('click', function () { fCode.value = ''; updateCodeSize(); updateTry(); });

  function friendly(e) {
    var code = (e && (e.code || e.message)) || '';
    if (/permission-denied/.test(code)) return state.open ? '저장할 수 없습니다. 올린 브라우저에서만 고치거나 지울 수 있습니다.' : '지금은 올리기가 닫혀 있습니다.';
    if (/storage/.test(code)) return '이 브라우저의 저장 공간이 부족합니다(데모 모드). 코드를 줄여 보세요.';
    if (/unavailable|network|offline/.test(code)) return '인터넷 연결을 확인하고 다시 눌러 주세요.';
    return '저장하지 못했습니다. 잠시 뒤 다시 눌러 주세요.';
  }

  $('#deckForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = readForm(), u = normUrl(fUrl.value);
    if (!f.name) { setStatus('#deckStatus', '이름 또는 조를 적어 주세요.', 'bad'); fName.focus(); return; }
    if (ASK_SID && !f.sid) { setStatus('#deckStatus', '학번을 적어 주세요. 보드에는 보이지 않습니다.', 'bad'); fSid.focus(); return; }
    if (ASK_SID && !/^[0-9A-Za-z-]{4,20}$/.test(f.sid)) { setStatus('#deckStatus', '학번은 숫자(와 영문자)로 4~20자까지 적을 수 있습니다.', 'bad'); fSid.focus(); return; }
    if (!f.title) { setStatus('#deckStatus', '발표 제목을 적어 주세요.', 'bad'); fTitle.focus(); return; }
    if (!u.ok) { setStatus('#deckStatus', u.msg, 'bad'); fUrl.focus(); return; }
    if (!u.url && !f.code) { setStatus('#deckStatus', '발표 주소나 HTML 코드 중 하나는 넣어 주세요.', 'bad'); fUrl.focus(); return; }
    if (f.code && bytes(f.code) > LIMIT.codeBytes) { setStatus('#deckStatus', '코드가 900 KB보다 큽니다. 사진이나 영상을 코드 안에 넣었다면 Drive 주소로 바꿔 보세요.', 'bad'); fCode.focus(); return; }

    var fields = { name: f.name.slice(0, LIMIT.name), title: f.title.slice(0, LIMIT.title), url: u.url, note: f.note.slice(0, LIMIT.note) };
    var btn = $('#deckBtn'); btn.disabled = true;
    setStatus('#deckStatus', '올리는 중입니다…', '');
    var editing = state.editing;
    var priv = ASK_SID ? { studentId: f.sid } : null;
    var job = editing ? store.update(editing.id, fields, f.code, editing.hasCode, priv) : store.add(fields, f.code, priv);
    job.then(function (id) {
      state.flashId = id;
      resetForm();
      setSubmitOpen(false);   // 올린 뒤에는 접고, 아래 보드의 내 카드로 간다
      setStatus('#deckStatus', editing ? '고친 내용이 반영됐습니다.' : '공유됐습니다. 아래 보드에서 확인하세요.', 'ok');
      toast(editing ? '고친 내용이 반영됐습니다.' : '공유됐습니다.');
      render();
    }).catch(function (e) {
      setStatus('#deckStatus', friendly(e), 'bad');
    }).then(function () { btn.disabled = !state.open; });
  });

  function resetForm() {
    state.editing = null;
    $('#deckForm').reset();
    $('#formTitle').textContent = '내 결과물 올리기';
    $('#deckBtn').textContent = '공유하기';
    $('#cancelEdit').hidden = true;
    updateCodeSize(); updateTry();
  }
  function startEdit(d) {
    state.editing = d;
    fName.value = d.name; fTitle.value = d.title; fUrl.value = d.url; fNote.value = d.note; fCode.value = ''; fSid.value = '';
    if (ASK_SID) store.getPrivate(d.id).then(function (p) { if (state.editing === d && p && !fSid.value) fSid.value = p.studentId || ''; }, function () {});
    $('#formTitle').textContent = '내 결과물 고치기';
    $('#deckBtn').textContent = '고친 내용 저장';
    $('#cancelEdit').hidden = false;
    setStatus('#deckStatus', d.hasCode ? '올려 둔 코드를 불러오는 중입니다…' : '', '');
    updateCodeSize(); updateTry();
    setSubmitOpen(true);
    $('#submit').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (d.hasCode) {
      getCode(d).then(function (code) {
        if (state.editing !== d) return;
        fCode.value = code || ''; updateCodeSize(); updateTry();
        setStatus('#deckStatus', '고칠 곳을 고친 뒤 ‘고친 내용 저장’을 누르세요.', '');
      });
    }
  }
  $('#cancelEdit').addEventListener('click', function () { resetForm(); setStatus('#deckStatus', '', ''); });

  function removeDeck(d) {
    store.remove(d.id).then(function () {
      if (state.editing && state.editing.id === d.id) resetForm();
      toast('보드에서 지웠습니다.');
    }).catch(function (e) { toast(friendly(e)); });
  }

  /* ---------- 실습 메일 ---------- */
  var mailBtn = $('#mailBtn');
  function initMail() {
    $('#mCodeField').hidden = !MAIL.askClassCode;
    if (!MAIL.url) {
      mailBtn.disabled = true;
      setStatus('#mailStatus', '아직 메일 보내기가 연결되지 않았습니다. 강사가 연결하면 이 버튼이 켜집니다.', 'warn');
    }
  }
  $('#mailForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!MAIL.url) return;
    var email = $('#mEmail').value.trim(), name = $('#mName').value.trim(), code = $('#mCode').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setStatus('#mailStatus', '메일 주소를 다시 확인해 주세요.', 'bad'); $('#mEmail').focus(); return; }
    if (MAIL.askClassCode && !code) { setStatus('#mailStatus', '수업 코드를 적어 주세요.', 'bad'); $('#mCode').focus(); return; }
    mailBtn.disabled = true;
    setStatus('#mailStatus', '보내는 중입니다…', '');
    // text/plain 으로 보내면 브라우저가 사전 확인 요청을 하지 않아 Apps Script 가 바로 받는다.
    // 응답은 다른 주소로 한 번 넘겨져서 오므로 redirect 를 따라가게 둔다.
    fetch(MAIL.url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ email: email, name: name, classCode: code }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) {
          setStatus('#mailStatus', email + ' 로 보냈습니다. 1분 안에 도착합니다. 안 보이면 스팸함을 확인하세요.', 'ok');
          setTimeout(function () { mailBtn.disabled = false; }, 30000);
        } else {
          setStatus('#mailStatus', (res && res.message) || '보내지 못했습니다. 잠시 뒤 다시 눌러 주세요.', 'bad');
          mailBtn.disabled = false;
        }
      })
      .catch(function () {
        setStatus('#mailStatus', '응답을 읽지 못했습니다. 메일이 갔을 수도 있으니 1분 뒤 메일함을 먼저 확인하고, 없으면 다시 눌러 주세요.', 'warn');
        setTimeout(function () { mailBtn.disabled = false; }, 15000);
      });
  });

  /* ---------- 벽 도구 ---------- */
  $('#q').addEventListener('input', function () { state.q = this.value.trim().toLowerCase(); render(); });
  document.querySelectorAll('.seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.sort = b.dataset.sort;
      document.querySelectorAll('.seg button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      render();
    });
  });
  function setWallOnly(on) {
    document.body.classList.toggle('wall-only', on);
    var b = $('#wallMode'); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '올리기 칸 함께 보기' : '보드만 보기';
    // 벽만 볼 때는 제목 자리에 보드 이름을 보여 준다(화면 공유용).
    $('#wallTitle').textContent = on && Array.isArray(INFO.boardTitle) && INFO.boardTitle.length ? INFO.boardTitle.join(' ') : '공유된 결과물';
    try {
      var u = new URL(location.href);
      if (on) u.searchParams.set('wall', '1'); else u.searchParams.delete('wall');
      history.replaceState(null, '', u);
    } catch (e) { /* 주소를 못 바꿔도 동작에는 문제없다 */ }
  }
  $('#wallMode').addEventListener('click', function () { setWallOnly(!document.body.classList.contains('wall-only')); window.scrollTo(0, 0); });
  document.querySelectorAll('[data-go]').forEach(function (a) {
    a.addEventListener('click', function () {
      var go = a.dataset.go;
      if (go !== 'wall' && document.body.classList.contains('wall-only')) setWallOnly(false);
      if (go === 'submit') setSubmitOpen(true);
      setTimeout(function () { var f = go === 'mail' ? $('#mEmail') : go === 'submit' ? fName : null; if (f) f.focus({ preventScroll: true }); }, 500);
    });
  });

  /* ---------- 시작 ---------- */
  function initInfo() {
    $('#courseText').textContent = [INFO.school, INFO.course].filter(Boolean).join(' · ');
    var eb = $('#eyebrow'); clear(eb);
    [INFO.school, INFO.course, INFO.date].filter(Boolean).forEach(function (t) { eb.appendChild(el('span', '', t)); });
    if (Array.isArray(INFO.boardTitle) && INFO.boardTitle.length) {
      var h = $('#boardTitle'); clear(h);
      INFO.boardTitle.forEach(function (t) { h.appendChild(el('span', '', t)); });
      document.title = INFO.boardTitle.join(' ');
    }
    ['#guideLink', '#guideLink2'].forEach(function (id) { if (LINKS.guideUrl) { $(id).href = LINKS.guideUrl; $(id).hidden = false; } });
    ['#materialsLink', '#materialsLink2'].forEach(function (id) { if (LINKS.materialsUrl) { $(id).href = LINKS.materialsUrl; $(id).hidden = false; } });
    if (location.hash === '#submit') setSubmitOpen(true);
    $('#fine').textContent = [INFO.school, INFO.course, INFO.lecture, INFO.date].filter(Boolean).join(' · ');
    if (store.mode === 'demo') {
      $('#demoChip').hidden = false;
    }
  }
  function sysNote(msg) { var n = $('#sysNote'); n.textContent = msg; n.hidden = !msg; }

  store.onError(function (kind, e) {
    var code = String((e && (e.code || e.message)) || '');
    if (kind === 'sdk') sysNote('Firebase를 불러오지 못했습니다. 인터넷 연결을 확인하고 새로 고쳐 주세요.');
    else if (kind === 'auth') {
      if (/operation-not-allowed|admin-restricted-operation/.test(code)) sysNote('익명 로그인이 꺼져 있어 올리기를 할 수 없습니다. 보드는 볼 수 있습니다. (강사용: Firebase 콘솔 → Authentication → 로그인 방법 → 익명 사용 설정)');
      else if (/api-key/.test(code)) sysNote('Firebase 설정값이 맞지 않아 올리기를 할 수 없습니다. (강사용: config.js 의 firebase 값을 콘솔에서 다시 복사)');
      else if (/network/.test(code)) sysNote('인터넷 연결이 불안정해 올리기를 준비하지 못했습니다. 새로 고쳐 주세요.');
      else sysNote('올리기를 준비하지 못했습니다. 보드는 볼 수 있습니다. 새로 고쳐도 같으면 강사에게 알려 주세요. (' + code + ')');
    } else {
      if (/permission-denied/.test(code)) sysNote('보드 내용을 읽을 권한이 없습니다. (강사용: Firestore 보안 규칙을 firestore.rules 내용으로 게시했는지 확인)');
      else sysNote('보드 내용을 읽지 못했습니다. 잠시 뒤 새로 고쳐 주세요. (강사용: Firestore 데이터베이스를 만들었는지 확인 · ' + code + ')');
      showWallMessage('보드를 불러오지 못했습니다', '잠시 뒤 새로 고쳐 주세요.');
    }
  });
  store.onBoard(function (b) {
    state.open = b.open;
    $('#submit').classList.toggle('closed', !b.open);
    $('#closedNote').hidden = b.open;
    $('#closedNote').textContent = b.missing
      ? '아직 올리기가 열리지 않았습니다. (강사용: Firestore에 meta/board 문서를 만들고 open 을 true 로)'
      : '지금은 올리기가 닫혀 있습니다. 올라온 결과물은 계속 볼 수 있습니다.';
    $('#deckBtn').disabled = !b.open;
    if (!b.open && state.editing) resetForm();
    render();
  });
  function showWallMessage(title, text) {
    if (state.loaded) return;
    $('#emptyTitle').textContent = title; $('#emptyText').textContent = text; $('#empty').hidden = false;
  }
  store.onDecks(function (list) { state.loaded = true; state.decks = list; render(); });
  if (!state.loaded) {
    showWallMessage('보드를 불러오는 중입니다', '잠시만 기다려 주세요.');
    setTimeout(function () { showWallMessage('아직 보드를 불러오지 못했습니다', '인터넷 연결을 확인하고 새로 고쳐 주세요.'); }, 10000);
  }
  store.ready().then(function () { render(); }, function () {});

  initInfo(); initMail(); updateCodeSize(); updateTry();
  if (new URLSearchParams(location.search).get('wall') === '1') setWallOnly(true);
})();
