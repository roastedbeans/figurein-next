"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = { error: string } | undefined;

/** Server-side email+password sign-in. Success redirects to the post-login
 *  destination (either `next` from the form or `/dashboard`). Failure returns
 *  an error string that the client form surfaces — we don't throw because
 *  `redirect` itself throws and would mask auth errors. */
export async function signIn(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  redirect(next && next.startsWith("/") ? next : "/dashboard");
}

export async function signUp(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return { error: error.message };
  }

  // When email confirmation is required, signUp returns a user but no active
  // session — the cookies won't be set and the user can't reach protected
  // routes yet. Tell them to check their email instead of silently bouncing.
  if (!data.session) {
    return {
      error:
        "Check your email to confirm your account, then sign in. (Email confirmation is enabled on this Supabase project.)",
    };
  }

  redirect(next && next.startsWith("/") ? next : "/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
