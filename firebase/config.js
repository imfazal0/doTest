import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCg6emivXDruZjKuqsA912XfH1ZyH5-poo",
  authDomain: "dotest-80528.firebaseapp.com",
  projectId: "dotest-80528",
  storageBucket: "dotest-80528.firebasestorage.app",
  messagingSenderId: "1029831205166",
  appId: "1:1029831205166:web:a70f19e2645ff5c1d6dabf",
  measurementId: "G-97SRWS0LLF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged };