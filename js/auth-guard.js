import { initializeApp, getApps, getApp }    from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { firebaseConfig }                        from "./firebase-config.js";

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace('login.html');
  } else {
    sessionStorage.setItem('userEmail', user.email);
    // Expose signOut globally so nav.js (non-module) can call it
    window.__authSignOut = () => signOut(auth).then(() => {
      sessionStorage.removeItem('userEmail');
      window.location.href = 'login.html';
    });
  }
});
