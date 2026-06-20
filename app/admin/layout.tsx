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
import {
  LayoutDashboard,
  Users,
  Receipt,
  ArrowDownToLine,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  MessageCircle,
} from "lucide-react";

const WHATSAPP_URL = "https://wa.me/2348020827133";

const sidebarItems = [
  { href: "/admin",              label: "Dashboard",   Icon: LayoutDashboard },
  { href: "/admin/customers",    label: "Customers",   Icon: Users },
  { href: "/admin/payments",     label: "Payments",    Icon: Receipt },
  { href: "/admin/withdrawals",  label: "Withdrawals", Icon: ArrowDownToLine },
  { href: "/admin/analytics",    label: "Analytics",   Icon: BarChart3 },
  { href: "/admin/reports",      label: "Reports",     Icon: FileText },
  { href: "/admin/settings",     label: "Settings",    Icon: Settings },
];

// 5 primary tabs for mobile bottom nav
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
    <div className="h-[100dvh] flex overflow-hidden bg-[#0A0A0A]">

      {/* ── Desktop Sidebar (hidden on mobile) ── */}
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
          {sidebarItems.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 mb-0.5",
                  active
                    ? "text-gold-400 border border-gold-500/15"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200 border border-transparent"
                )}
                style={active ? { background: "rgba(212,175,55,0.08)" } : undefined}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-2 py-3 border-t border-white/[0.05] space-y-0.5">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-emerald-500 hover:bg-emerald-500/[0.06] transition-all border border-transparent"
          >
            <MessageCircle size={16} /> WhatsApp Support
          </a>
          <button
            onClick={async () => { try { await signOut(); } finally { window.location.href = "/login"; } }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300 transition-all border border-transparent"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top header */}
        <header className="h-14 bg-[#0D0D0D] border-b border-white/[0.05] px-4 lg:px-6 flex items-center justify-between shrink-0">
          {/* Mobile: brand; Desktop: current path */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center border border-gold-500/20"
              style={{ background: "rgba(212,175,55,0.08)" }}>
              <span className="text-gold-500 font-bold text-xs">SS</span>
            </div>
            <span className="text-sm font-bold text-white">Admin</span>
          </div>
          <div className="hidden lg:block text-xs text-zinc-600 font-mono">{pathname}</div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="hidden sm:block text-xs text-zinc-500">{user.email}</div>
          </div>
        </header>

        {/* Page content — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Nav (hidden on desktop) ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0D0D0D] border-t border-white/[0.06] z-50 flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {bottomNavItems.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors"
            >
              <div className={cn(
                "flex items-center justify-center w-10 h-6 rounded-full transition-all",
                active ? "bg-gold-500/15" : ""
              )}>
                <Icon
                  size={18}
                  className={cn(
                    "transition-colors",
                    active ? "text-gold-400" : "text-zinc-600"
                  )}
                  strokeWidth={active ? 2.5 : 1.8}
                />
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-colors",
                active ? "text-gold-400" : "text-zinc-600"
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
