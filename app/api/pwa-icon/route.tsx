export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const logoUrl = new URL("/logo.png", req.url).toString();
  return NextResponse.redirect(logoUrl, { status: 302 });
}
