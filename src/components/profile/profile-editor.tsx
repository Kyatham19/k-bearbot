"use client";

import { toast } from "sonner";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  User,
  Mail,
  Fingerprint,
  Calendar,
  ShieldCheck,
  Crown,
  Pencil,
  BadgeCheck,
  Check,
  X,
  KeyRound,
} from "lucide-react";

interface ProfileEditorProps {
  fullName: string;
  email: string;
  userId: string;
  createdAt: string;
  emailVerified: boolean;
}

export default function ProfileEditor({
  fullName,
  email,
  userId,
  createdAt,
  emailVerified,
}: ProfileEditorProps) {
  const initials = fullName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const memberSince = createdAt
    ? new Date(createdAt).toLocaleDateString("en-GB")
    : "Unknown";
  const supabase = createClient();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(fullName);

  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailValue, setEmailValue] = useState(email);

  const [isEmailVerified, setIsEmailVerified] = useState(emailVerified);

  const [isSaving, setIsSaving] = useState(false);
  const handleSaveName = async () => {
    if (!nameValue.trim()) return;

    setIsSaving(true);

    const { error } = await supabase.auth.updateUser({
        data: {
        full_name: nameValue.trim(),
        },
    });

    setIsSaving(false);

    if (error) {
        alert(error.message);
        return;
    }

    setIsEditingName(false);

    // Refresh page to show updated data
    window.location.reload();
    };
    const handleSaveEmail = async () => {
          const trimmedEmail = emailValue.trim();

          // Empty email check
          if (!trimmedEmail) {
            toast.error("Email address cannot be empty.");
            return;
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

          if (!emailRegex.test(trimmedEmail)) {
            toast.error("Please enter a valid email address.");
            return;
          }

          // Same email check (case-insensitive)
          if (trimmedEmail.toLowerCase() === email.toLowerCase()) {
            toast.info("This is already your current email address.");
            setIsEditingEmail(false);
            return;
          }

          setIsSaving(true);

          const { error } = await supabase.auth.updateUser({
            email: trimmedEmail,
          });

          setIsSaving(false);

          if (error) {
            const message = error.message.toLowerCase();

            if (message.includes("already been registered")) {
              toast.error("This email address is already in use.");
            } else if (message.includes("rate limit")) {
              toast.error("Too many verification emails sent. Please try again later.");
            } else if (
              message.includes("invalid format") ||
              message.includes("unable to validate email address")
            ) {
              toast.error("Please enter a valid email address.");
            } else {
              toast.error(error.message);
            }

            return;
          }

          // Success
          toast.success(
            "Verification request submitted. Please check your inbox and spam folder."
          );

          // Keep showing the new email locally until it is verified
          setEmailValue(trimmedEmail);

          // Mark status as unverified
          setIsEmailVerified(false);

          // Exit edit mode
          setIsEditingEmail(false);

          // IMPORTANT: Do NOT call window.location.reload() here.
        };
      
        const handleResendVerification = async () => {
          setIsSaving(true);

          const { error } = await supabase.auth.updateUser({
            email: emailValue.trim(),
          });

          setIsSaving(false);

          if (error) {
            const message = error.message.toLowerCase();

            if (message.includes("rate limit")) {
              toast.error("Too many verification emails sent. Please try again later.");
            } else {
              toast.error(error.message);
            }

            return;
          }

          toast.success("Verification email sent successfully.");
        };
        const handleChangePassword = async () => {
            setIsSaving(true);

            const { error } = await supabase.auth.resetPasswordForEmail(
              emailValue.trim(),
              {
                redirectTo: `${window.location.origin}/reset-password`,
              }
            );

            setIsSaving(false);

            if (error) {
              const message = error.message.toLowerCase();

              if (message.includes("rate limit")) {
                toast.error(
                  "Too many password reset emails sent. Please try again later."
                );
              } else {
                toast.error(error.message);
              }

              return;
            }

            toast.success(
              "Password reset email sent. Please check your inbox and spam folder."
            );
          };
  return (
    <div className="px-6 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <User className="h-7 w-7 text-emerald-400" />
            <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Manage your AlphaSight account information
          </p>
        </div>

        {/* Main Profile Card */}
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-xl shadow-black/10">
          {/* Hero Section */}
          <div className="flex flex-col gap-4 border-b border-white/10 p-5 md:flex-row md:items-center">
            {/* Avatar */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-2xl font-bold text-white shadow-lg shadow-cyan-500/10">
              {initials}
            </div>

            {/* Name and Email */}
            <div className="flex-1">
              <h2 className="text-xl font-bold tracking-tight">
                {fullName}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {email}
              </p>
            </div>

            {/* Plan Badge */}
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              <Crown className="h-3.5 w-3.5" />
              AlphaSight Pro
            </div>
          </div>

          {/* Information Grid */}
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            {/* Full Name */}
            <InfoCard
            icon={<User className="h-4 w-4 text-emerald-400" />}
            label="Full Name"
            value={
                isEditingName ? (
                <input
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-base text-white outline-none focus:border-emerald-400"
                />
                ) : (
                nameValue
                )
            }
            action={
                isEditingName ? (
                <div className="flex items-center gap-1">
                    <button
                    onClick={handleSaveName}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                    <Check className="h-3 w-3" />
                    {isSaving ? "Saving..." : "Save"}
                    </button>

                    <button
                    onClick={() => {
                        setNameValue(fullName);
                        setIsEditingName(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
                    >
                    <X className="h-3 w-3" />
                    Cancel
                    </button>
                </div>
                ) : (
                <button
                    onClick={() => setIsEditingName(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/10"
                >
                    <Pencil className="h-3 w-3" />
                    Edit
                </button>
                )
            }
            />

            {/* Email Address */}
            <InfoCard
            icon={<Mail className="h-4 w-4 text-cyan-400" />}
            label="Email Address"
            value={
                isEditingEmail ? (
                <input
                    type="email"
                    value={emailValue}
                    onChange={(e) => setEmailValue(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-base text-white outline-none focus:border-cyan-400"
                />
                ) : (
                emailValue
                )
            }
            action={
                isEditingEmail ? (
                <div className="flex items-center gap-1">
                    <button
                    onClick={handleSaveEmail}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                    <Check className="h-3 w-3" />
                    {isSaving ? "Saving..." : "Save"}
                    </button>

                    <button
                    onClick={() => {
                        setEmailValue(email);
                        setIsEditingEmail(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
                    >
                    <X className="h-3 w-3" />
                    Cancel
                    </button>
                </div>
                ) : (
                <button
                    onClick={() => setIsEditingEmail(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/10"
                >
                    <Pencil className="h-3 w-3" />
                    Edit
                </button>
                )
            }
            />

            {/* User ID */}
            <InfoCard
              icon={<Fingerprint className="h-4 w-4 text-violet-400" />}
              label="User ID"
              value={userId}
              mono
            />

            {/* Member Since */}
            <InfoCard
              icon={<Calendar className="h-4 w-4 text-amber-400" />}
              label="Member Since"
              value={memberSince}
            />

            {/* Email Status */}
            <InfoCard
              icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />}
              label="Email Status"
              value={isEmailVerified ? "Verified" : "Pending Verification"}
              valueClassName={
                isEmailVerified ? "text-emerald-400" : "text-amber-400"
              }
              action={
                !isEmailVerified ? (
                  <button
                    onClick={handleResendVerification}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    <BadgeCheck className="h-3 w-3" />
                    {isSaving ? "Sending..." : "Verify"}
                  </button>
                ) : undefined
              }
            />

            {/* Current Plan */}
            <InfoCard
              icon={<Crown className="h-4 w-4 text-yellow-400" />}
              label="Current Plan"
              value="AlphaSight Pro"
              valueClassName="text-emerald-300"
            />
            <InfoCard
              icon={<KeyRound className="h-4 w-4 text-red-400" />}
              label="Security"
              value="Change Password"
              valueClassName="text-slate-300"
              action={
                <button
                  onClick={handleChangePassword}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                >
                  <KeyRound className="h-3 w-3" />
                  {isSaving ? "Sending..." : "Change Password"}
                </button>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  mono = false,
  action,
  valueClassName = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  action?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </span>
        </div>

        {action}
      </div>

      {/* Value */}
      <p
        className={`font-semibold text-white ${valueClassName} ${
          mono
            ? "break-all font-mono text-xs md:text-sm"
            : "text-base md:text-lg"
        }`}
      >
        {value}
      </p>
    </div>
  );
}