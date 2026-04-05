// ── Cloud Sync (Firebase) ──
// Handles Google Auth, Email/Password Auth, and Firestore read/write.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, browserLocalPersistence, setPersistence,
  sendEmailVerification, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { FIREBASE_CONFIG } from './firebase-config.js';

const SECTION_MAP = {
  plans:      'trainer_plans',
  bodyweight: 'trainer_bw',
  meals:      'trainer_meals',
  prs:        'trainer_prs',
  macrogoals: 'trainer_macro_goals',
  customings: 'trainer_custom_ings',
};

let db, auth;
let _uid = null;
let _userEmail = null;

export function initFirebase() {
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
  // Keep user logged in forever across browser sessions
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export function getUid() { return _uid; }
export function getUserEmail() { return _userEmail; }

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

export async function registerWithEmail(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await sendEmailVerification(cred.user);
  await signOut(auth); // force sign-out until email is verified
}

export async function sendForgotPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function signInWithEmail(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  await signOut(auth);
  _uid = null;
  _userEmail = null;
}

export function onAuthChange(callback) {
  onAuthStateChanged(auth, user => {
    _uid = user ? user.uid : null;
    _userEmail = user ? user.email : null;
    callback(user);
  });
}

export async function loadFromCloud(uid) {
  await Promise.all(
    Object.entries(SECTION_MAP).map(async ([section, lsKey]) => {
      try {
        const snap = await getDoc(doc(db, 'users', uid, 'sections', section));
        if (snap.exists()) localStorage.setItem(lsKey, snap.data().value);
      } catch (e) {}
    })
  );
  try {
    const snaps = await getDocs(collection(db, 'users', uid, 'exhist'));
    snaps.forEach(d => {
      localStorage.setItem('trainer_exhist_' + decodeURIComponent(d.id), d.data().value);
    });
  } catch (e) {}
  try {
    const snaps = await getDocs(collection(db, 'users', uid, 'notes'));
    snaps.forEach(d => {
      localStorage.setItem('trainer_notes_' + decodeURIComponent(d.id), d.data().value);
    });
  } catch (e) {}
}

export function cloudSave(section, docId, value) {
  if (!_uid || !db) return;
  setDoc(doc(db, 'users', _uid, section, docId), { value }).catch(() => {});
}
