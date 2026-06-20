"use client";
export const dynamic = "force-dynamic";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signInWithGoogle, getClientAuth } from "@/lib/client-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const ADMIN_EMAILS = new Set(["shakabiz247@gmail.com", "harryfrancis037@gmail.com"]);

async function ensureAdminClaim(user: { email: string | null; getIdToken: (force?: boolean) => Promise<string> }) {
  if (!user.email || !ADMIN_EMAILS.has(user.email)) return;
  const token = await user.getIdToken(true);
  await fetch("/api/v1/auth/claim-admin", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  await user.getIdToken(true);
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const isGoogleFlow = params.get("google") === "1";

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: params.get("name") ?? "",
    email: params.get("email") ?? "",
    phone: "",
    password: "",
    contributionAmount: "",
    contributionFrequency: "daily",
    monthlyTarget: "",
  });

  // If redirected here from Google on login page, we already have a signed-in Google user
  // Show the savings plan step directly
  const [step, setStep] = useState<"account" | "plan">(isGoogleFlow ? "plan" : "account");

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const { user, isNewUser } = await signInWithGoogle();
      if (!isNewUser) {
        toast.info("You already have an account.");
        await ensureAdminClaim(user);
        const result = await user.getIdTokenResult(true);
        router.push(result.claims.role === "admin" ? "/admin" : "/dashboard");
        return;
      }
      // Admin emails skip the savings plan entirely
      if (user.email && ADMIN_EMAILS.has(user.email)) {
        await ensureAdminClaim(user);
        router.push("/admin");
        return;
      }
      setForm((f) => ({
        ...f,
        fullName: user.displayName ?? f.fullName,
        email: user.email ?? f.email,
      }));
      setStep("plan");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("popup-closed")) return;
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phone || !form.contributionAmount || !form.monthlyTarget) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);

    try {
      // Get token if Google user is already signed in
      const currentUser = getClientAuth().currentUser;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (currentUser) {
        const token = await currentUser.getIdToken();
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers,
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          ...(!currentUser && { password: form.password }),
          contributionAmount: Number(form.contributionAmount),
          contributionFrequency: form.contributionFrequency,
          monthlyTarget: Number(form.monthlyTarget),
          minimumWithdrawalDays: 30,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Registration failed");
        return;
      }

      // Sign in if email/password flow
      if (!currentUser) await signIn(form.email, form.password);

      const authedUser = getClientAuth().currentUser;

      // Grant admin claim if email is whitelisted, then route accordingly
      if (authedUser) {
        await ensureAdminClaim(authedUser);
      }

      // Force-refresh the token so it includes the correct role claim,
      // then update the session cookie with the fresh token.
      const freshToken = await authedUser?.getIdToken(true);
      if (freshToken) {
        await fetch("/api/v1/session", {
          method: "POST",
          body: JSON.stringify({ token: freshToken }),
          headers: { "Content-Type": "application/json" },
        });
      }

      const roleResult = await authedUser?.getIdTokenResult(true);
      toast.success("Account created! Welcome to Shaka Saves.");
      router.push(roleResult?.claims.role === "admin" ? "/admin" : "/dashboard");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 py-10"
      style={{ backgroundImage: "url('/background.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}
    >
      {/* Dark overlay to keep card readable */}
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-500/10 border border-gold-500/20 mb-3">
            <span className="text-2xl font-bold text-gold-500">SS</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {step === "account" ? "Create account" : "Set up your plan"}
          </h1>
          <p className="text-sm text-zinc-500">
            {step === "account" ? "Join Shaka Saves and start saving today" : "Tell us how you want to save"}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 justify-center">
          {["account", "plan"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s ? "bg-gold-500 text-black" :
                (step === "plan" && s === "account") ? "bg-gold-500/20 text-gold-500" :
                "bg-white/10 text-zinc-500"
              }`}>{i + 1}</div>
              {i === 0 && <div className={`w-8 h-px ${step === "plan" ? "bg-gold-500/40" : "bg-white/10"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-black/70 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-2xl">

          {step === "account" ? (
            <>
              {/* Google */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 hover:border-white/20 transition-all duration-150 disabled:opacity-50"
              >
                <GoogleIcon />
                {googleLoading ? "Signing in…" : "Continue with Google"}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.07]" />
                <span className="text-xs text-zinc-600">or</span>
                <div className="flex-1 h-px bg-white/[0.07]" />
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 font-medium">Full name</Label>
                  <Input
                    placeholder="Jane Doe"
                    value={form.fullName}
                    onChange={(e) => update("fullName", e.target.value)}
                    required
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-gold-500/60 h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 font-medium">Email</Label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    required
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-gold-500/60 h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 font-medium">Password</Label>
                  <Input
                    type="password"
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    required
                    minLength={8}
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-gold-500/60 h-10 rounded-xl"
                  />
                </div>
                <Button
                  type="button"
                  disabled={!form.fullName || !form.email || !form.password}
                  onClick={() => setStep("plan")}
                  className="w-full h-10 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold text-sm"
                >
                  Continue
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {isGoogleFlow && (
                <div className="rounded-xl bg-gold-500/10 border border-gold-500/20 px-3 py-2.5 flex items-center gap-2">
                  <GoogleIcon />
                  <div>
                    <p className="text-xs font-medium text-white">{form.fullName}</p>
                    <p className="text-[11px] text-zinc-500">{form.email}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400 font-medium">Phone number</Label>
                <Input
                  placeholder="08012345678"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  required
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-gold-500/60 h-10 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 font-medium">Amount per period (₦)</Label>
                  <Input
                    type="number"
                    placeholder="1000"
                    min={1}
                    value={form.contributionAmount}
                    onChange={(e) => update("contributionAmount", e.target.value)}
                    required
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-gold-500/60 h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 font-medium">Frequency</Label>
                  <Select value={form.contributionFrequency} onValueChange={(v) => update("contributionFrequency", v ?? "daily")}>
                    <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400 font-medium">Monthly savings target (₦)</Label>
                <Input
                  type="number"
                  placeholder="20000"
                  min={1}
                  value={form.monthlyTarget}
                  onChange={(e) => update("monthlyTarget", e.target.value)}
                  required
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-gold-500/60 h-10 rounded-xl"
                />
              </div>

              <div className="flex gap-3 pt-1">
                {!isGoogleFlow && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("account")}
                    className="flex-1 h-10 rounded-xl border-white/10 text-zinc-400 hover:text-white bg-transparent"
                  >
                    Back
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-10 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold text-sm"
                >
                  {loading ? "Creating…" : "Start saving"}
                </Button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-zinc-600">
          Already have an account?{" "}
          <a href="/login" className="text-gold-400 hover:text-gold-300 font-medium transition-colors">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
