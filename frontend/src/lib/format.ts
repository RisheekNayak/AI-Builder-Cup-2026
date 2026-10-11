const inrFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const qtyFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export function formatINR(amount: number | null | undefined): string {
  return amount == null || Number.isNaN(amount) ? '—' : inrFormatter.format(amount);
}

/** Compact rupees in lakh/crore, e.g. ₹14.2 L. */
export function formatINRShort(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  const value = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (value >= 1e7) return `${sign}₹${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `${sign}₹${(value / 1e5).toFixed(1)} L`;
  return sign + inrFormatter.format(value);
}

export function formatMoney(amount: number | null | undefined, currency?: string): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  if (!currency || currency === 'INR') return formatINR(amount);
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${qtyFormatter.format(amount)}`;
  }
}

export function formatQty(value: number | null | undefined): string {
  return value == null ? '—' : qtyFormatter.format(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dueLabel(days: number): string {
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} late`;
  if (days === 0) return 'Due today';
  return `Due in ${days} day${days === 1 ? '' : 's'}`;
}

export function todayISO(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function addDaysISO(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
