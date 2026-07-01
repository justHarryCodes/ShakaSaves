"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";

interface UserItem {
  uid: string;
  email: string;
  displayName: string | null;
  disabled: boolean;
  role: string | null;
  hasCredentials: boolean;
  mustChangePassword: boolean;
  failedAttempts: number;
  lockedUntil: number | null;
  customerName: string | null;
  customerPhone: string | null;
  customerId: string | null;
}

function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "234" + digits.slice(1);
  if (digits.startsWith("234")) return digits;
  return digits;
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function StatusBadge({ user }: { user: UserItem }) {
  if (user.disabled) {
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 font-medium">Disabled</span>;
  }
  if (user.lockedUntil && user.lockedUntil > Date.now()) {
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium">Locked</span>;
  }
  if (user.mustChangePassword) {
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 font-medium">Pending Reset</span>;
  }
  if (!user.hasCredentials) {
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-500/15 text-zinc-500 border border-zinc-500/20 font-medium">No Login</span>;
  }
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-medium">Active</span>;
}

function RoleBadge({ role }: { role: string | null }) {
  if (role === "admin") return <span className="text-[11px] px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-400 border border-gold-500/20 font-medium">Admin</span>;
  if (role === "customer") return <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-white/[0.06] font-medium">Customer</span>;
  return <span className="text-[11px] text-zinc-600">—</span>;
}

interface ResetModalProps {
  user: UserItem;
  onClose: () => void;
  onConfirm: (uid: string) => Promise<{ temporaryPassword: string; phone: string }>;
}

function ResetModal({ user, onClose, onConfirm }: ResetModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ temporaryPassword: string; phone: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleReset() {
    setLoading(true);
    try {
      const data = await onConfirm(user.uid);
      setResult(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  function copyPassword() {
    if (!result) return;
    navigator.clipboard.writeText(result.temporaryPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const customerName = user.displayName ?? user.customerName ?? "the user";
  const phone = result?.phone ?? user.customerPhone ?? "";
  const waNumber = phone ? toWhatsAppNumber(phone) : "";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D0D0D] border border-white/[0.08] rounded-2xl w-full max-w-md p-6 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-white">Reset Password</h3>
          <p className="text-sm text-zinc-500 mt-1">
            {result
              ? "Copy this temporary password and send it to the user via WhatsApp."
              : `Generate a temporary password for ${customerName}. They must change it on next login.`}
          </p>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4 flex items-center justify-between gap-3">
              <code className="text-lg font-mono font-bold text-gold-400 tracking-widest">{result.temporaryPassword}</code>
              <button
                onClick={copyPassword}
                className="shrink-0 text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded-lg border border-white/[0.08] hover:bg-white/[0.06]"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="flex gap-3">
              {waNumber ? (
                <a
                  href={`https://wa.me/${waNumber}?text=Hello%20${encodeURIComponent(customerName)}%2C%20your%20temporary%20Shaka%20Saves%20password%20is%3A%20${encodeURIComponent(result.temporaryPassword)}%0A%0APlease%20log%20in%20and%20change%20your%20password%20immediately.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-white"
                  style={{ background: "#25D366" }}
                >
                  <WhatsAppIcon />
                  Send via WhatsApp
                </a>
              ) : (
                <div className="flex-1 h-10 rounded-xl flex items-center justify-center text-sm text-zinc-500 border border-white/[0.08]">
                  No phone on record
                </div>
              )}
              <Button variant="outline" onClick={onClose} className="border-white/10 text-zinc-400 hover:text-white">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button
              onClick={handleReset}
              disabled={loading}
              className="flex-1 h-10 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold text-sm"
            >
              {loading ? "Generating…" : "Generate Temporary Password"}
            </Button>
            <Button variant="outline" onClick={onClose} className="border-white/10 text-zinc-400 hover:text-white">
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { idToken } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/users", { headers: { Authorization: `Bearer ${idToken}` } });
      const json = await res.json();
      if (json.success) setUsers(json.data.users);
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleReset(uid: string): Promise<{ temporaryPassword: string; phone: string }> {
    const res = await fetch(`/api/v1/admin/users/${uid}/reset`, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message ?? "Reset failed");
    await loadUsers();
    return { temporaryPassword: json.data.temporaryPassword as string, phone: (json.data.phone as string) ?? "" };
  }

  async function handleToggleStatus(user: UserItem) {
    setStatusLoading(user.uid);
    try {
      const res = await fetch(`/api/v1/admin/users/${user.uid}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: !user.disabled }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(user.disabled ? "Account enabled" : "Account disabled");
        await loadUsers();
      } else {
        toast.error(json.error?.message ?? "Failed");
      }
    } finally {
      setStatusLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">User Management</h2>
          <p className="text-sm text-zinc-500 mt-1">Manage accounts, reset passwords, and control access</p>
        </div>
        <Button
          onClick={loadUsers}
          variant="outline"
          size="sm"
          className="border-white/10 text-zinc-400 hover:text-white h-9 rounded-xl text-xs"
        >
          Refresh
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Active</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Locked (failed attempts)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Pending password change</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Disabled by admin</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-600" /> No login credentials</span>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full bg-white/[0.04]" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-zinc-500">No users found</div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {users.map((user) => (
              <div key={user.uid} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-black shrink-0"
                    style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}
                  >
                    {(user.displayName ?? user.email ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white truncate">
                        {user.displayName ?? user.email}
                      </p>
                      <RoleBadge role={user.role} />
                      <StatusBadge user={user} />
                    </div>
                    {user.customerPhone && (
                      <p className="text-[11px] text-zinc-400 mt-0.5">{user.customerPhone}</p>
                    )}
                    {user.failedAttempts > 0 && !user.lockedUntil && (
                      <p className="text-[11px] text-amber-500/80">{user.failedAttempts} failed attempt{user.failedAttempts !== 1 ? "s" : ""}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pl-12 sm:pl-0">
                  {/* WhatsApp chat button — only for customers with a phone number */}
                  {user.customerPhone && user.role === "customer" && (
                    <a
                      href={`https://wa.me/${toWhatsAppNumber(user.customerPhone)}?text=Hello%20${encodeURIComponent(user.displayName ?? user.customerName ?? "")}%2C%20this%20is%20Shaka%20Saves%20support.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Chat ${user.displayName ?? "customer"} on WhatsApp`}
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors"
                    >
                      <WhatsAppIcon />
                    </a>
                  )}
                  {user.customerId && (
                    <Link
                      href={`/admin/customers/${user.customerId}`}
                      className="text-[11px] text-zinc-500 hover:text-zinc-200 border border-white/[0.08] px-2 py-1 rounded-lg transition-colors"
                    >
                      Profile
                    </Link>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResetTarget(user)}
                    className="h-8 text-xs border-white/10 text-zinc-400 hover:text-white hover:border-gold-500/40 rounded-xl"
                  >
                    Reset Password
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleStatus(user)}
                    disabled={statusLoading === user.uid}
                    className={`h-8 text-xs rounded-xl border ${
                      user.disabled
                        ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        : "border-red-500/30 text-red-400 hover:bg-red-500/10"
                    }`}
                  >
                    {statusLoading === user.uid ? "…" : user.disabled ? "Enable" : "Disable"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {resetTarget && (
        <ResetModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onConfirm={handleReset}
        />
      )}
    </div>
  );
}
