import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shaka Saves",
    short_name: "Shaka",
    description: "Discipline · Save · Grow · Financial Freedom",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0A0A",
    theme_color: "#D4AF37",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/logo.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [],
  };
}
