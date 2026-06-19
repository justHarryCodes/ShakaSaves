"use client";
export const dynamic = "force-dynamic";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { signOut } from "@/lib/client-auth";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const navItems = [
  { href: "/admin",               label: "Dashboard",   icon: "▦" },
  { href: "/admin/customers",     label: "Customers",   icon: "◎" },
  { href: "/admin/payments",      label: "Payments",    icon: "◈" },
  { href: "/admin/withdrawals",   label: "Withdrawals", icon: "⊕" },
  { href: "/admin/analytics",     label: "Analytics",   icon: "⟁" },
  { href: "/admin/reports",       label: "Reports",     icon: "⊞" },
  { href: "/admin/settings",      label: "Settings",    icon: "⊛" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role !== null && role !== "admin") router.replace("/login");
  }, [user, role, loading, router]);

  if (loading || (user && role === null)) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 bg-white/5" />
          <Skeleton className="h-4 w-24 bg-white/5" />
        </div>
      </div>
    );
  }

  if (!user || role !== "admin") return null;

  return (
    <div className="h-screen flex overflow-hidden bg-[#0A0A0A]">
      {/* Sidebar */}
      <aside className="w-60 bg-[#0D0D0D] border-r border-white/[0.05] flex flex-col shrink-0 overflow-y-auto">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center">
              <span className="text-gold-500 font-bold text-sm">SS</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">Shaka Saves</h1>
              <p className="text-[10px] text-zinc-600 mt-0.5">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 mb-0.5",
                  active
                    ? "bg-gold-500/12 text-gold-400 border border-gold-500/15"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200 border border-transparent"
                )}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-2 py-3 border-t border-white/[0.05]">
          <button
            onClick={async () => { try { await signOut(); } finally { window.location.href = "/login"; } }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300 transition-all border border-transparent"
          >
            <span className="w-5 text-center text-base">↩</span> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-[#0D0D0D] border-b border-white/[0.05] px-6 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-600 font-mono">{pathname}</div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="text-xs text-zinc-500">{user.email}</div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
