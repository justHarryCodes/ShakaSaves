"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { resetPassword } from "@/lib/client-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("user-not-found")) {
        setError("No account found with that email address.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundImage: "url('/background.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-500/10 border border-gold-500/20 mb-3">
            <span className="text-2xl font-bold text-gold-500">SS</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Reset password</h1>
          <p className="text-sm text-zinc-500">
            {sent ? "Check your inbox" : "We'll send you a reset link"}
          </p>
        </div>

        <div className="bg-black/70 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle size={28} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Email sent!</p>
                <p className="text-xs text-zinc-500 mt-1">
                  We sent a password reset link to<br />
                  <span className="text-zinc-300 font-medium">{email}</span>
                </p>
              </div>
              <p className="text-xs text-zinc-600">
                Didn&apos;t receive it? Check your spam folder or{" "}
                <button
                  onClick={() => setSent(false)}
                  className="text-gold-400 hover:text-gold-300 underline underline-offset-2"
                >
                  try again
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-zinc-400 font-medium">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-gold-500/60 focus:ring-gold-500/20 h-10 rounded-xl"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold text-sm disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
        </div>

        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
