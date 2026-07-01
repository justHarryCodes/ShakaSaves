"use client";
export const dynamic = "force-dynamic";
import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "@/lib/client-auth";
import { getClientAuth } from "@/lib/client-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const ADMIN_EMAILS = new Set(["shakabiz247@gmail.com", "harryfrancis037@gmail.com"]);
const WHATSAPP_URL = "https://wa.me/2348020827133";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    contributionAmount: "",
    contributionFrequency: "daily",
    monthlyTarget: "",
  });
  const [step, setStep] = useState<"account" | "plan">("account");

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleContinue() {
    if (!form.fullName || !form.email || !form.password) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(form.password)) {
      toast.error("Password must contain at least one uppercase letter");
      return;
    }
    if (!/[0-9]/.test(form.password)) {
      toast.error("Password must contain at least one number");
      return;
    }
    // Admin emails skip the plan step
    if (ADMIN_EMAILS.has(form.email.toLowerCase())) {
      await handleSubmit();
      return;
    }
    setStep("plan");
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          phone: form.phone,
          contributionAmount: Number(form.contributionAmount) || 0,
          contributionFrequency: form.contributionFrequency,
          monthlyTarget: Number(form.monthlyTarget) || 0,
          minimumWithdrawalDays: 30,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Registration failed");
        return;
      }

      const user = await signInWithCustomToken(json.data.customToken as string);
      const result = await user.getIdTokenResult(true);

      toast.success("Welcome to Shaka Saves!");
      router.push(result.claims.role === "admin" ? "/admin" : "/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(msg || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  void getClientAuth;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 py-10"
      style={{ backgroundImage: "url('/background.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 w-full max-w-sm space-y-8">
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
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400 font-medium">Full name</Label>
                <Input
                  placeholder="Jane Doe"
                  value={form.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
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
                  autoComplete="email"
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-gold-500/60 h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400 font-medium">Password</Label>
                <Input
                  type="password"
                  placeholder="Min. 8 chars, 1 uppercase, 1 number"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  autoComplete="new-password"
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-gold-500/60 h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400 font-medium">Confirm password</Label>
                <Input
                  type="password"
                  placeholder="Re-enter your password"
                  value={form.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  autoComplete="new-password"
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-gold-500/60 h-10 rounded-xl"
                />
              </div>
              <Button
                type="button"
                disabled={!form.fullName || !form.email || !form.password || !form.confirmPassword || loading}
                onClick={handleContinue}
                className="w-full h-10 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold text-sm disabled:opacity-50"
              >
                {loading ? "Creating account…" : "Continue"}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("account")}
                  className="flex-1 h-10 rounded-xl border-white/10 text-zinc-400 hover:text-white bg-transparent"
                >
                  Back
                </Button>
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

        <div className="text-center space-y-2">
          <p className="text-sm text-zinc-600">
            Already have an account?{" "}
            <a href="/login" className="text-gold-400 hover:text-gold-300 font-medium transition-colors">
              Sign in
            </a>
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-emerald-400 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Need help? Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
