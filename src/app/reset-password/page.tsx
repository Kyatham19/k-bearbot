"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Lock, CheckCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleResetPassword = async () => {
    // Basic validation
    if (!password) {
      toast.error("Password cannot be empty.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setIsSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password updated successfully.");

    // Give the user a moment to see the success message
    setTimeout(() => {
      router.push("/login");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl shadow-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
            <Lock className="h-7 w-7 text-emerald-400" />
          </div>

          <h1 className="text-2xl font-bold text-white">
            Reset Your Password
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Enter a new password for your AlphaSight account.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* New Password */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400"
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleResetPassword}
            disabled={isSaving}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
          >
            {isSaving ? "Updating Password..." : "Update Password"}
          </button>
        </div>

        {/* Success Note */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <CheckCircle className="h-4 w-4" />
          Secure password update powered by Supabase
        </div>
      </div>
    </div>
  );
}