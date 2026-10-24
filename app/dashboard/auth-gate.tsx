"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../../lib/use-user";

// Sends signed-out visitors to /login and brings them back here afterwards.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useUser();

  useEffect(() => {
    if (user === null) router.replace("/login?next=/dashboard");
  }, [user, router]);

  if (!user) {
    return (
      <div className="auth-wait" role="status">
        <span className="spinner" aria-hidden="true" /> Checking your sign-in
      </div>
    );
  }
  return <>{children}</>;
}
