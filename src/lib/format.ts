/** Shared display formatters used across the operations UI. */

export const currency = (value: number | string | null | undefined): string =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(
    Number(value ?? 0),
  );

export const shortDate = (value: string | Date): string =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(value));

export const longDate = (value: string | Date): string =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value),
  );

export const nightsBetween = (checkIn: string, checkOut: string): number =>
  Math.max(
    1,
    Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)),
  );

export const titleCase = (value: string): string =>
  value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

export const todayISO = (): string => new Date().toISOString().slice(0, 10);