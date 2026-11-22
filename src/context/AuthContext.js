"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { storage } from "@/lib/storage";

const AuthContext = createContext({});
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [appData, setAppData] = useState({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        await storage.syncGuestDataToUser(currentUser.uid);
        const profile = await storage.getUserDoc(currentUser);
        setUserProfile(profile);
        setAppData(profile?.appData || {});
      } else {
        setUserProfile(null);
        const local = storage.getGuestData();
        setAppData(local?.appData || {});
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Update appData: synced with Firestore if user is logged in, else localStorage
  const updateAppData = async (newAppData) => {
    setAppData(newAppData);
    if (user?.uid) {
      await storage.saveUserAppData(user.uid, newAppData);
    } else {
      storage.setGuestData({ appData: newAppData });
    }
  };

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    if (result?.user) {
      await storage.syncGuestDataToUser(result.user.uid);
      const profile = await storage.getUserDoc(result.user);
      setUserProfile(profile);
      setAppData(profile?.appData || {});
    }
    return result;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
    const local = storage.getGuestData();
    setAppData(local?.appData || {});
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        appData,
        updateAppData,
        signInWithGoogle,
        logout,
        loading,
        isGuest: !user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);