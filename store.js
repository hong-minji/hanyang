/*
 * 데이터를 읽고 쓰는 부분.
 *  - Firebase 설정이 있으면 Firestore(실시간 데이터베이스)에 저장합니다.
 *  - 없으면 '데모 모드': 예시 카드 + 이 브라우저의 localStorage 에만 저장합니다.
 * 화면(app.js, view.html)은 어느 쪽인지 몰라도 되도록 같은 함수 이름을 씁니다.
 */
(function (g) {
  'use strict';

  var CFG = g.BOARD_CONFIG || {};
  var FB = CFG.firebase || {};
  var configured = !!(FB.apiKey && FB.projectId);

  /* ---------- 데모 모드 ---------- */
  function LocalStore() {
    var KEY = 'board.demo.v1';
    var samples = g.BOARD_SAMPLES || { decks: [], codes: {} };
    var listeners = [];
    var self = this;

    function load() {
      try {
        var s = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (s && s.uid && Array.isArray(s.decks)) return s;
      } catch (e) { /* 저장소를 못 쓰는 환경이면 메모리만 쓴다 */ }
      return { uid: 'me-' + Math.random().toString(36).slice(2, 10), decks: [], codes: {}, sids: {} };
    }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
    }
    var data = load();
    if (!data.sids) data.sids = {};
    save();

    function all() { return samples.decks.concat(data.decks); }
    function emit() { var list = all(); listeners.forEach(function (cb) { cb(list); }); }

    this.mode = 'demo';
    this.uid = data.uid;
    this.ready = function () { return Promise.resolve({ uid: self.uid }); };
    this.onDecks = function (cb) { listeners.push(cb); cb(all()); };
    this.onBoard = function (cb) { cb({ open: true, missing: false }); };
    this.onError = function () {};
    this.getDeck = function (id) {
      var d = all().filter(function (x) { return x.id === id; })[0];
      return Promise.resolve(d || null);
    };
    this.getCode = function (id) {
      return Promise.resolve(samples.codes[id] || data.codes[id] || null);
    };
    this.getPrivate = function (id) {
      var sid = data.sids[id] || (samples.sids && samples.sids[id]) || '';
      return Promise.resolve(sid ? { studentId: sid } : null);
    };
    this.claimAdmin = function () { return Promise.resolve(true); };   // 데모 모드에서는 어떤 코드든 통과
    this.add = function (fields, code, priv) {
      var id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      var t = Date.now();
      data.decks.push({ id: id, name: fields.name, title: fields.title, url: fields.url, note: fields.note, hasCode: !!code, uid: self.uid, createdAt: t, updatedAt: t });
      if (code) data.codes[id] = code;
      if (priv && priv.studentId) data.sids[id] = priv.studentId;
      if (!save()) { data.decks.pop(); delete data.codes[id]; delete data.sids[id]; return Promise.reject(new Error('storage')); }
      emit();
      return Promise.resolve(id);
    };
    this.update = function (id, fields, code, hadCode, priv) {
      var d = data.decks.filter(function (x) { return x.id === id; })[0];
      if (!d) return Promise.reject(new Error('permission-denied'));
      d.name = fields.name; d.title = fields.title; d.url = fields.url; d.note = fields.note;
      d.hasCode = !!code; d.updatedAt = Date.now();
      if (code) data.codes[id] = code; else delete data.codes[id];
      if (priv) { if (priv.studentId) data.sids[id] = priv.studentId; else delete data.sids[id]; }
      if (!save()) return Promise.reject(new Error('storage'));
      emit();
      return Promise.resolve(id);
    };
    this.remove = function (id) {
      var before = data.decks.length;
      data.decks = data.decks.filter(function (x) { return x.id !== id; });
      if (data.decks.length === before) return Promise.reject(new Error('permission-denied'));
      delete data.codes[id]; delete data.sids[id];
      save(); emit();
      return Promise.resolve();
    };

    // 다른 탭에서 올린 것도 바로 보이게 한다.
    g.addEventListener('storage', function (e) {
      if (e.key === KEY) { data = load(); emit(); }
    });
  }

  /* ---------- Firebase(Firestore + 익명 로그인) ---------- */
  function FirebaseStore() {
    var SDK = 'https://www.gstatic.com/firebasejs/' + (CFG.firebaseSdkVersion || '13.4.0') + '/';
    var self = this;
    var errorCb = function () {};
    var F = null, db = null;

    this.mode = 'live';
    this.uid = null;
    this.onError = function (cb) { errorCb = cb; };

    var loaded = Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-firestore.js'),
      import(SDK + 'firebase-auth.js')
    ]).then(function (m) {
      var app = m[0].initializeApp(FB);
      F = m[1]; db = F.getFirestore(app);
      return { app: app, A: m[2] };
    });
    loaded.catch(function (e) { errorCb('sdk', e); });

    // 읽기는 로그인 없이도 되므로, 로그인은 따로 진행한다(쓰기에만 필요).
    var signedIn = loaded.then(function (x) {
      var auth = x.A.getAuth(x.app);
      return x.A.signInAnonymously(auth).then(function (cred) {
        self.uid = cred.user.uid;
        return { uid: self.uid };
      });
    });
    signedIn.catch(function (e) { errorCb('auth', e); });

    this.ready = function () { return signedIn; };

    function ms(v) { return v && typeof v.toMillis === 'function' ? v.toMillis() : Date.now(); }
    function shape(snap) {
      var d = snap.data({ serverTimestamps: 'estimate' });
      return {
        id: snap.id, name: String(d.name || ''), title: String(d.title || ''), url: String(d.url || ''), note: String(d.note || ''),
        hasCode: d.hasCode === true, uid: d.uid || '', createdAt: ms(d.createdAt), updatedAt: ms(d.updatedAt)
      };
    }

    this.onDecks = function (cb) {
      loaded.then(function () {
        var q = F.query(F.collection(db, 'decks'), F.orderBy('createdAt', 'desc'));
        F.onSnapshot(q, function (snap) { cb(snap.docs.map(shape)); }, function (e) { errorCb('read', e); });
      }, function () {});
    };
    this.onBoard = function (cb) {
      loaded.then(function () {
        F.onSnapshot(F.doc(db, 'meta', 'board'), function (snap) {
          cb({ open: snap.exists() && snap.data().open === true, missing: !snap.exists() });
        }, function (e) { errorCb('read', e); });
      }, function () {});
    };
    this.getDeck = function (id) {
      return loaded.then(function () { return F.getDoc(F.doc(db, 'decks', id)); })
        .then(function (snap) { return snap.exists() ? shape(snap) : null; });
    };
    this.getCode = function (id) {
      return loaded.then(function () { return F.getDoc(F.doc(db, 'decks', id, 'code', 'main')); })
        .then(function (snap) { return snap.exists() ? String(snap.data().html || '') : null; });
    };
    // 학번처럼 보드에 보이면 안 되는 값은 decks/{id}/private/main 에 따로 둔다(올린 사람과 관리자만 읽는다).
    this.getPrivate = function (id) {
      return signedIn.then(function () { return F.getDoc(F.doc(db, 'decks', id, 'private', 'main')); })
        .then(function (snap) { return snap.exists() ? { studentId: String(snap.data().studentId || '') } : null; });
    };
    // 관리 코드를 내 번호표에 적어 두면, 보안 규칙이 secret/admin 의 값과 견주어 관리자인지 정한다.
    this.claimAdmin = function (code) {
      return signedIn.then(function () {
        return F.setDoc(F.doc(db, 'claims', self.uid), { key: String(code || ''), updatedAt: F.serverTimestamp() });
      }).then(function () {
        return F.getDoc(F.doc(db, 'adminCheck', 'ping'));
      }).then(function () { return true; }, function (e) {
        if (e && /permission-denied/.test(String(e.code || e.message))) throw new Error('bad-code');
        throw e;
      });
    };
    this.add = function (fields, code, priv) {
      return signedIn.then(function () {
        var ref = F.doc(F.collection(db, 'decks'));
        var batch = F.writeBatch(db);
        batch.set(ref, {
          name: fields.name, title: fields.title, url: fields.url, note: fields.note, hasCode: !!code,
          uid: self.uid, createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp()
        });
        if (code) batch.set(F.doc(db, 'decks', ref.id, 'code', 'main'), { html: code, uid: self.uid, updatedAt: F.serverTimestamp() });
        if (priv && priv.studentId) batch.set(F.doc(db, 'decks', ref.id, 'private', 'main'), { studentId: priv.studentId, uid: self.uid, updatedAt: F.serverTimestamp() });
        return batch.commit().then(function () { return ref.id; });
      });
    };
    this.update = function (id, fields, code, hadCode, priv) {
      return signedIn.then(function () {
        var batch = F.writeBatch(db);
        batch.update(F.doc(db, 'decks', id), {
          name: fields.name, title: fields.title, url: fields.url, note: fields.note, hasCode: !!code, updatedAt: F.serverTimestamp()
        });
        var codeRef = F.doc(db, 'decks', id, 'code', 'main');
        if (code) batch.set(codeRef, { html: code, uid: self.uid, updatedAt: F.serverTimestamp() });
        else if (hadCode) batch.delete(codeRef);
        if (priv && priv.studentId) batch.set(F.doc(db, 'decks', id, 'private', 'main'), { studentId: priv.studentId, uid: self.uid, updatedAt: F.serverTimestamp() });
        return batch.commit().then(function () { return id; });
      });
    };
    this.remove = function (id) {
      return signedIn.then(function () {
        var batch = F.writeBatch(db);
        batch.delete(F.doc(db, 'decks', id, 'code', 'main'));
        batch.delete(F.doc(db, 'decks', id, 'private', 'main'));
        batch.delete(F.doc(db, 'decks', id));
        return batch.commit();
      });
    };
  }

  g.BoardStore = {
    configured: configured,
    create: function () { return configured ? new FirebaseStore() : new LocalStore(); }
  };
})(window);
