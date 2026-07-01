"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getClientAuth } from "@/lib/client-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Verify user is signed in before showing this page
    const auth = getClientAuth();
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.replace("/login");
      } else {
        setChecking(false);
      }
    });
    return unsub;
  }, [router]);

  function getStrengthLabel(): { label: string; color: string } | null {
    if (!newPassword) return null;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const long = newPassword.length >= 12;
    if (newPassword.length < 8) return { label: "Too short", color: "text-red-400" };
    if (!hasUpper || !hasNumber) return { label: "Weak", color: "text-amber-400" };
    if (long && hasUpper && hasNumber) return { label: "Strong", color: "text-emerald-400" };
    return { label: "Good", color: "text-blue-400" };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error("Password must contain at least one uppercase letter");
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      toast.error("Password must contain at least one number");
      return;
    }

    setLoading(true);
    try {
      const auth = getClientAuth();
      const user = auth.currentUser;
      if (!user) { router.replace("/login"); return; }

      const idToken = await user.getIdToken();
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Failed to change password");
        return;
      }

      // Force-refresh token so mustChangePassword claim is gone
      const freshToken = await user.getIdToken(true);
      await fetch("/api/v1/session", {
        method: "POST",
        body: JSON.stringify({ token: freshToken }),
        headers: { "Content-Type": "application/json" },
      });

      toast.success("Password changed successfully! Welcome to Shaka Saves.");
      const result = await user.getIdTokenResult(true);
      router.push(result.claims.role === "admin" ? "/admin" : "/dashboard");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  const strength = getStrengthLabel();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundImage: "url('/background.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-500/10 border border-gold-500/20 mb-3">
            <ShieldCheck size={26} className="text-gold-500" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Set new password</h1>
          <p className="text-sm text-zinc-500">Your account requires a password update</p>
        </div>

        <div className="bg-black/70 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
          <div className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-300 leading-relaxed">
              For security, your password has been reset by an admin. Please set a new password to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400 font-medium">New password</Label>
              <Input
                type="password"
                placeholder="Min. 8 chars, 1 uppercase, 1 number"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-gold-500/60 h-10 rounded-xl"
              />
              {strength && (
                <p className={`text-[11px] font-medium ${strength.color}`}>{strength.label}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400 font-medium">Confirm new password</Label>
              <Input
                type="password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-gold-500/60 h-10 rounded-xl"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[11px] text-red-400">Passwords do not match</p>
              )}
            </div>

            <div className="text-xs text-zinc-600 space-y-1 pt-1">
              <p className={newPassword.length >= 8 ? "text-emerald-500" : ""}>✓ At least 8 characters</p>
              <p className={/[A-Z]/.test(newPassword) ? "text-emerald-500" : ""}>✓ At least one uppercase letter</p>
              <p className={/[0-9]/.test(newPassword) ? "text-emerald-500" : ""}>✓ At least one number</p>
            </div>

            <Button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full h-10 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold text-sm disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save new password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
