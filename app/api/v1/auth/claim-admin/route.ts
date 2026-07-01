export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { err } from "@/lib/api-helpers";

// Admin role is now granted automatically at login when username === "shakasaves".
// This endpoint is no longer used.
export async function POST(_req: NextRequest) {
  return err("GONE", "Use the login endpoint. Admin role is granted by username.", 410);
}
