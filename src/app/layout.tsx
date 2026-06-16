import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Magenta ERP — Marketing Dashboard",
  description: "Meta Ads & Instagram Performance Dashboard · PT Magenta Indopack Sejahtera",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&family=Fraunces:ital,wght@0,700;1,400&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
