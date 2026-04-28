import { initializeApp, getApps, getApp }       from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut }  from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp }
                                                 from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig }                        from "./firebase-config.js";

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace('login.html');
  } else {
    sessionStorage.setItem('userEmail',  user.email        || '');
    sessionStorage.setItem('userName',   user.displayName  || '');
    sessionStorage.setItem('userPhoto',  user.photoURL     || '');

    window.__authUser     = user;
    window.__authInstance = auth;

    window.__authSignOut = () => signOut(auth).then(() => {
      sessionStorage.clear();
      window.location.href = 'login.html';
    });

    // Sync public profile so others can discover this user
    setDoc(doc(db, "profiles", user.uid), {
      uid:       user.uid,
      email:     user.email     || '',
      username:  user.displayName || '',
      photoURL:  user.photoURL  || '',
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(() => {});

    // Load profile modal module
    import('./profile.js').catch(() => {});
  }
});
