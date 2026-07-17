import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useFinancialHealth } from '@/context/FinancialHealthContext';
import { useTwinHistory, historyMonthLabel } from '@/lib/history';
import { TrendLineChart } from '@/components/TrendLineChart';
import { ACCOUNT_ID } from '@/lib/api';

function ScoreTrend({ score, colors }: { score: number; colors: ReturnType<typeof useColors> }) {
  const color = score >= 80 ? colors.accent : score >= 65 ? colors.primary : colors.warning;
  return (
    <View style={[styles.scoreBadge, { backgroundColor: color + '22' }]}>
      <Text style={[styles.scoreBadgeText, { color, fontFamily: 'Inter_700Bold' }]}>{score}</Text>
    </View>
  );
}

// Every figure on this screen is real: the current-snapshot card comes from
// the live Twin, and the trend chart + monthly ledger come from
// GET /api/twin/:id/history — real recomputations from real transactions,
// never a fabricated series. Falls back to the honest current-snapshot-only
// view when an account has too little history for that endpoint.
export default function ReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    score,
    monthlyIncome,
    monthlyExpenses,
    monthlySavings,
    savingsRate,
    monthsOfHistory,
    lastUpdated,
  } = useFinancialHealth();
  const historyQuery = useTwinHistory();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 8;

  const date = lastUpdated ? new Date(lastUpdated) : new Date();
  const monthLabel = date.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });
  const savingRate = Math.round(savingsRate * 100);

  const history = historyQuery.data ?? [];
  const scoreTrendPoints = history.map(h => ({ label: historyMonthLabel(h.month), value: h.financial_health_score }));
  const ledgerMonths = [...history].reverse().slice(0, 6);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Bank-statement masthead */}
      <View style={[styles.masthead, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.mastheadRow}>
          <Text style={[styles.mastheadRef, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            حساب رقم {ACCOUNT_ID}
          </Text>
          <View style={styles.mastheadTitleRow}>
            <Ionicons name="document-text-outline" size={16} color={colors.primary} />
            <Text style={[styles.mastheadTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              بيان الصحة المالية
            </Text>
          </View>
        </View>
        <Text style={[styles.mastheadPeriod, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          فترة البيان: {monthLabel}
        </Text>
      </View>

      {/* Summary header */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.summaryTitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          الصحة المالية الحالية
        </Text>
        <View style={styles.summaryRow}>
          <View style={[styles.trendBadge, { backgroundColor: colors.accent + '22' }]}>
            <Ionicons name="analytics-outline" size={16} color={colors.accent} />
            <Text style={[styles.trendText, { color: colors.accent, fontFamily: 'Inter_700Bold' }]}>
              مبني على {monthsOfHistory} شهرًا
            </Text>
          </View>
          <Text style={[styles.summaryScore, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            {score} / 100
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        التقرير الحالي
      </Text>

      <View style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.reportHeader}>
          <ScoreTrend score={score} colors={colors} />
          <Text style={[styles.reportMonth, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            {monthLabel}
          </Text>
        </View>

        <View style={[styles.reportDivider, { backgroundColor: colors.border }]} />

        <View style={styles.financeRow}>
          <View style={styles.financeItem}>
            <Text style={[styles.financeLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>الدخل</Text>
            <Text style={[styles.financeVal, { color: colors.accent, fontFamily: 'Inter_600SemiBold' }]}>
              {Math.round(monthlyIncome).toLocaleString('en-US')}
            </Text>
          </View>
          <View style={styles.financeItem}>
            <Text style={[styles.financeLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>المصروفات</Text>
            <Text style={[styles.financeVal, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
              {Math.round(monthlyExpenses).toLocaleString('en-US')}
            </Text>
          </View>
          <View style={styles.financeItem}>
            <Text style={[styles.financeLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{monthlySavings < 0 ? 'العجز' : 'الفائض'}</Text>
            <Text style={[styles.financeVal, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              {Math.round(monthlySavings).toLocaleString('en-US')}
            </Text>
          </View>
        </View>

        <View style={styles.savingRateRow}>
          <Text style={[styles.savingRateLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            معدل الادخار {savingRate}%
          </Text>
          <View style={[styles.savingRateTrack, { backgroundColor: colors.border, transform: [{ scaleX: -1 }] }]}>
            <View style={[styles.savingRateFill, { width: `${Math.max(0, Math.min(100, savingRate))}%` as any, backgroundColor: colors.accent }]} />
          </View>
        </View>
      </View>

      {/* Real trend + monthly ledger, or an honest empty-state if the
          account has too little history for GET /api/twin/:id/history */}
      {ledgerMonths.length >= 2 ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            اتجاه الصحة المالية
          </Text>
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TrendLineChart
              points={scoreTrendPoints}
              legend="الصحة المالية"
              color={colors.accent}
              formatValue={v => `${Math.round(v)} / 100`}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            كشف الأشهر السابقة
          </Text>
          <View style={[styles.ledgerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.ledgerHeaderRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.ledgerHeaderCell, styles.ledgerMonthCol, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>الشهر</Text>
              <Text style={[styles.ledgerHeaderCell, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>الدخل</Text>
              <Text style={[styles.ledgerHeaderCell, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>المصروفات</Text>
              <Text style={[styles.ledgerHeaderCell, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>الصافي</Text>
            </View>
            {ledgerMonths.map(m => (
              <View key={m.month} style={[styles.ledgerRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.ledgerCell, styles.ledgerMonthCol, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>
                  {historyMonthLabel(m.month)}
                </Text>
                <Text style={[styles.ledgerCell, { color: colors.accent, fontFamily: 'Inter_400Regular' }]}>
                  {Math.round(m.monthly_income).toLocaleString('en-US')}
                </Text>
                <Text style={[styles.ledgerCell, { color: colors.primary, fontFamily: 'Inter_400Regular' }]}>
                  {Math.round(m.monthly_expenses).toLocaleString('en-US')}
                </Text>
                <Text style={[styles.ledgerCell, { color: m.net_cashflow < 0 ? colors.destructive : colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                  {Math.round(m.net_cashflow).toLocaleString('en-US')}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="calendar-outline" size={22} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            سيتوفر عرض تاريخي للتقارير الشهرية عند تجميع بيانات كافية عبر الوقت
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14 },
  masthead: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  mastheadRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mastheadRef: { fontSize: 11 },
  mastheadTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  mastheadTitle: { fontSize: 15 },
  mastheadPeriod: { fontSize: 11, textAlign: 'right' },
  summaryCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  summaryTitle: { fontSize: 12, textAlign: 'right' },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  summaryScore: { fontSize: 28 },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  trendText: { fontSize: 13 },
  sectionTitle: { fontSize: 15, textAlign: 'right' },
  reportCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  reportHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  reportMonth: { fontSize: 17 },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  scoreBadgeText: { fontSize: 16 },
  reportDivider: { height: 1 },
  financeRow: { flexDirection: 'row', justifyContent: 'space-around' },
  financeItem: { alignItems: 'center', gap: 4 },
  financeLabel: { fontSize: 11 },
  financeVal: { fontSize: 16 },
  savingRateRow: { gap: 6 },
  savingRateLabel: { fontSize: 11, textAlign: 'right' },
  savingRateTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  savingRateFill: { height: 5, borderRadius: 3 },
  chartCard: { borderRadius: 14, borderWidth: 1, padding: 16 },
  ledgerCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  ledgerHeaderRow: { flexDirection: 'row-reverse', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  ledgerHeaderCell: { flex: 1, fontSize: 11, textAlign: 'center' },
  ledgerRow: { flexDirection: 'row-reverse', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  ledgerCell: { flex: 1, fontSize: 12, textAlign: 'center' },
  ledgerMonthCol: { flex: 1.3, textAlign: 'right' },
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 20, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
