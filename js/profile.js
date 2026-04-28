import { getApps, getApp, initializeApp }           from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, updateProfile }                    from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL }
                                                     from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";
import { checkUsernameAvailable, claimUsername, upsertPublicProfile }
                                                     from "./firebase-service.js";
import { firebaseConfig }                            from "./firebase-config.js";

const app     = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth    = getAuth(app);
const storage = getStorage(app);

/* ── Inject modal HTML ─────────────────────────────────── */
document.body.insertAdjacentHTML('beforeend', `
  <div id="profileOverlay" class="profile-overlay">
    <div class="profile-modal">
      <div class="profile-header">
        <h2>My Profile</h2>
        <button class="profile-close" id="profileClose" aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="profile-avatar-wrap">
        <div class="profile-avatar" id="profileAvatarDisplay">
          <i class="fa-solid fa-circle-user"></i>
        </div>
        <button class="profile-avatar-btn" id="profileAvatarBtn" title="Change photo">
          <i class="fa-solid fa-camera"></i>
        </button>
        <input type="file" id="profilePhotoInput" accept="image/*" style="display:none;">
      </div>

      <div class="profile-fields">
        <div class="profile-field">
          <label>Username</label>
          <input type="text" id="profileUsername" placeholder="Enter your username" maxlength="30" />
        </div>
        <div class="profile-field">
          <label>Email</label>
          <input type="email" id="profileEmail" disabled />
        </div>
      </div>

      <div id="profileMsg" class="profile-msg"></div>

      <div class="profile-actions">
        <button class="profile-save" id="profileSave">
          <i class="fa-solid fa-floppy-disk"></i> Save Changes
        </button>
        <button class="profile-cancel" id="profileCancel">Cancel</button>
      </div>
    </div>
  </div>
`);

/* ── Refs ──────────────────────────────────────────────── */
const overlay       = document.getElementById('profileOverlay');
const avatarDisplay = document.getElementById('profileAvatarDisplay');
const avatarBtn     = document.getElementById('profileAvatarBtn');
const photoInput    = document.getElementById('profilePhotoInput');
const usernameInput = document.getElementById('profileUsername');
const emailInput    = document.getElementById('profileEmail');
const saveBtn       = document.getElementById('profileSave');
const cancelBtn     = document.getElementById('profileCancel');
const closeBtn      = document.getElementById('profileClose');
const msgEl         = document.getElementById('profileMsg');

let pendingPhotoFile = null;

/* ── Helpers ───────────────────────────────────────────── */
function setAvatar(url) {
  if (url) {
    avatarDisplay.innerHTML = `<img src="${url}" alt="Profile photo">`;
  } else {
    avatarDisplay.innerHTML = `<i class="fa-solid fa-circle-user"></i>`;
  }
}

function showMsg(text, type = 'success') {
  msgEl.textContent  = text;
  msgEl.className    = `profile-msg ${type}`;
  if (type === 'success') setTimeout(() => { msgEl.textContent = ''; }, 3000);
}

function updateNavChip(user) {
  const label     = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
  const avatarHtml = user.photoURL
    ? `<img src="${user.photoURL}" alt="pfp" class="nav-avatar-img">`
    : `<i class="fa-solid fa-circle-user"></i>`;

  const chip = document.getElementById('navUserChip');
  if (chip) {
    chip.querySelector('.nav-user-avatar').innerHTML = avatarHtml;
    chip.querySelector('.nav-user-label').textContent = label;
  }
  const mobileChip = document.getElementById('navMobileUserChip');
  if (mobileChip) {
    const icon = user.photoURL
      ? `<img src="${user.photoURL}" alt="pfp" class="nav-avatar-img" style="width:22px;height:22px;">`
      : `<i class="fa-solid fa-circle-user"></i>`;
    mobileChip.innerHTML = `${icon} ${label}`;
  }

  sessionStorage.setItem('userName',  user.displayName || '');
  sessionStorage.setItem('userPhoto', user.photoURL    || '');
}

/* ── Open / Close ──────────────────────────────────────── */
window.__openProfile = () => {
  const user = auth.currentUser;
  if (!user) return;

  pendingPhotoFile      = null;
  usernameInput.value   = user.displayName || '';
  emailInput.value      = user.email       || '';
  msgEl.textContent     = '';
  setAvatar(user.photoURL);

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
};

function closeProfile() {
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  pendingPhotoFile = null;
}

closeBtn.addEventListener('click',  closeProfile);
cancelBtn.addEventListener('click', closeProfile);
overlay.addEventListener('click', e => { if (e.target === overlay) closeProfile(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeProfile(); });

/* ── Photo preview ─────────────────────────────────────── */
avatarBtn.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (!file) return;
  pendingPhotoFile = file;
  setAvatar(URL.createObjectURL(file));
});

/* ── Save ──────────────────────────────────────────────── */
saveBtn.addEventListener('click', async () => {
  const user        = auth.currentUser;
  const newUsername = usernameInput.value.trim();
  const oldUsername = user.displayName || '';
  if (!user) return;

  if (!newUsername) { showMsg('Username is required.', 'error'); return; }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(newUsername)) {
    showMsg('3–20 characters: letters, numbers, underscores only.', 'error');
    return;
  }

  saveBtn.disabled   = true;
  saveBtn.innerHTML  = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  msgEl.textContent  = '';

  try {
    // Check username availability if changed
    if (newUsername.toLowerCase() !== oldUsername.toLowerCase()) {
      const available = await checkUsernameAvailable(newUsername);
      if (!available) {
        showMsg('Username is already taken.', 'error');
        return;
      }
    }

    let photoURL = user.photoURL || '';
    if (pendingPhotoFile) {
      const storageRef = ref(storage, `profiles/${user.uid}/avatar`);
      await uploadBytes(storageRef, pendingPhotoFile);
      photoURL = await getDownloadURL(storageRef);
    }

    await updateProfile(user, {
      displayName: newUsername,
      photoURL:    photoURL || null,
    });

    // Claim username slot and sync public profile
    await claimUsername(newUsername, oldUsername);
    await upsertPublicProfile(user);

    updateNavChip(user);
    showMsg('Profile updated!', 'success');
    pendingPhotoFile = null;
  } catch (err) {
    showMsg(err.message || 'Failed to save.', 'error');
  } finally {
    saveBtn.disabled  = false;
    saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
  }
});
