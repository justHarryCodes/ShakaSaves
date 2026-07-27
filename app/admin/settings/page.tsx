"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BankAccount } from "@/types";

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function AccountCard({
  account,
  onSave,
  onDelete,
  isOnly,
  defaultEdit = false,
}: {
  account: BankAccount;
  onSave: (updated: BankAccount) => void;
  onDelete: () => void;
  isOnly: boolean;
  defaultEdit?: boolean;
}) {
  const [editing, setEditing] = useState(defaultEdit);
  const [draft, setDraft] = useState(account);

  function handleSave() {
    if (!draft.bankName.trim() || !draft.accountNumber.trim() || !draft.accountName.trim()) {
      toast.error("All fields are required");
      return;
    }
    onSave(draft);
    setEditing(false);
  }

  function handleCancel() {
    setDraft(account);
    setEditing(false);
  }

  return (
    <div className={cn(
      "rounded-xl border transition-colors",
      editing ? "border-gold-500/30 bg-gold-500/[0.03]" : "border-white/[0.06] bg-white/[0.02]"
    )}>
      {!editing ? (
        /* ── View mode ── */
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-gold-500/20 shrink-0"
              style={{ background: "rgba(212,175,55,0.08)" }}>
              <Building2 size={16} className="text-gold-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{account.bankName}</p>
              <p className="font-mono text-xs text-zinc-400 tracking-widest">{account.accountNumber}</p>
              <p className="text-xs text-zinc-500 truncate">{account.accountName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={onDelete}
              disabled={isOnly}
              title={isOnly ? "Cannot delete the only account" : "Delete account"}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ) : (
        /* ── Edit mode ── */
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs text-zinc-400">Bank name</Label>
              <Input
                value={draft.bankName}
                onChange={(e) => setDraft((d) => ({ ...d, bankName: e.target.value }))}
                placeholder="Moniepoint"
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-9 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-zinc-400">Account number</Label>
              <Input
                value={draft.accountNumber}
                onChange={(e) => setDraft((d) => ({ ...d, accountNumber: e.target.value }))}
                placeholder="5012345678"
                maxLength={20}
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-9 rounded-lg text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-zinc-400">Account name</Label>
              <Input
                value={draft.accountName}
                onChange={(e) => setDraft((d) => ({ ...d, accountName: e.target.value }))}
                placeholder="Shaka Saves"
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-9 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="h-8 px-3 rounded-lg border-white/10 text-zinc-400 hover:text-white bg-transparent text-xs"
            >
              <X size={13} className="mr-1" /> Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="h-8 px-3 rounded-lg bg-gold-500 hover:bg-gold-400 text-black font-semibold text-xs"
            >
              <Check size={13} className="mr-1" /> Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { idToken } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    fetch("/api/v1/settings", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data.settings?.accounts) {
          setAccounts(j.data.settings.accounts);
        }
      })
      .finally(() => setLoading(false));
  }, [idToken]);

  async function saveAccounts(updated: BankAccount[]) {
    if (!idToken) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ accounts: updated }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Bank accounts saved");
      } else {
        toast.error(json.error?.message ?? "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleSaveAccount(id: string, updated: BankAccount) {
    const next = accounts.map((a) => (a.id === id ? updated : a));
    setAccounts(next);
    saveAccounts(next);
  }

  function handleDeleteAccount(id: string) {
    if (accounts.length <= 1) { toast.error("You must keep at least one bank account"); return; }
    const next = accounts.filter((a) => a.id !== id);
    setAccounts(next);
    saveAccounts(next);
  }

  function handleAddAccount() {
    const blank: BankAccount = { id: genId(), bankName: "", accountNumber: "", accountName: "" };
    setAccounts((prev) => [...prev, blank]);
    // The new card opens in edit mode (defaultEdit=true)
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-white">Settings</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Manage deposit accounts and application settings</p>
      </div>

      {/* Bank accounts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Deposit Accounts</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              These are shown to customers when they make payments. You can have multiple.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleAddAccount}
            disabled={saving}
            className="h-8 px-3 rounded-lg bg-gold-500 hover:bg-gold-400 text-black font-semibold text-xs gap-1.5"
          >
            <Plus size={13} /> Add account
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl bg-white/[0.04]" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                isOnly={accounts.length === 1}
                defaultEdit={!account.bankName}
                onSave={(updated) => handleSaveAccount(account.id, updated)}
                onDelete={() => handleDeleteAccount(account.id)}
              />
            ))}
          </div>
        )}
      </div>

      <Separator className="bg-white/[0.06]" />

      <div>
        <h3 className="text-base font-semibold text-white mb-4">Audit Log</h3>
        <AuditLogViewer />
      </div>
    </div>
  );
}
