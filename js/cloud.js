// ── Cloud Sync (Firebase) ──
// Handles Google Auth and Firestore read/write.
// Architecture: localStorage is the working copy; Firestore is the backup.
// On sign-in: pull all Firestore data into localStorage, then start the app.
// On every save: write to localStorage first (instant), then Firestore (background).

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { FIREBASE_CONFIG } from './firebase-config.js';

// Maps Firestore section doc IDs → localStorage keys
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
}

export function getUid() { return _uid; }
export function getUserEmail() { return _userEmail; }

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

export async function signOutUser() {
  await signOut(auth);
  _uid = null;
  _userEmail = null;
}

/** Call this once on app startup. Fires callback(user) when auth state is known. */
export function onAuthChange(callback) {
  onAuthStateChanged(auth, user => {
    _uid = user ? user.uid : null;
    _userEmail = user ? user.email : null;
    callback(user);
  });
}

/** Pull all Firestore data into localStorage. Called once after sign-in. */
export async function loadFromCloud(uid) {
  // Sections (plans, meals, prs, etc.)
  await Promise.all(
    Object.entries(SECTION_MAP).map(async ([section, lsKey]) => {
      try {
        const snap = await getDoc(doc(db, 'users', uid, 'sections', section));
        if (snap.exists()) localStorage.setItem(lsKey, snap.data().value);
      } catch (e) { /* network error — keep existing localStorage */ }
    })
  );

  // Exercise history (one Firestore doc per exercise)
  try {
    const snaps = await getDocs(collection(db, 'users', uid, 'exhist'));
    snaps.forEach(d => {
      localStorage.setItem('trainer_exhist_' + decodeURIComponent(d.id), d.data().value);
    });
  } catch (e) {}

  // Exercise notes (one Firestore doc per exercise)
  try {
    const snaps = await getDocs(collection(db, 'users', uid, 'notes'));
    snaps.forEach(d => {
      localStorage.setItem('trainer_notes_' + decodeURIComponent(d.id), d.data().value);
    });
  } catch (e) {}
}

/**
 * Save a value to Firestore in the background.
 * section: 'sections' | 'exhist' | 'notes'
 * docId:   section name (e.g. 'plans') or encodeURIComponent(exerciseName)
 * value:   string to store
 */
export function cloudSave(section, docId, value) {
  if (!_uid || !db) return;
  setDoc(doc(db, 'users', _uid, section, docId), { value }).catch(() => {});
}
