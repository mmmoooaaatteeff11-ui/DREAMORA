"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client"; // عدّل المسار حسب مشروعك

export default function GoogleButton({ label = "المتابعة بجوجل" }: { label?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error(error.message);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleGoogle}
      disabled={loading}
      className="w-full rounded-xl border border-white/20 px-4 py-3 text-sm font-medium hover:bg-white/10 disabled:opacity-50"
    >
      {loading ? "..." : label}
    </button>
  );
}