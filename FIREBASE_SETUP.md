# Firebase 설정 가이드

## ❗ API 키 오류 해결

`auth/api-key-not-valid` 오류가 발생하면 다음 단계를 따라주세요.

## 1. Firebase Console에서 올바른 API 키 가져오기

### 방법 1: Firebase Console에서 직접 확인

1. **Firebase Console 접속**
   - https://console.firebase.google.com/ 접속
   - `nove-research-data` 프로젝트 선택

2. **프로젝트 설정 열기**
   - 좌측 상단 톱니바퀴 아이콘 ⚙️ 클릭
   - "프로젝트 설정" 선택

3. **일반 탭에서 API 키 확인**
   - "일반" 탭 선택
   - "내 앱" 섹션에서 웹앱 확인
   - `apiKey` 값 복사

### 방법 2: 새 웹앱 추가 (앱이 없는 경우)

1. Firebase Console > 프로젝트 설정 > 일반 탭
2. "내 앱" 섹션에서 **웹 앱 추가** (</> 아이콘) 클릭
3. 앱 닉네임 입력 (예: "Nova Assignment Planner")
4. **앱 등록** 클릭
5. 표시된 Firebase 설정 코드 복사

## 2. .env 파일 수정

프로젝트 루트의 `.env` 파일을 열고 `VITE_FIREBASE_API_KEY` 값을 업데이트:

```env
VITE_FIREBASE_API_KEY=실제_API_키_여기에_붙여넣기
VITE_FIREBASE_AUTH_DOMAIN=nove-research-data.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=nove-research-data
VITE_FIREBASE_STORAGE_BUCKET=nove-research-data.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=976820775452
VITE_FIREBASE_APP_ID=실제_APP_ID_여기에_붙여넣기
```

## 3. Google 로그인 활성화

1. **Firebase Console > Authentication**
   - 좌측 메뉴에서 "Authentication" 클릭
   - "Sign-in method" 탭 선택

2. **Google 제공업체 활성화**
   - 제공업체 목록에서 "Google" 찾기
   - 연필 아이콘 클릭하여 편집
   - "사용 설정" 토글 ON
   - 프로젝트 지원 이메일 선택
   - **저장** 클릭

## 4. 승인된 도메인 추가

Firebase Console > Authentication > Settings > Authorized domains

다음 도메인들이 목록에 있는지 확인:
- `localhost`
- `127.0.0.1`
- `gimgyumin.github.io` (GitHub Pages 배포용)

없으면 "도메인 추가" 버튼으로 추가

## 5. Firestore 데이터베이스 생성

1. **Firebase Console > Firestore Database**
   - 좌측 메뉴에서 "Firestore Database" 클릭
   - "데이터베이스 만들기" 버튼 클릭

2. **보안 규칙 선택**
   - "프로덕션 모드에서 시작" 선택
   - "다음" 클릭

3. **위치 선택**
   - `asia-northeast3 (Seoul)` 선택 (한국 서버)
   - "사용 설정" 클릭

4. **보안 규칙 설정**
   - Firestore Database > 규칙 탭
   - 다음 규칙 추가:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 인증된 모든 사용자에게 데이터 접근 허용
    // (실제 협업자 검증은 클라이언트에서 수행)
    match /users/{userId}/{document=**} {
      allow read, write, delete: if request.auth != null;
    }
    
    // 공유 폴더 관련 데이터
    match /sharedFolders/{folderId} {
      allow read, write, delete: if request.auth != null;
    }
    
    // 실시간 협업 데이터 (presence, editing states)
    match /folderPresence/{folderId}/users/{userId} {
      allow read, write, delete: if request.auth != null;
    }
    
    match /folderEditing/{documentId} {
      allow read, write, delete: if request.auth != null;
    }
  }
}
```

   또는 Firebase CLI로 배포:
   ```bash
   # Firebase CLI 설치 (한 번만)
   npm install -g firebase-tools
   
   # Firebase 로그인
   firebase login
   
   # 프로젝트 초기화 (이미 되어 있다면 생략)
   firebase init firestore
   
   # 규칙 배포
   firebase deploy --only firestore:rules
   ```

5. **게시** 버튼 클릭

## 6. 개발 서버 재시작

```bash
# 개발 서버 중지 (Ctrl+C)
# 그리고 다시 시작
npm run dev
```

## 7. 테스트

1. 브라우저 새로고침 (Cmd+Shift+R / Ctrl+Shift+R)
2. 설정 > 일반 > Google로 로그인 클릭
3. Google 계정 선택하여 로그인
4. "로그인 성공!" 메시지 확인

## 문제 해결

### 여전히 API 키 오류가 발생하는 경우

1. **.env 파일 확인**
   - 파일이 프로젝트 루트에 있는지 확인
   - API 키에 공백이나 따옴표가 없는지 확인

2. **개발 서버 완전히 재시작**
   - 터미널에서 Ctrl+C로 중지
   - `npm run dev` 다시 실행

3. **브라우저 캐시 삭제**
   - Cmd+Shift+Delete (Mac) / Ctrl+Shift+Delete (Windows)
   - "전체 기간" 선택
   - "캐시된 이미지 및 파일" 체크
   - "데이터 삭제" 클릭

### 다른 오류들

- **`auth/popup-blocked`**: 브라우저 설정에서 팝업 차단 해제
- **`auth/unauthorized-domain`**: Firebase Console > Authentication > Settings > Authorized domains에 현재 도메인 추가
- **`auth/operation-not-allowed`**: Firebase Console에서 Google 로그인 활성화 확인

## 완료!

이제 Google 로그인으로 과제를 클라우드에 저장하고 여러 기기에서 동기화할 수 있습니다! 🎉
