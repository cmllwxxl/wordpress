import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WordPress 管理平台",
  description: "一站式 WordPress 站点管理工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`antialiased font-sans`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
