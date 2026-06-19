"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Link from "next/link";

export default function NewCustomerPage() {
  const { idToken } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", password: "",
    contributionAmount: "", contributionFrequency: "daily",
    monthlyTarget: "", minimumWithdrawalDays: "30",
  });

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          contributionAmount: Number(form.contributionAmount),
          monthlyTarget: Number(form.monthlyTarget),
          minimumWithdrawalDays: Number(form.minimumWithdrawalDays),
        }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.error?.message ?? "Failed to create customer"); return; }
      toast.success("Customer created and welcome email sent");
      router.push(`/admin/customers/${json.data.customerId}`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/customers" className="text-slate-400 hover:text-slate-600 text-sm">← Back</Link>
        <h2 className="text-2xl font-bold">Add Customer</h2>
      </div>

      <Card>
        <CardHeader><CardTitle>Customer details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Password (for their account)</Label>
                <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={8} />
              </div>
              <div className="space-y-1.5">
                <Label>Contribution amount (₦)</Label>
                <Input type="number" min={1} value={form.contributionAmount} onChange={(e) => set("contributionAmount", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={form.contributionFrequency} onValueChange={(v) => set("contributionFrequency", v ?? "daily")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Monthly target (₦)</Label>
                <Input type="number" min={1} value={form.monthlyTarget} onChange={(e) => set("monthlyTarget", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Min. withdrawal days</Label>
                <Input type="number" min={1} value={form.minimumWithdrawalDays} onChange={(e) => set("minimumWithdrawalDays", e.target.value)} required />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {loading ? "Creating…" : "Create customer"}
              </Button>
              <Link href="/admin/customers"><Button variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}