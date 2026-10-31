
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resolve | Intelligent Support",
  description:
    "Intelligent support ticket management and semantic resolution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
