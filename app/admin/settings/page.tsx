"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { toast } from "sonner";

interface Settings {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export default function SettingsPage() {
  const { idToken } = useAuth();
  const [settings, setSettings] = useState<Settings>({ bankName: "", accountNumber: "", accountName: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    fetch("/api/v1/settings", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => r.json())
      .then((j) => j.success && j.data.settings && setSettings(j.data.settings))
      .finally(() => setLoading(false));
  }, [idToken]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.success) toast.success("Settings saved");
      else toast.error(json.error?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h2 className="text-2xl font-bold">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank Details</CardTitle>
          <p className="text-sm text-slate-500">These details are shown to customers on the payment page.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Bank name</Label>
                <Input
                  value={settings.bankName}
                  onChange={(e) => setSettings((p) => ({ ...p, bankName: e.target.value }))}
                  placeholder="First Bank"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Account number</Label>
                <Input
                  value={settings.accountNumber}
                  onChange={(e) => setSettings((p) => ({ ...p, accountNumber: e.target.value }))}
                  placeholder="3012345678"
                  required
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Account name</Label>
                <Input
                  value={settings.accountName}
                  onChange={(e) => setSettings((p) => ({ ...p, accountName: e.target.value }))}
                  placeholder="Jane Doe"
                  required
                />
              </div>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {saving ? "Saving…" : "Save settings"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div>
        <h3 className="text-lg font-semibold mb-4">Audit Log</h3>
        <AuditLogViewer />
      </div>
    </div>
  );
}