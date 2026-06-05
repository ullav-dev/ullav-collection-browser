"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = { en: "EN", de: "DE", ga: "GA" };

export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.replace(pathname, { locale: e.target.value });
  }

  return (
    <select
      value={locale}
      onChange={handleChange}
      aria-label="Language"
      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
    >
      {routing.locales.map((loc) => (
        <option key={loc} value={loc}>
          {LOCALE_LABELS[loc] ?? loc.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
