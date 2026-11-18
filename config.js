/*
 * 공유보드 설정 파일 — 이 파일만 고치면 됩니다.
 *
 * firebase 값이 비어 있으면 '데모 모드'로 열립니다.
 * (예시 카드가 보이고, 올린 내용은 이 브라우저에만 저장됩니다.)
 * 값을 채우는 방법은 '설정 방법.md'에 있습니다.
 *
 * 여기 적는 Firebase 값은 공개되어도 되는 값입니다.
 * 누가 무엇을 쓸 수 있는지는 firestore.rules(보안 규칙)가 정합니다.
 */
window.BOARD_CONFIG = {
  classInfo: {
    school: '한양대학교 ERICA',
    course: '피지컬AI로봇 실습2 · 특강 1',
    lecture: '프로젝트 발표자료 제작 특강',
    date: '2026. 11. 24.',
    boardTitle: ['공유보드']   // 첫 화면의 큰 제목. 두 줄로 하려면 ['첫 줄', '둘째 줄']
  },

  // 머리글에 보일 링크. 비워 두면 보이지 않습니다.
  links: {
    guideUrl: 'guide.html',   // 실습 안내서 주소 — 같은 저장소에 함께 올리는 guide.html. 다른 곳에 올렸으면 그 주소로 바꿉니다
    materialsUrl: 'https://drive.google.com/drive/folders/14GFGXmkmHGRQjvshUpT2kzQS2-O7Q7mW?usp=sharing'   // 실습 자료(Drive 폴더) 주소
  },

  // Firebase 콘솔 → 프로젝트 설정 → 내 앱 → 웹 앱의 firebaseConfig 값을 그대로 붙여 넣습니다.
  firebase: {
    apiKey: 'AIzaSyCquBg1b4axeuD5YiE4fMF0_VPRdFu9LO4',
    authDomain: 'hanyang-317e6.firebaseapp.com',
    projectId: 'hanyang-317e6',
    storageBucket: 'hanyang-317e6.firebasestorage.app',
    messagingSenderId: '1090404704476',
    appId: '1:1090404704476:web:fc81fb8596b91835e21419'
  },
  firebaseSdkVersion: '13.4.0',

  // 내 발표 올리기
  submit: {
    askStudentId: true   // true면 학번 칸이 보입니다. 학번은 보드에 보이지 않고, 담당자용 대시보드(admin.html)에서만 보입니다.
  },

  // 실습 메일 보내기(Apps Script 웹 앱)
  mail: {
    url: 'https://script.google.com/macros/s/AKfycbzvSc1LROE4W8jEZZ8XxAdl9pRZAr2nb5U9FeTh0t4d_PiYFdPdMZWeVKY5h20Lzy3b/exec',   // 배포한 웹 앱 주소(…/exec). 비워 두면 '아직 연결되지 않음'으로 보입니다.
    askClassCode: true    // true면 수업 코드 입력 칸이 보입니다(Apps Script에 CLASS_CODE를 넣었을 때).
  }
};
