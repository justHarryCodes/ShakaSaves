export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, withRole } from "@/lib/api-helpers";
import { auth } from "@/lib/firebase-admin";
import { db } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const listResult = await auth.listUsers(1000);

    const uids = listResult.users.map((u) => u.uid);
    const credSnaps = uids.length
      ? await Promise.all(
          uids.map((uid) => db.collection("user_credentials").doc(uid).get())
        )
      : [];

    const credMap = new Map(
      credSnaps.map((doc) => [
        doc.id,
        doc.exists
          ? {
              hasCredentials: true,
              mustChangePassword: (doc.data()?.mustChangePassword as boolean) ?? false,
              failedAttempts: (doc.data()?.failedAttempts as number) ?? 0,
              lockedUntil: doc.data()?.lockedUntil
                ? (doc.data()!.lockedUntil as { toMillis(): number }).toMillis()
                : null,
            }
          : { hasCredentials: false, mustChangePassword: false, failedAttempts: 0, lockedUntil: null },
      ])
    );

    // Fetch customer profiles for display names/phones
    const custSnaps = uids.length
      ? await db.collection("customers").where("uid", "in", uids.slice(0, 30)).get()
      : null;
    const custMap = new Map(
      (custSnaps?.docs ?? []).map((d) => [
        d.data().uid as string,
        { customerName: d.data().fullName as string, customerPhone: d.data().phone as string, customerId: d.id },
      ])
    );

    const users = listResult.users.map((u) => {
      const cred = credMap.get(u.uid) ?? { hasCredentials: false, mustChangePassword: false, failedAttempts: 0, lockedUntil: null };
      const cust = custMap.get(u.uid);
      return {
        uid: u.uid,
        email: u.email ?? "",
        displayName: u.displayName ?? cust?.customerName ?? null,
        disabled: u.disabled,
        role: (u.customClaims?.role as string) ?? null,
        hasCredentials: cred.hasCredentials,
        mustChangePassword: cred.mustChangePassword,
        failedAttempts: cred.failedAttempts,
        lockedUntil: cred.lockedUntil,
        customerName: cust?.customerName ?? null,
        customerPhone: cust?.customerPhone ?? null,
        customerId: cust?.customerId ?? null,
      };
    });

    // Sort: admins first, then by email
    users.sort((a, b) => {
      if (a.role === "admin" && b.role !== "admin") return -1;
      if (a.role !== "admin" && b.role === "admin") return 1;
      return (a.email ?? "").localeCompare(b.email ?? "");
    });

    return ok({ users, total: users.length });
  });
}
