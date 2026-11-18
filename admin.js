/*
 * 담당자용 대시보드 — 제출한 사람 목록과 결과물 내려받기.
 *  - 관리 코드를 적어야 학번과 목록이 보입니다(코드가 맞는지는 Firebase 보안 규칙이 정합니다).
 *  - 사람이 적은 글자는 모두 textContent 로만 넣습니다.
 */
(function () {
  'use strict';

  var CFG = window.BOARD_CONFIG || {};
  var INFO = CFG.classInfo || {};
  var store = window.BoardStore.create();
  var state = { decks: [], priv: new Map(), rows: [], sort: 'time', unlocked: false, busy: false };

  function $(s) { return document.querySelector(s); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function setStatus(sel, msg, kind) { var n = $(sel); n.textContent = msg || ''; n.className = 'status' + (kind ? ' ' + kind : ''); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  $('#aCourse').textContent = [INFO.school, INFO.course].filter(Boolean).join(' · ');
  if (store.mode === 'demo') { $('#aDemo').hidden = false; $('#aCode').placeholder = '데모 모드 — 아무 글자나'; }

  /* ---------- 관리 코드 ---------- */
  $('#gateForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var code = $('#aCode').value.trim();
    if (!code) { setStatus('#gateStatus', '관리 코드를 적어 주세요.', 'bad'); return; }
    $('#gateBtn').disabled = true;
    setStatus('#gateStatus', '확인하는 중입니다…', '');
    store.claimAdmin(code).then(function () {
      state.unlocked = true;
      $('#gate').hidden = true; $('#dash').hidden = false;
      store.onDecks(function (list) { state.decks = list.filter(function (d) { return !d.sample || store.mode === 'demo'; }); refresh(); });
    }).catch(function (e) {
      var msg = /bad-code/.test(String(e && e.message)) ? '관리 코드가 맞지 않습니다.' :
        /auth|operation-not-allowed|admin-restricted/.test(String(e && (e.code || e.message))) ? '익명 로그인이 꺼져 있습니다. Firebase의 Authentication에서 켜 주세요.' :
        '확인하지 못했습니다. 인터넷 연결과 Firebase 설정을 확인해 주세요.';
      setStatus('#gateStatus', msg, 'bad');
    }).then(function () { $('#gateBtn').disabled = false; });
  });

  /* ---------- 목록 ---------- */
  // 학번은 카드마다 따로 읽는다. 고친 카드만 다시 읽도록 (id + 고친 시각)으로 기억해 둔다.
  function refresh() {
    var jobs = state.decks.map(function (d) {
      var key = d.id + ':' + d.updatedAt, have = state.priv.get(d.id);
      if (have && have.key === key) return Promise.resolve();
      return store.getPrivate(d.id).then(function (p) { state.priv.set(d.id, { key: key, sid: p ? p.studentId : '' }); },
        function () { state.priv.set(d.id, { key: key, sid: '', failed: true }); });
    });
    Promise.all(jobs).then(render);
  }

  function rows() {
    var list = state.decks.map(function (d) {
      var p = state.priv.get(d.id) || {};
      return { id: d.id, sid: p.sid || '', name: d.name, title: d.title, url: d.url, hasCode: d.hasCode, createdAt: d.createdAt, updatedAt: d.updatedAt };
    });
    if (state.sort === 'sid') list.sort(function (a, b) { return (a.sid || '~').localeCompare(b.sid || '~', 'ko') || a.createdAt - b.createdAt; });
    else if (state.sort === 'name') list.sort(function (a, b) { return a.name.localeCompare(b.name, 'ko') || a.createdAt - b.createdAt; });
    else list.sort(function (a, b) { return a.createdAt - b.createdAt; });
    return list;
  }

  function render() {
    var list = state.rows = rows();
    var withCode = list.filter(function (r) { return r.hasCode; }).length;
    $('#aCount').textContent = list.length;
    $('#aCodeCount').textContent = withCode;
    $('#aNoSid').textContent = list.filter(function (r) { return !r.sid; }).length;
    $('#aUpdated').textContent = '마지막으로 불러온 때 ' + stamp(Date.now());
    var body = $('#aRows'); clear(body);
    if (!list.length) {
      var tr0 = el('tr'); var td0 = el('td', 'empty', '아직 제출한 사람이 없습니다.'); td0.colSpan = 7; tr0.appendChild(td0); body.appendChild(tr0);
    }
    list.forEach(function (r, i) {
      var tr = el('tr');
      tr.appendChild(el('td', 'num', String(i + 1)));
      tr.appendChild(el('td', 'sid' + (r.sid ? '' : ' miss'), r.sid || '없음'));
      tr.appendChild(el('td', 'who', r.name));
      tr.appendChild(el('td', 'ttl', r.title));
      var tdU = el('td', 'url');
      if (/^https:\/\//.test(r.url)) { var a = el('a', '', r.url.replace(/^https:\/\//, '')); a.href = r.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; tdU.appendChild(a); }
      else tdU.appendChild(el('span', 'miss', '주소 없음'));
      tr.appendChild(tdU);
      var tdC = el('td', 'code');
      if (r.hasCode) {
        var b = el('button', 'mini', 'HTML 받기'); b.type = 'button';
        b.addEventListener('click', function () { downloadOne(r, b); });
        var v = el('a', 'mini-link', '보기'); v.href = 'view.html?id=' + encodeURIComponent(r.id); v.target = '_blank'; v.rel = 'noopener';
        tdC.appendChild(b); tdC.appendChild(v);
      } else tdC.appendChild(el('span', 'miss', '코드 없음'));
      tr.appendChild(tdC);
      tr.appendChild(el('td', 'time', stamp(r.createdAt) + (r.updatedAt - r.createdAt > 60000 ? ' (고침 ' + stamp(r.updatedAt).slice(11) + ')' : '')));
      body.appendChild(tr);
    });
    $('#csvBtn').disabled = $('#zipBtn').disabled = !list.length || state.busy;
  }

  document.querySelectorAll('[data-sort]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.sort = b.dataset.sort;
      document.querySelectorAll('[data-sort]').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      render();
    });
  });

  /* ---------- 내려받기 ---------- */
  function safeName(s) { return String(s || '').replace(/[\\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || '이름 없음'; }
  function baseName(r) { return [r.sid || '학번없음', safeName(r.name), safeName(r.title)].join('_'); }
  function cell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;                 // 표 프로그램이 수식으로 읽지 않게
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function csvText(list) {
    var lines = [['번호', '학번', '이름 또는 조', '발표 제목', '발표 주소', 'HTML 코드', '올린 시각', '고친 시각'].map(cell).join(',')];
    list.forEach(function (r, i) {
      lines.push([i + 1, r.sid, r.name, r.title, r.url, r.hasCode ? '있음' : '없음', stamp(r.createdAt), stamp(r.updatedAt)].map(cell).join(','));
    });
    return '﻿' + lines.join('\r\n') + '\r\n';             // 맨 앞의 표시는 Excel에서 한글이 깨지지 않게
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // 주소만 낸 사람의 자리: 열면 그 주소로 넘어가는 작은 파일
  function linkPage(r) {
    return '<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><title>' + esc(r.title) + '</title>\n' +
      '<meta http-equiv="refresh" content="0;url=' + esc(r.url) + '"></head>\n' +
      '<body style="font-family:sans-serif;padding:40px;line-height:1.7"><p>' + esc(r.name) + ' — ' + esc(r.title) + '</p>\n' +
      '<p>이 제출은 주소만 있습니다. 넘어가지 않으면 눌러 주세요: <a href="' + esc(r.url) + '">' + esc(r.url) + '</a></p></body></html>\n';
  }
  function save(blob, name) {
    var a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function downloadOne(r, btn) {
    btn.disabled = true;
    store.getCode(r.id).then(function (code) {
      if (!code) { setStatus('#dashStatus', '코드를 읽지 못했습니다: ' + r.name, 'bad'); return; }
      save(new Blob([code], { type: 'text/html;charset=utf-8' }), baseName(r) + '.html');
    }).catch(function () { setStatus('#dashStatus', '코드를 읽지 못했습니다: ' + r.name, 'bad'); })
      .then(function () { btn.disabled = false; });
  }
  // 목록 CSV + 사람마다 HTML 파일 하나(주소만 낸 사람은 그 주소로 넘어가는 파일)
  function buildZip(onStep) {
    var list = state.rows.slice(), files = [{ name: '제출 목록.csv', text: csvText(list) }], used = {}, done = 0, missing = [];
    function unique(name) { var n = name, k = 2; while (used[n]) n = name + ' (' + (k++) + ')'; used[n] = true; return n; }
    var chain = Promise.resolve();
    list.forEach(function (r) {
      chain = chain.then(function () {
        if (!r.hasCode) {
          if (/^https:\/\//.test(r.url)) files.push({ name: '결과물/' + unique(baseName(r) + ' (주소로 열기)') + '.html', text: linkPage(r) });
          return null;
        }
        return store.getCode(r.id).then(function (code) {
          if (code) files.push({ name: '결과물/' + unique(baseName(r)) + '.html', text: code }); else missing.push(r.name);
        }, function () { missing.push(r.name); });
      }).then(function () { done++; if (onStep) onStep(done, list.length); });
    });
    return chain.then(function () { return { blob: window.BoardZip.make(files), files: files.length, missing: missing }; });
  }

  $('#csvBtn').addEventListener('click', function () {
    save(new Blob([csvText(state.rows)], { type: 'text/csv;charset=utf-8' }), '제출 목록_' + today() + '.csv');
  });
  $('#zipBtn').addEventListener('click', function () {
    if (state.busy) return;
    state.busy = true; render();
    setStatus('#dashStatus', '결과물을 모으는 중입니다…', '');
    buildZip(function (n, total) { setStatus('#dashStatus', '결과물을 모으는 중입니다… ' + n + ' / ' + total, ''); }).then(function (z) {
      save(z.blob, '발표 결과물_' + today() + '.zip');
      setStatus('#dashStatus', '파일 ' + z.files + '개를 묶었습니다.' + (z.missing.length ? ' 읽지 못한 제출: ' + z.missing.join(', ') : ''), z.missing.length ? 'bad' : 'ok');
    }).catch(function () {
      setStatus('#dashStatus', '묶지 못했습니다. 잠시 뒤 다시 눌러 주세요.', 'bad');
    }).then(function () { state.busy = false; render(); });
  });

  // 시험할 때 쓰는 문
  window.BoardAdmin = { buildZip: buildZip, csvText: function () { return csvText(state.rows); }, state: state };
})();
