const FALLBACK = ["EUR", "USD", "GBP"];

export const CURRENCIES: string[] =
  process.env.NEXT_PUBLIC_CURRENCIES
    ? process.env.NEXT_PUBLIC_CURRENCIES.split(",").map((c) => c.trim()).filter(Boolean)
    : FALLBACK;

export const DEFAULT_CURRENCY = CURRENCIES[0];
