import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useFinancialHealth } from '@/context/FinancialHealthContext';

function ScoreTrend({ score, colors }: { score: number; colors: ReturnType<typeof useColors> }) {
  const color = score >= 80 ? colors.accent : score >= 65 ? colors.primary : colors.warning;
  return (
    <View style={[styles.scoreBadge, { backgroundColor: color + '22' }]}>
      <Text style={[styles.scoreBadgeText, { color, fontFamily: 'Inter_700Bold' }]}>{score}</Text>
    </View>
  );
}

// Wahla's Twin is a single current-state snapshot — no month-by-month
// income/expense/score series is persisted on the backend yet. Rather than
// fabricate 6 months of history, this shows one real current-snapshot card
// plus an honest explanation of why there's no trend view yet, using
// months_of_history (a real field) to explain data confidence instead.
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
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 8;

  const date = lastUpdated ? new Date(lastUpdated) : new Date();
  const monthLabel = date.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });
  const savingRate = Math.round(savingsRate * 100);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
      showsVerticalScrollIndicator={false}
    >
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
            <Text style={[styles.financeLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>الفائض</Text>
            <Text style={[styles.financeVal, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              {Math.round(monthlySavings).toLocaleString('en-US')}
            </Text>
          </View>
        </View>

        <View style={styles.savingRateRow}>
          <Text style={[styles.savingRateLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            معدل الادخار {savingRate}%
          </Text>
          <View style={[styles.savingRateTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.savingRateFill, { width: `${Math.max(0, Math.min(100, savingRate))}%` as any, backgroundColor: colors.accent }]} />
          </View>
        </View>
      </View>

      {/* Honest empty-state for the historical view */}
      <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="calendar-outline" size={22} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          سيتوفر عرض تاريخي للتقارير الشهرية عند تجميع بيانات كافية عبر الوقت
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14 },
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
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 20, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
