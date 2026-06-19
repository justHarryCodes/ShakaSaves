"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { AuditLog } from "@/types";

export function AuditLogViewer() {
  const { idToken } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchLogs = useCallback(async (after?: string) => {
    if (!idToken) return;
    setLoading(true);
    try {
      const url = `/api/v1/audit?limit=20${after ? `&cursor=${after}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
      const json = await res.json();
      if (json.success) {
        setLogs((prev) => (after ? [...prev, ...json.data.logs] : json.data.logs));
        setCursor(json.data.nextCursor);
        setHasMore(!!json.data.nextCursor);
      }
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  if (loading && logs.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-900">
              <TableHead>Action</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-slate-400">
                  No audit logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {log.action}
                    </code>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.performedBy.slice(0, 8)}…</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={log.performedByRole === "admin" ? "text-purple-600" : "text-blue-600"}>
                      {log.performedByRole}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">{log.targetCollection}/{log.targetId.slice(0, 8)}…</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {(log.timestamp as unknown as { toDate: () => Date })?.toDate?.()?.toLocaleString() ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {hasMore && (
        <Button variant="outline" onClick={() => cursor && fetchLogs(cursor)} disabled={loading} className="w-full">
          {loading ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
