import { initializeApp }                                       from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc,
         doc, orderBy, query, serverTimestamp, deleteDoc,
         getDoc }                                              from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL,
         deleteObject }                                        from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";
import { firebaseConfig }                                       from "./firebase-config.js";

const app     = initializeApp(firebaseConfig);
const db      = getFirestore(app);
const storage = getStorage(app);

/* ── helpers ─────────────────────────────────────────── */

function randomFilename(ext) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${rand}_${Date.now()}.${ext}`;
}

function extFrom(file) {
  return file.name.split('.').pop().toLowerCase() || 'jpg';
}

async function uploadImage(folder, file) {
  const filename  = randomFilename(extFrom(file));
  const storageRef = ref(storage, `${folder}/${filename}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/* ── wishlist ─────────────────────────────────────────── */

export async function getWishlist({ q = "", type = "", status = "" } = {}) {
  const q_lower    = q.trim().toLowerCase();
  const type_lower = type.toLowerCase();
  const stat_lower = status.toLowerCase();

  const snap  = await getDocs(query(collection(db, "wishlist"), orderBy("created_at", "desc")));
  let items   = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (q_lower)    items = items.filter(i =>
    (i.title  || "").toLowerCase().includes(q_lower) ||
    (i.genre  || "").toLowerCase().includes(q_lower)
  );
  if (type_lower) items = items.filter(i => (i.type   || "") === type_lower);
  if (stat_lower) items = items.filter(i => (i.status || "") === stat_lower);

  return items;
}

export async function addWishlistItem(fields, coverFile) {
  const cover_path = await uploadImage("covers", coverFile);
  const docRef = await addDoc(collection(db, "wishlist"), {
    title:          fields.title          || "",
    type:           fields.type           || "",
    genre:          fields.genre          || "",
    status:         fields.status         || "reading",
    site_url:       fields.site_url       || "",
    cover_path,
    preview_url:    fields.preview_url    || "",
    preview_source: fields.preview_source || "",
    last_chapter:   "",
    sources:        fields.sources        || [],
    created_at:     serverTimestamp()
  });
  return { id: docRef.id, cover_path };
}

export async function updateWishlistItem(docId, { status, last_chapter }) {
  await updateDoc(doc(db, "wishlist", docId), { status, last_chapter });
}

/* ── platforms ────────────────────────────────────────── */

export async function getPlatforms(type) {
  const snap  = await getDocs(query(collection(db, "platforms"), orderBy("created_at", "desc")));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => p.type === type);
}

/* ── delete + get + updateFull ───────────────────────────── */

function storagePathFromUrl(url) {
  // Extract storage path from Firebase download URL
  return decodeURIComponent(url.split('/o/')[1].split('?')[0]);
}

async function tryDeleteStorageFile(url) {
  if (!url) return;
  try {
    await deleteObject(ref(storage, storagePathFromUrl(url)));
  } catch (_) { /* file may already be gone — ignore */ }
}

export async function deleteWishlistItem(docId) {
  const snap = await getDoc(doc(db, "wishlist", docId));
  if (snap.exists()) await tryDeleteStorageFile(snap.data().cover_path);
  await deleteDoc(doc(db, "wishlist", docId));
}

export async function deletePlatform(docId) {
  const snap = await getDoc(doc(db, "platforms", docId));
  if (snap.exists()) await tryDeleteStorageFile(snap.data().icon_path);
  await deleteDoc(doc(db, "platforms", docId));
}

export async function getWishlistItem(docId) {
  const snap = await getDoc(doc(db, "wishlist", docId));
  if (!snap.exists()) throw new Error("Item not found");
  return { id: snap.id, ...snap.data() };
}

export async function updateFullWishlistItem(docId, fields, newCoverFile = null) {
  const payload = { ...fields };
  if (newCoverFile) {
    const old = await getDoc(doc(db, "wishlist", docId));
    if (old.exists()) await tryDeleteStorageFile(old.data().cover_path);
    payload.cover_path = await uploadImage("covers", newCoverFile);
  }
  await updateDoc(doc(db, "wishlist", docId), payload);
}

export async function updatePlatform(docId, fields, newIconFile = null) {
  const payload = { ...fields };
  if (newIconFile) {
    const old = await getDoc(doc(db, "platforms", docId));
    if (old.exists()) await tryDeleteStorageFile(old.data().icon_path);
    payload.icon_path = await uploadImage("icons", newIconFile);
  }
  await updateDoc(doc(db, "platforms", docId), payload);
}

export async function recordPlatformVisit(docId) {
  const ref  = doc(db, "platforms", docId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, {
      visit_count:  (snap.data().visit_count || 0) + 1,
      last_visited: serverTimestamp()
    });
  }
}

/* Adds a wishlist item using an external cover URL (no file upload needed) */
export async function addWishlistItemFromUrl(fields, coverUrl) {
  await addDoc(collection(db, "wishlist"), {
    title:          fields.title          || "",
    type:           fields.type           || "",
    genre:          fields.genre          || "",
    status:         fields.status         || "ongoing",
    site_url:       fields.site_url       || "",
    cover_path:     coverUrl              || "",
    preview_url:    fields.preview_url    || "",
    preview_source: fields.preview_source || "",
    last_chapter:   "",
    sources:        fields.sources        || [],
    created_at:     serverTimestamp()
  });
}

export async function addPlatform(fields, iconFile) {
  const icon_path = await uploadImage("icons", iconFile);
  const docRef = await addDoc(collection(db, "platforms"), {
    type:        fields.type     || "streaming",
    name:        fields.name     || "",
    url:         fields.url      || "",
    language:    fields.language || "en",
    notes:       fields.notes    || "",
    tags:        fields.tags     || [],
    visit_count: 0,
    last_visited: null,
    icon_path,
    created_at:  serverTimestamp()
  });
  return { id: docRef.id, icon_path };
}
