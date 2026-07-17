// Shared helpers for GET /api/twin/:id/history consumers — every value in
// that response is a real recomputation from real transactions up to that
// month (see twin/features.py::historical_snapshots on the backend), never
// a fabricated series.
import { useQuery } from '@tanstack/react-query';
import { ACCOUNT_ID, fetchTwinHistory } from './api';

export function useTwinHistory() {
  return useQuery({
    queryKey: ['twin-history', ACCOUNT_ID],
    queryFn: () => fetchTwinHistory(ACCOUNT_ID),
    staleTime: 60_000,
  });
}

const HISTORY_MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
export function historyMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  return `${HISTORY_MONTH_NAMES_AR[m - 1]} ${y}`;
}

// Mirrors twin/config.py NEED_CATEGORIES/WANT_CATEGORIES exactly — the
// historical series only returns raw per-category ratios, not a
// pre-computed needs/wants split, so this reproduces the same real
// grouping the backend's /api/budget endpoint uses for the live snapshot.
const NEED_CATEGORY_KEYS = ['household_ratio', 'loan_payment_ratio', 'insurance_ratio', 'bank_fee_ratio', 'overdraft_fee_ratio'];
export function needsWantsFromCategoryRatios(cr: Record<string, number>) {
  const needsPct = NEED_CATEGORY_KEYS.reduce((sum, k) => sum + (cr[k] ?? 0), 0) * 100;
  const wantsPct = (cr['uncategorized_ratio'] ?? 0) * 100;
  return { needsPct, wantsPct };
}
