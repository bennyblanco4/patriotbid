"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth, googleProvider } from "../../lib/firebase";
import { useUser } from "../../lib/use-user";
import styles from "./login.module.css";

type Mode = "signin" | "signup";

// Only same-site paths, so ?next= can't send people to another domain.
function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next") || "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

// Phones open the Google popup as a separate tab, and when it closes the
// browser can land on whatever tab sits next to it. A full-page redirect
// keeps the whole sign-in in this tab.
function googleSignIn() {
  return window.matchMedia("(pointer: coarse)").matches
    ? signInWithRedirect(auth, googleProvider)
    : signInWithPopup(auth, googleProvider);
}

function message(error: unknown) {
  const code = error instanceof FirebaseError ? error.code : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match an account.";
    case "auth/email-already-in-use":
      return "There's already an account with that email. Sign in instead.";
    case "auth/weak-password":
      return "Use a password with at least 6 characters.";
    case "auth/invalid-email":
      return "That doesn't look like an email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/popup-blocked":
      return "Your browser blocked the Google window. Allow popups and try again.";
    default:
      return "Something went wrong. Try again.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const user = useUser();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (user) router.replace(nextPath());
  }, [user, router]);

  // Surfaces errors from a Google redirect sign-in once we're back here.
  useEffect(() => {
    getRedirectResult(auth).catch((e) => setError(message(e)));
  }, []);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void run(() =>
      mode === "signin"
        ? signInWithEmailAndPassword(auth, email, password)
        : createUserWithEmailAndPassword(auth, email, password),
    );
  }

  function resetPassword() {
    if (!email) {
      setError("Enter your email above, then click Forgot password.");
      return;
    }
    void run(async () => {
      await sendPasswordResetEmail(auth, email);
      setNotice(`We sent a reset link to ${email}.`);
    });
  }

  const signup = mode === "signup";
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>{signup ? "Create your account" : "Sign in"}</h1>
        <p className={styles.lede}>
          {signup
            ? "Free. Use Google or an email and password."
            : "Sign in to see today's DIBBS RFQs."}
        </p>

        <button
          type="button"
          className={styles.google}
          disabled={busy}
          onClick={() => void run(googleSignIn)}
        >
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
            <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
          </svg>
          Continue with Google
        </button>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <form onSubmit={submit} className={styles.form}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {!signup && (
            <button type="button" className={styles.link} onClick={resetPassword}>
              Forgot password?
            </button>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {notice && <p className={styles.notice}>{notice}</p>}
          <button type="submit" className={styles.submit} disabled={busy}>
            {signup ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className={styles.switch}>
          {signup ? "Already have an account?" : "New to Bid Prospect?"}{" "}
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              setMode(signup ? "signin" : "signup");
              setError("");
              setNotice("");
            }}
          >
            {signup ? "Sign in" : "Create an account"}
          </button>
        </p>
      </div>
    </main>
  );
}
