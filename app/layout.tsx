import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OneTime Secret Share",
  description: "Share a secret once with passphrase-based end-to-end encryption.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}>
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10">
          <header className="mb-10 border-b border-[var(--border)] pb-6">
            <h1 className="text-2xl font-semibold tracking-tight">OneTime Secret Share</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Encrypted in your browser. The server only stores ciphertext.
            </p>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="mt-16 border-t border-[var(--border)] pt-6 text-xs text-[var(--muted)]">
            Passphrases are never sent to the server. Use a strong passphrase and share it through a separate channel.
          </footer>
        </div>
      </body>
    </html>
  );
}
