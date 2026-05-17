export const compact = (value: number) => Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
export const usd = (value: number | string) => `$${Number(value || 0).toFixed(4)}`;
export const percent = (value: number) => `${Number(value || 0).toFixed(1)}%`;
export const ms = (value: number | null | undefined) => !value ? "0 ms" : value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value} ms`;
export const dateTime = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
export const titleCase = (value: string) => value.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
