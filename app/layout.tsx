import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { PWAPrompt } from "@/components/shared/PWAPrompt";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Shaka Saves", template: "%s · Shaka Saves" },
  description: "Discipline · Save · Grow · Financial Freedom",
  applicationName: "Shaka Saves",
  keywords: ["savings", "finance", "ajo", "contribution", "Nigeria"],
  authors: [{ name: "Shaka Saves" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Shaka Saves",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "Shaka Saves",
    title: "Shaka Saves",
    description: "Discipline · Save · Grow · Financial Freedom",
  },
  twitter: { card: "summary" },
};

export const viewport: Viewport = {
  themeColor: "#D4AF37",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Shaka Saves" />
        <link rel="apple-touch-icon" href="/apple-icon" />
        <link rel="mask-icon" href="/icon.svg" color="#D4AF37" />
        <meta name="msapplication-TileColor" content="#0A0A0A" />
      </head>
      <body className="font-sans antialiased bg-[#0A0A0A] text-white">
        <AuthProvider>
          {children}
          <PWAPrompt />
          <Toaster richColors position="top-right" />
        </AuthProvider>

        {/* Register service worker */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js', { scope: '/' })
                  .catch(function(err) { console.warn('SW registration failed:', err); });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
