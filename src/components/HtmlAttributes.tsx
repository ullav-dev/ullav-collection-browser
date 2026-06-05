"use client";

import { useEffect } from "react";

export default function HtmlAttributes({ locale, bodyClass }: { locale: string; bodyClass: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.body.className = bodyClass;
  }, [locale, bodyClass]);
  return null;
}
