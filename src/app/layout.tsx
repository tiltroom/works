import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { getLocale } from "@/lib/i18n-server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { getThemeScript } from "@/lib/theme";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();

  return {
    title: locale === "it" ? "Hours Platform" : "Hours Platform",
    description:
      locale === "it"
        ? "Monitora le ore di lavoro dei progetti con Supabase e Stripe"
        : "Track project working hours with Supabase and Stripe",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: getThemeScript() }} />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
            <div className="w-full max-w-7xl mx-auto flex-grow flex flex-col p-4 sm:p-6 md:p-8">
              <div className="mb-4 flex flex-wrap justify-end gap-2">
                <ThemeSwitcher locale={locale} />
                <LanguageSwitcher locale={locale} />
              </div>
              {children}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
