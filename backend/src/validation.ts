export function requireString(value: unknown, field: string, min = 1, max = 255): string {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
    throw new ValidationError(`${field} is invalid`);
  }
  return value.trim();
}

export function optionalString(value: unknown, field: string, max = 255): string | undefined {
  if (value === undefined) return undefined;
  return requireString(value, field, 1, max);
}

export function finiteNumber(value: unknown, field: string, min: number, max: number): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < min || number > max) throw new ValidationError(`${field} is invalid`);
  return number;
}

export function pageParams(query: Record<string, unknown>): { page: number; limit: number } {
  return {
    page: Math.floor(finiteNumber(query.page ?? 1, 'page', 1, 100000)),
    limit: Math.floor(finiteNumber(query.limit ?? 20, 'limit', 1, 100))
  };
}

export class ValidationError extends Error {
  status = 422;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

