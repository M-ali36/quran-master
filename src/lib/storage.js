// src/lib/storage.js
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const GUEST_STORAGE_KEY = "guest_app_data";

export const storage = {
  getGuestData() {
    if (typeof window === "undefined") return { appData: {} };
    try {
      const stored = localStorage.getItem(GUEST_STORAGE_KEY);
      return stored ? JSON.parse(stored) : { appData: {} };
    } catch {
      return { appData: {} };
    }
  },

  setGuestData(data) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("Local storage error:", err);
    }
  },

  async getUserDoc(user) {
    if (!user || !user.uid) return null;
    const userRef = doc(db, "users", user.uid);

    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        return snap.data();
      }

      const initialDoc = {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        appData: {},
      };

      await setDoc(userRef, initialDoc, { merge: true });
      return initialDoc;
    } catch (err) {
      console.error("Firestore getUserDoc error:", err);
      return null;
    }
  },

  async saveUserAppData(uid, appData) {
    if (!uid) return;
    const userRef = doc(db, "users", uid);

    try {
      await setDoc(
        userRef,
        {
          uid,
          appData,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Firestore saveUserAppData error:", err);
      throw err;
    }
  },

  async syncGuestDataToUser(uid) {
    if (!uid) return;
    const guestData = this.getGuestData();
    if (guestData?.appData && Object.keys(guestData.appData).length > 0) {
      try {
        await this.saveUserAppData(uid, guestData.appData);
        if (typeof window !== "undefined") {
          localStorage.removeItem(GUEST_STORAGE_KEY);
        }
      } catch (err) {
        console.error("Failed to sync guest data:", err);
      }
    }
  },
};