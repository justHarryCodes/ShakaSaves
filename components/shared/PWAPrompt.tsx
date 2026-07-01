"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import Logo from "@/public/logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAPrompt() {
  const { idToken } = useAuth();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifState, setNotifState] = useState<"idle" | "loading" | "granted" | "denied">("idle");

  // Capture install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (!dismissed) setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Show notification permission prompt after 4s (only once)
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    const asked = localStorage.getItem("notif-asked");
    if (asked) return;

    const t = setTimeout(() => setShowNotif(true), 4000);
    return () => clearTimeout(t);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") localStorage.setItem("pwa-install-dismissed", "1");
    setShowInstall(false);
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

  function dismissInstall() {
    localStorage.setItem("pwa-install-dismissed", "1");
    setShowInstall(false);
  }

  function dismissNotif() {
    localStorage.setItem("notif-asked", "1");
    setShowNotif(false);
  }

  return (
    <>
      {/* Notification permission modal */}
      {showNotif && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#111111] border border-gold-500/20 rounded-2xl p-6 shadow-gold space-y-5 animate-in slide-in-from-bottom-4 duration-300">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-gold-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

            {notifState === "granted" ? (
              <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-medium py-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Notifications enabled!
              </div>
            ) : notifState === "denied" ? (
              <p className="text-center text-zinc-500 text-sm py-2">Notifications blocked</p>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleAllowNotifications}
                  disabled={notifState === "loading"}
                  className="w-full h-11 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold text-sm transition-all duration-150 disabled:opacity-60"
                >
                  {notifState === "loading" ? "Enabling…" : "Enable notifications"}
                </button>
                <button
                  onClick={dismissNotif}
                  className="w-full h-9 rounded-xl text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                >
                  Maybe later
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Install banner (bottom) */}
      {showInstall && !showNotif && (
        <div className="fixed bottom-0 inset-x-0 z-50 p-3 animate-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-lg mx-auto bg-[#111111] border border-gold-500/20 rounded-2xl px-4 py-3 flex items-center gap-4 shadow-gold">
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center shrink-0">
              <Image src={Logo} alt="Shaka Saves" width={28} height={28} className="object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold">Add to home screen</p>
              <p className="text-zinc-500 text-xs">Get the full app experience</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={dismissInstall}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={handleInstall}
                className="px-4 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-400 text-black text-xs font-bold transition-all"
              >
                Install
              </button>
            </div>
          </div>
        </div>
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
