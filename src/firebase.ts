import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, setLogLevel, enableIndexedDbPersistence, collection, addDoc, serverTimestamp, doc, setDoc, getDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';

// Firestore 에러 로그만 표시 (개발 중 로그 폭주 방지)
setLogLevel('error');

// Firebase 설정
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAYOQ9Npqhf6AW6qq32rrvtw1F1q7vuUaM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "nove-research-data.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "nove-research-data",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "nove-research-data.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "777873062473",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:777873062473:web:fde24fe43e75d7d0875d98",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-9C0KKVETT2"
};

// Firebase 앱 초기화 (중복 방지)
const app = initializeApp(firebaseConfig);

// Firebase 인증 초기화
export const auth = getAuth(app);

// 로컬 저장소 지속성 설정
setPersistence(auth, browserLocalPersistence).catch(err => console.error("Persistence error:", err));

// Google 인증 제공자
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

// 브라우저 호환성을 위한 설정
googleProvider.setCustomParameters({
  prompt: 'select_account',
  access_type: 'offline'
});

// 사파리에서 팝업 문제 해결을 위한 추가 설정
if (typeof window !== 'undefined') {
  const userAgent = navigator.userAgent.toLowerCase();
  const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome') && !userAgent.includes('firefox');
  
  if (isSafari) {
    googleProvider.setCustomParameters({
      prompt: 'consent'
    });
  }
}

// Firestore 초기화 (로컬 캐시 활성화)
export const db = getFirestore(app);

// Firestore 로컬 캐시 활성화 (오프라인 지원) - 비동기로 실행
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch(err => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore: Multiple tabs open, persistence disabled');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore: Browser does not support persistence');
    }
  });
}

// Firestore helper functions
export async function saveLogToFirestore(collectionName: string, data: any) {
  try {
    const colRef = collection(db, collectionName);
    const docRef = await addDoc(colRef, { ...data, created_at: serverTimestamp() });
    return { id: docRef.id };
  } catch (e) {
    console.error('saveLogToFirestore error', e);
    throw e;
  }
}

export { collection, addDoc, serverTimestamp, doc, setDoc, getDoc, getDocs, query, where, deleteDoc };
export default app;
