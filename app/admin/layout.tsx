"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { signOut } from "@/lib/client-auth";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard, Users, Receipt, ArrowDownToLine,
  BarChart3, FileText, Settings, LogOut, Menu, X, MessageCircle,
} from "lucide-react";

const WHATSAPP_URL = "https://wa.me/2348020827133";

const ADMIN_UIDS = new Set([
  "tKhoR67zUacvWycQDuGkhezmKM73",
  "wbzPbdemiZPZU6g33dCzKUnUfJq1",
]);

const navItems = [
  { href: "/admin",              label: "Dashboard",   Icon: LayoutDashboard },
  { href: "/admin/customers",    label: "Customers",   Icon: Users },
  { href: "/admin/payments",     label: "Payments",    Icon: Receipt },
  { href: "/admin/withdrawals",  label: "Withdrawals", Icon: ArrowDownToLine },
  { href: "/admin/analytics",    label: "Analytics",   Icon: BarChart3 },
  { href: "/admin/reports",      label: "Reports",     Icon: FileText },
  { href: "/admin/settings",     label: "Settings",    Icon: Settings },
];

const bottomNavItems = [
  { href: "/admin",              label: "Overview",    Icon: LayoutDashboard },
  { href: "/admin/customers",    label: "Customers",   Icon: Users },
  { href: "/admin/payments",     label: "Payments",    Icon: Receipt },
  { href: "/admin/withdrawals",  label: "Withdrawals", Icon: ArrowDownToLine },
  { href: "/admin/analytics",    label: "Analytics",   Icon: BarChart3 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role !== null && (role !== "admin" || !ADMIN_UIDS.has(user.uid))) router.replace("/login");
  }, [user, role, loading, router]);

  useEffect(() => { setDrawerOpen(false); setProfileOpen(false); }, [pathname]);

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

  if (!user || role !== "admin" || !ADMIN_UIDS.has(user.uid)) return null;

  const initial = (user.displayName ?? user.email ?? "A")[0].toUpperCase();

  async function handleSignOut() {
    try { await signOut(); } finally { window.location.href = "/login"; }
  }

  return (
    <div className="h-[100dvh] flex overflow-hidden bg-[#0A0A0A]">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex w-60 bg-[#0D0D0D] border-r border-white/[0.05] flex-col shrink-0 overflow-y-auto">
        <div className="px-5 py-5 border-b border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-gold-500/20"
              style={{ background: "rgba(212,175,55,0.08)" }}>
              <span className="text-gold-500 font-bold text-sm">SS</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">Shaka Saves</h1>
              <p className="text-[10px] text-zinc-600 mt-0.5">Admin Panel</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3 px-2">
          {navItems.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
            return (
              <Link key={href} href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 mb-0.5",
                  active ? "text-gold-400 border border-gold-500/15" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200 border border-transparent"
                )}
                style={active ? { background: "rgba(212,175,55,0.08)" } : undefined}
              >
                <Icon size={16} />{label}
              </Link>
            );
          })}
        </nav>
        <div className="px-2 py-3 border-t border-white/[0.05] space-y-0.5">
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-emerald-500 hover:bg-emerald-500/[0.06] transition-all border border-transparent">
            <MessageCircle size={16} /> WhatsApp Support
          </a>
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300 transition-all border border-transparent">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile Drawer Overlay ── */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/70 z-40 lg:hidden" onClick={() => setDrawerOpen(false)} />
      )}

      {/* ── Mobile Drawer Panel ── */}
      <div className={cn(
        "fixed inset-y-0 left-0 w-72 bg-[#0D0D0D] border-r border-white/[0.06] z-50 flex flex-col transition-transform duration-300 ease-in-out lg:hidden",
        drawerOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-gold-500/20"
              style={{ background: "rgba(212,175,55,0.08)" }}>
              <span className="text-gold-500 font-bold text-sm">SS</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">Shaka Saves</h1>
              <p className="text-[10px] text-zinc-600">Admin Panel</p>
            </div>
          </div>
          <button onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.05]">
            <X size={16} />
          </button>
        </div>

        {/* Admin info strip */}
        <div className="px-5 py-3 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-black"
              style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}>
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.displayName ?? "Admin"}</p>
              <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {navItems.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
            return (
              <Link key={href} href={href} onClick={() => setDrawerOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-150 mb-0.5",
                  active ? "text-gold-400 border border-gold-500/15" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white border border-transparent"
                )}
                style={active ? { background: "rgba(212,175,55,0.08)" } : undefined}
              >
                <Icon size={17} />{label}
              </Link>
            );
          })}
        </nav>

        {/* Drawer footer */}
        <div className="px-2 py-4 border-t border-white/[0.05] space-y-0.5"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-emerald-500 hover:bg-emerald-500/[0.06] transition-all border border-transparent">
            <MessageCircle size={16} /> WhatsApp Support
          </a>
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 transition-all border border-transparent">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top header */}
        <header className="h-14 bg-[#0D0D0D] border-b border-white/[0.05] px-4 flex items-center justify-between shrink-0 relative lg:px-6">

          {/* Left: profile avatar with logout dropdown */}
          <div className="relative lg:hidden">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-black shrink-0"
              style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}
            >
              {initial}
            </button>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
                <div className="absolute top-11 left-0 z-40 bg-[#0D0D0D] border border-white/10 rounded-xl overflow-hidden shadow-xl min-w-44">
                  <div className="px-3 py-2.5 border-b border-white/[0.05]">
                    <p className="text-xs font-semibold text-white truncate">{user.displayName ?? "Admin"}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
                  </div>
                  <button onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors">
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Desktop left: current path */}
          <div className="hidden lg:block text-xs text-zinc-600 font-mono">{pathname}</div>

          {/* Center: logo (mobile only) */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center border border-gold-500/20"
              style={{ background: "rgba(212,175,55,0.08)" }}>
              <span className="text-gold-500 font-bold text-xs">SS</span>
            </div>
            <span className="text-sm font-bold text-white">Shaka Saves</span>
          </div>

          {/* Right: bell + hamburger (mobile) / bell + email (desktop) */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="hidden lg:block text-xs text-zinc-500">{user.email}</div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              <Menu size={20} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0D0D0D] border-t border-white/[0.06] z-30 flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {bottomNavItems.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} className="flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors">
              <div className={cn("flex items-center justify-center w-10 h-6 rounded-full transition-all", active ? "bg-gold-500/15" : "")}>
                <Icon size={18} className={cn("transition-colors", active ? "text-gold-400" : "text-zinc-600")} strokeWidth={active ? 2.5 : 1.8} />
              </div>
              <span className={cn("text-[10px] font-medium transition-colors", active ? "text-gold-400" : "text-zinc-600")}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
