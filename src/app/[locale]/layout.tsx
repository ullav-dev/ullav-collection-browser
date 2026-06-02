import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/contexts/AuthContext";
import HtmlAttributes from "@/components/HtmlAttributes";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cartlann",
  description: "Collection Management",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/favicon.svg" },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as never)) {
    notFound();
  }

  const messages = await getMessages();
  const bodyClass = `${geist.className} bg-slate-50 text-slate-900 flex flex-col h-full`;

  return (
    <>
      <HtmlAttributes locale={locale} bodyClass={bodyClass} />
      <NextIntlClientProvider messages={messages}>
        <AuthProvider>
          <Nav />
          <main className="flex-1 overflow-auto">{children}</main>
          <Footer />
        </AuthProvider>
      </NextIntlClientProvider>
    </>
  );
}
