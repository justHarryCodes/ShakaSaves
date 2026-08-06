"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import Logo from "@/public/logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ── Platform detection ───────────────────────────────────────────────────────

function detectIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPad on iOS 13+ reports MacIntel but has touch points
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    (window.navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

// ── Shared icon helpers ──────────────────────────────────────────────────────

function ShareIcon() {
  // The iOS Safari share icon (box + upward arrow)
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 6H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-2" />
      <path d="M12 3v10M9 6l3-3 3 3" />
    </svg>
  );
}

function PlusSquareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

// ── iOS Instructions Banner ──────────────────────────────────────────────────

function IOSInstallBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-3 animate-in slide-in-from-bottom-4 duration-300">
      <div
        className="max-w-sm mx-auto rounded-2xl p-5 shadow-2xl"
        style={{
          background: "linear-gradient(145deg, #111111 0%, #0D0D0D 100%)",
          border: "1px solid rgba(212,175,55,0.30)",
          boxShadow: "0 0 32px rgba(212,175,55,0.10), 0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0" style={{ background: "#1a1a0a", border: "1px solid rgba(212,175,55,0.20)" }}>
            <Image src={Logo} alt="Shaka Saves" width={48} height={48} className="object-contain w-full h-full" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-[15px]">Install Shaka Saves</p>
            <p className="text-zinc-500 text-[11px] mt-0.5">Add to your iPhone home screen</p>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          <Step number={1} icon={<ShareIcon />} iconColor="#D4AF37">
            Tap the <span className="text-[#D4AF37] font-semibold">Share</span> button at the bottom of Safari
          </Step>
          <Step number={2} icon={<PlusSquareIcon />} iconColor="#D4AF37">
            Scroll down and tap <span className="text-[#D4AF37] font-semibold">&ldquo;Add to Home Screen&rdquo;</span>
          </Step>
          <Step number={3} icon={<CheckIcon />} iconColor="#22c55e">
            Tap <span className="text-emerald-400 font-semibold">&ldquo;Add&rdquo;</span> in the top-right corner
          </Step>
        </div>

        {/* Dismiss link */}
        <button
          onClick={onDismiss}
          className="mt-4 w-full text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1"
        >
          Maybe later
        </button>

        {/* Arrow pointing down to Safari toolbar */}
        <div className="flex justify-center mt-1">
          <svg viewBox="0 0 20 14" className="w-5 h-3.5 animate-bounce" fill="none" aria-hidden>
            <path d="M10 14L1 1h18L10 14z" fill="rgba(212,175,55,0.50)" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Step({ number, icon, iconColor, children }: { number: number; icon: React.ReactNode; iconColor: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-black mt-0.5"
        style={{ background: iconColor }}
      >
        {number}
      </div>
      <div className="flex items-center gap-2 text-zinc-300 text-[13px] leading-snug flex-1">
        <span style={{ color: iconColor }} className="shrink-0">{icon}</span>
        <span>{children}</span>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ── Android / Chrome Install Banner ─────────────────────────────────────────

function AndroidInstallBanner({ onInstall, onDismiss }: { onInstall: () => void; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-3 animate-in slide-in-from-bottom-4 duration-300">
      <div
        className="max-w-sm mx-auto rounded-2xl p-5 shadow-2xl"
        style={{
          background: "linear-gradient(145deg, #111111 0%, #0D0D0D 100%)",
          border: "1px solid rgba(212,175,55,0.30)",
          boxShadow: "0 0 32px rgba(212,175,55,0.10), 0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0" style={{ background: "#1a1a0a", border: "1px solid rgba(212,175,55,0.20)" }}>
            <Image src={Logo} alt="Shaka Saves" width={48} height={48} className="object-contain w-full h-full" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-[15px]">Install Shaka Saves</p>
            <p className="text-zinc-500 text-[11px] mt-0.5">Works offline · No app store needed</p>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <button
          onClick={onInstall}
          className="w-full h-11 rounded-xl font-bold text-sm text-black transition-all active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}
        >
          Add to Home Screen
        </button>
        <button
          onClick={onDismiss}
          className="mt-2 w-full text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

// ── Notification modal (unchanged logic, kept here) ──────────────────────────

function NotifModal({ onAllow, onDismiss, state }: { onAllow: () => void; onDismiss: () => void; state: "idle" | "loading" | "granted" | "denied" }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-5 animate-in slide-in-from-bottom-4 duration-300"
        style={{
          background: "#111111",
          border: "1px solid rgba(212,175,55,0.20)",
          boxShadow: "0 0 40px rgba(212,175,55,0.08)",
        }}
      >
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(212,175,55,0.10)", border: "1px solid rgba(212,175,55,0.20)" }}>
            <svg className="w-8 h-8" style={{ color: "#D4AF37" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        </div>
        <div className="text-center space-y-1.5">
          <h3 className="text-white font-bold text-lg">Stay informed</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Get instant alerts when your payments are confirmed, withdrawals are processed, and more.
          </p>
        </div>
        {state === "granted" ? (
          <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-medium py-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Notifications enabled!
          </div>
        ) : state === "denied" ? (
          <p className="text-center text-zinc-500 text-sm py-2">Notifications blocked</p>
        ) : (
          <div className="space-y-2">
            <button
              onClick={onAllow}
              disabled={state === "loading"}
              className="w-full h-11 rounded-xl font-semibold text-sm text-black transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}
            >
              {state === "loading" ? "Enabling…" : "Enable notifications"}
            </button>
            <button onClick={onDismiss} className="w-full h-9 rounded-xl text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
              Maybe later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function PWAPrompt() {
  const { idToken } = useAuth();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifState, setNotifState] = useState<"idle" | "loading" | "granted" | "denied">("idle");

  // Android / Chrome: capture the native install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      if (!localStorage.getItem("pwa-install-dismissed")) setShowAndroid(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // iOS Safari: show manual instructions (no beforeinstallprompt support)
  useEffect(() => {
    if (isStandalone()) return;                             // already installed
    if (!detectIOS()) return;                              // not an iOS device
    if (localStorage.getItem("pwa-install-dismissed")) return; // user dismissed
    // Small delay so the page loads first
    const t = setTimeout(() => setShowIOS(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Notification permission prompt (after 4 s, once)
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem("notif-asked")) return;
    const t = setTimeout(() => setShowNotif(true), 4000);
    return () => clearTimeout(t);
  }, []);

  async function handleAndroidInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") localStorage.setItem("pwa-install-dismissed", "1");
    setShowAndroid(false);
  }

  function dismissInstall() {
    localStorage.setItem("pwa-install-dismissed", "1");
    setShowAndroid(false);
    setShowIOS(false);
  }

  async function handleAllowNotifications() {
    setNotifState("loading");
    try {
      const permission = await Notification.requestPermission();
      localStorage.setItem("notif-asked", "1");
      if (permission === "granted") {
        setNotifState("granted");
        await subscribeUserToPush();
        setTimeout(() => setShowNotif(false), 1800);
      } else {
        setNotifState("denied");
        setTimeout(() => setShowNotif(false), 1500);
      }
    } catch {
      setNotifState("denied");
    }
  }

  async function subscribeUserToPush() {
    if (!idToken) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as unknown as ArrayBuffer,
      });
      await fetch("/api/v1/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(sub.toJSON()),
      });
    } catch (e) {
      console.warn("Push subscription failed", e);
    }
  }

  function dismissNotif() {
    localStorage.setItem("notif-asked", "1");
    setShowNotif(false);
  }

  const anyInstallVisible = showAndroid || showIOS;

  return (
    <>
      {showNotif && !anyInstallVisible && (
        <NotifModal
          state={notifState}
          onAllow={handleAllowNotifications}
          onDismiss={dismissNotif}
        />
      )}
      {showIOS && !showNotif && (
        <IOSInstallBanner onDismiss={dismissInstall} />
      )}
      {showAndroid && !showIOS && !showNotif && (
        <AndroidInstallBanner onInstall={handleAndroidInstall} onDismiss={dismissInstall} />
      )}
    </>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
