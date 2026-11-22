import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const GUEST_KEY = "guest_app_data";

export const storage = {
  // Read local guest data
  getGuestData: () => {
    if (typeof window === "undefined") return null;
    try {
      const data = localStorage.getItem(GUEST_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  // Save local guest data
  setGuestData: (data) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(GUEST_KEY, JSON.stringify(data));
  },

  // Clear guest data
  clearGuestData: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(GUEST_KEY);
  },

  // Create or retrieve user document by UID
  getUserDoc: async (user) => {
    if (!user?.uid) return null;
    const docRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      return snapshot.data();
    }

    // Initialize document with Google profile details if new user
    const guestData = storage.getGuestData() || {};
    const initialUserData = {
      uid: user.uid,
      displayName: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
      appData: guestData.appData || {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, initialUserData, { merge: true });
    storage.clearGuestData();
    return initialUserData;
  },

  // Update appData under the user's UID document
  saveUserAppData: async (uid, appData) => {
    if (!uid) return;
    try {
      const docRef = doc(db, "users", uid);
      await setDoc(
        docRef,
        {
          appData,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Firestore write error:", err);
    }
  },

  // Migrate guest data to existing profile upon sign-in
  syncGuestDataToUser: async (uid) => {
    const guestData = storage.getGuestData();
    if (!guestData || !guestData.appData) return;

    try {
      const docRef = doc(db, "users", uid);
      await setDoc(
        docRef,
        {
          appData: guestData.appData,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      storage.clearGuestData();
    } catch (err) {
      console.error("Guest migration error:", err);
    }
  },
};