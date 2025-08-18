// Utility functions for Work Orders (extracted for reuse)
export interface MechanicEntry { name?: string; hrs?: number | string; [k: string]: any }
export interface PartEntry { sku?: string; part?: string; qty?: number | string; cost?: number | string; [k: string]: any }

export const LABOR_RATE = 60; // USD per hour

export function parseNumber(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.\-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export function computeLaborTotal(mechanics: MechanicEntry[] | undefined, rate: number = LABOR_RATE): number {
  if (!Array.isArray(mechanics) || mechanics.length === 0) return 0;
  return mechanics.reduce((sum, m) => sum + (parseNumber(m.hrs) > 0 ? parseNumber(m.hrs) * rate : 0), 0);
}

export function computePartsTotal(parts: PartEntry[] | undefined): number {
  if (!Array.isArray(parts) || parts.length === 0) return 0;
  return parts.reduce((sum, p) => {
    const qty = parseNumber(p.qty);
    const cost = parseNumber(p.cost);
    return sum + (qty > 0 && cost >= 0 ? qty * cost : 0);
  }, 0);
}

export function computeTotalLabAndParts(parts: PartEntry[] | undefined, mechanics: MechanicEntry[] | undefined, rate: number = LABOR_RATE): number {
  return computeLaborTotal(mechanics, rate) + computePartsTotal(parts);
}

export function formatCurrency(n: number): string {
  if (!n || isNaN(n)) n = 0;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function normalizeTotal(value: any): number {
  return parseNumber(value);
}
