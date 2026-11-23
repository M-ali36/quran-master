"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
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

const DEFAULT_APP_DATA = {
  playerType: "default",
  currentSura: 1,
  currentAya: 1,
  repeatLimit: 1,
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [appData, setAppData] = useState(DEFAULT_APP_DATA);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      try {
        if (currentUser) {
          await storage.syncGuestDataToUser(currentUser.uid);
          const profile = await storage.getUserDoc(currentUser);
          setUserProfile(profile);
          setAppData((prev) => ({
            ...DEFAULT_APP_DATA,
            ...prev,
            ...(profile?.appData || {}),
          }));
        } else {
          setUserProfile(null);
          const local = storage.getGuestData();
          setAppData((prev) => ({
            ...DEFAULT_APP_DATA,
            ...prev,
            ...(local?.appData || {}),
          }));
        }
      } catch (err) {
        console.error("Auth state synchronization error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Update appData: merges previous state and persists immediately without race conditions
  const updateAppData = useCallback(
    async (partialData) => {
      let mergedData = {};

      setAppData((prev) => {
        mergedData = {
          ...DEFAULT_APP_DATA,
          ...prev,
          ...partialData,
        };
        return mergedData;
      });

      try {
        if (user?.uid) {
          await storage.saveUserAppData(user.uid, mergedData);
        } else {
          storage.setGuestData({ appData: mergedData });
        }
      } catch (err) {
        console.error("Failed to persist appData:", err);
      }
    },
    [user?.uid]
  );

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    if (result?.user) {
      await storage.syncGuestDataToUser(result.user.uid);
      const profile = await storage.getUserDoc(result.user);
      setUserProfile(profile);
      setAppData((prev) => ({
        ...DEFAULT_APP_DATA,
        ...prev,
        ...(profile?.appData || {}),
      }));
    }
    return result;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
    const local = storage.getGuestData();
    setAppData({
      ...DEFAULT_APP_DATA,
      ...(local?.appData || {}),
    });
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