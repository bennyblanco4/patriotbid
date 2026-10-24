"use client";
import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase web config is public by design; access is controlled by the
// authorized domains list in the Firebase console, not by hiding these.
// The env vars only exist to point local runs at a different project.
// On the live site the sign-in handler is proxied through bidprospect.com
// (see next.config.ts) so Google shows our domain, not firebaseapp.com.
const live = typeof window !== "undefined" && window.location.hostname === "bidprospect.com";
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAgjqeUVsiSTGDpxA88L_hwcjZX2b5qqjw",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    (live ? "bidprospect.com" : "bidprospect-app.firebaseapp.com"),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "bidprospect-app",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:250049393689:web:03319c82b0e9ab56b36688",
};

const fresh = !getApps().length;
export const auth = getAuth(fresh ? initializeApp(config) : getApp());
// Local testing against `firebase emulators:start --only auth`.
const emulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR;
if (fresh && emulator) connectAuthEmulator(auth, emulator, { disableWarnings: true });
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
