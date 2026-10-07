import type { Metadata, Viewport } from "next";
import { env } from "cloudflare:workers";
import "./globals.css";
import Studio from "./studio";
import { TokenProvider, type HarvexToken } from "@/components/harvex/token-context";
import { chainConfig, rewardConfig } from "@/lib/chain";
import { closedNow } from "@/lib/gate-server";

// The HARVEX contract address shown on the site comes from the server environment (HARVEX_TOKEN_ADDRESS), read on every
// request, so adding the token needs no code change. Mainnet only: a test token must never be shown as the contract.
function harvexToken(): { token: HarvexToken | null; test: boolean } {
  try {
    const c = chainConfig();
    if (c.network !== "mainnet") return { token: null, test: true };
    return { token: c.harvex ? { address: c.harvex, explorer: `${c.explorer}/token/${c.harvex}`, rewardsLive: rewardConfig(c).live } : null, test: false };
  } catch { return { token: null, test: false }; }
}

// The public origin is only known at runtime (APP_ORIGIN). Without metadataBase the share image was emitted as
// http://localhost:3000/og.png, so link previews on X, Telegram and WhatsApp had no picture.
export function generateMetadata(): Metadata {
  let base = new URL("https://harvex.studio");
  try { base = new URL((env as unknown as { APP_ORIGIN?: string }).APP_ORIGIN || base.href); } catch { /* keep the default */ }
  const description = "Shape a character, write its brief, give it skills and hand it the work.";
  return {
    metadataBase: base,
    title: { default: "Harvex Agent Studio", template: "%s · Harvex" },
    description: "Shape one of 25 people into an AI agent: write its brief, give it up to four skills and let it take on tasks for you or for anyone you share it with.",
    icons: { icon: "/harvex-icon.svg", shortcut: "/harvex-icon.svg" },
    openGraph: { type: "website", siteName: "Harvex Agent Studio", title: "Harvex Agent Studio", description, images: ["/og.png"] },
    twitter: { card: "summary_large_image", title: "Harvex Agent Studio", description, images: ["/og.png"] },
  };
}
export const viewport: Viewport = { themeColor: "#0a0a0a", width: "device-width", initialScale: 1, viewportFit: "cover" };

// Applies the saved theme before first paint (no dark->light flash). Keep in sync with app/theme.ts.
const THEME_BOOT = `try{if(localStorage.getItem("harvex-theme")!=="dark")document.documentElement.dataset.theme="light"}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" />
      </head>
      {/* browser extensions add attributes to <body> before React starts: not a mismatch worth a warning */}
      <body suppressHydrationWarning>
        {/* one app shell for every route: it reads the pathname (lib/routes.ts); pages only mark the routes */}
        <TokenProvider {...harvexToken()}>
          {/* the parts that are not open yet come from the server's setting (lib/gate.ts) */}
          <Studio closed={closedNow()} />
          {children}
        </TokenProvider>
      </body>
    </html>
  );
}
