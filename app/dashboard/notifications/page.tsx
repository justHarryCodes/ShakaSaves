"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

function timeAgo(ts: { seconds: number } | null): string {
  if (!ts) return "";
  const diff = Date.now() - ts.seconds * 1000;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CustomerNotificationsPage() {
  const { idToken } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idToken) return;
    (async () => {
      const res = await fetch("/api/v1/notifications?limit=50", { headers: { Authorization: `Bearer ${idToken}` } });
      const json = await res.json();
      if (json.success) setNotifications(json.data.notifications);
      setLoading(false);
    })();
  }, [idToken]);

  async function markAllRead() {
    if (!idToken) return;
    await fetch("/api/v1/notifications/read-all", { method: "PATCH", headers: { Authorization: `Bearer ${idToken}` } });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Notifications</h2>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>Mark all read</Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-3xl mb-2">🔔</p>
              <p className="text-slate-400 font-medium">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <div key={n.id} className={cn("flex gap-4 px-5 py-4", !n.read && "bg-blue-50/50 dark:bg-blue-900/10")}>
                  {!n.read && <span className="mt-2 h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                  <div className={cn("flex-1", n.read && "ml-6")}>
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{n.body}</p>
                    <p className="text-xs text-slate-400 mt-1">{timeAgo(n.createdAt as unknown as { seconds: number })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}