export const runtime = "edge";
export const dynamic = "force-dynamic";
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const size = Math.min(512, Math.max(16, Number(req.nextUrl.searchParams.get("size") ?? "192")));
  const fontSize = Math.round(size * 0.42);
  const radius = Math.round(size * 0.18);

  return new ImageResponse(
    <div
      style={{
        background: "#0A0A0A",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius,
        border: `${Math.round(size * 0.015)}px solid #2a2000`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
        }}
      >
        <span style={{ color: "#D4AF37", fontSize, fontWeight: 800, letterSpacing: -Math.round(fontSize * 0.05), lineHeight: 1 }}>
          SS
        </span>
      </div>
    </div>,
    { width: size, height: size }
  );
}
