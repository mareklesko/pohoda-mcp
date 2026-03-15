export function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export function toIsoDate(dd_mm_yyyy: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(dd_mm_yyyy)) return dd_mm_yyyy.slice(0, 10);
  const m = dd_mm_yyyy.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) throw new Error(`Invalid date format: ${dd_mm_yyyy}. Use DD.MM.YYYY or YYYY-MM-DD.`);
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
