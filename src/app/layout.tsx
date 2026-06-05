// suppressHydrationWarning: the [locale] layout sets `lang` and body className
// after hydration, causing an expected mismatch that would otherwise warn.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
