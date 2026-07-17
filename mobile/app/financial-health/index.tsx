import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { RiyalSymbol } from '@/components/RiyalSymbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Polyline, Defs, RadialGradient, Stop, Line } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { ACCOUNT_ID, personalityLabels, fetchTwinPredictions, fetchTwinPatterns } from '@/lib/api';
import { useTwinHistory, historyMonthLabel, needsWantsFromCategoryRatios } from '@/lib/history';
import {
  useFinancialHealth,
  type Dimension,
  type Recommendation,
  type SpendingCategory,
} from '@/context/FinancialHealthContext';
import { ScoreRing } from '@/components/ScoreRing';
import { MetricCard } from '@/components/MetricCard';
import { InsightCard } from '@/components/InsightCard';
import { SpendingBar } from '@/components/SpendingBar';
import { TrendLineChart } from '@/components/TrendLineChart';

const TAB_NAMES = ['نظرة عامة', 'التوأم الرقمي', 'السلوك', 'التوقعات', 'التوصيات'];

// ─── Budget Donut (احتياجات / رغبات / ادخار) ─────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number) {
  const gap = 2;
  const s = startDeg + gap;
  const e = endDeg - gap;
  const o1 = polarToCartesian(cx, cy, outerR, s);
  const o2 = polarToCartesian(cx, cy, outerR, e);
  const i1 = polarToCartesian(cx, cy, innerR, e);
  const i2 = polarToCartesian(cx, cy, innerR, s);
  const large = e - s > 180 ? 1 : 0;
  return `M ${o1.x} ${o1.y} A ${outerR} ${outerR} 0 ${large} 1 ${o2.x} ${o2.y} L ${i1.x} ${i1.y} A ${innerR} ${innerR} 0 ${large} 0 ${i2.x} ${i2.y} Z`;
}

function BudgetDonut() {
  const colors = useColors();
  const { score, scoreLabel, budgetSegments: BUDGET_SEGMENTS } = useFinancialHealth();
  const [active, setActive] = useState<string | null>(null);

  const SIZE = 240;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = 100;
  const innerR = 68;

  let cum = 0;
  const slices = BUDGET_SEGMENTS.map(seg => {
    const startDeg = cum;
    cum += (seg.pct / 100) * 360;
    return { ...seg, startDeg, endDeg: cum };
  });

  const activeSeg = active ? BUDGET_SEGMENTS.find(s => s.id === active) : null;

  return (
    <View style={bd.wrapper}>
      {/* Chart */}
      <View style={bd.chartWrap}>
        <Svg width={SIZE} height={SIZE}>
          {slices.map(sl => (
            <Path
              key={sl.id}
              d={slicePath(cx, cy, active === sl.id ? outerR + 7 : outerR, innerR, sl.startDeg, sl.endDeg)}
              fill={sl.color}
              opacity={active && active !== sl.id ? 0.28 : 1}
              onPress={() => setActive(active === sl.id ? null : sl.id)}
            />
          ))}
        </Svg>

        {/* Center */}
        <View style={bd.center} pointerEvents="none">
          {activeSeg ? (
            <>
              <Text style={[bd.centerBig, { color: activeSeg.color, fontFamily: 'Inter_700Bold' }]}>
                {activeSeg.pct}%
              </Text>
              <Text style={[bd.centerLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                {activeSeg.label}
              </Text>
              <View style={bd.centerAmtRow}>
                <Text style={[bd.centerAmt, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                  {activeSeg.amount.toLocaleString('en-US')}
                </Text>
                <RiyalSymbol size={11} color={colors.mutedForeground} />
              </View>
            </>
          ) : (
            <>
              <Text style={[bd.centerScore, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                {score}
              </Text>
              <Text style={[bd.centerSlash, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                / 100
              </Text>
              <Text style={[bd.centerTagline, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
                {scoreLabel}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Legend cards */}
      <View style={bd.cards}>
        {BUDGET_SEGMENTS.map(seg => {
          const over = seg.pct > seg.ideal;
          return (
            <TouchableOpacity
              key={seg.id}
              activeOpacity={0.75}
              onPress={() => setActive(active === seg.id ? null : seg.id)}
              style={[
                bd.card,
                {
                  backgroundColor: colors.card,
                  borderColor: active === seg.id ? seg.color : colors.border,
                },
              ]}
            >
              {/* Color bar top */}
              <View style={[bd.cardBar, { backgroundColor: seg.color }]} />

              <View style={[bd.cardDot, { backgroundColor: seg.color + '22' }]}>
                <Ionicons name={seg.icon as any} size={16} color={seg.color} />
              </View>

              <Text style={[bd.cardPct, { color: seg.color, fontFamily: 'Inter_700Bold' }]}>
                {seg.pct}%
              </Text>
              <Text style={[bd.cardName, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                {seg.label}
              </Text>
              <Text style={[bd.cardAmt, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                {seg.amount.toLocaleString('en-US')}
              </Text>

              {/* Ideal badge — worded as an explicit delta vs. target, never a
                  bare percentage, so it can't be misread as a 4th segment
                  share when stacked under the real seg.pct%. */}
              <View style={[bd.idealBadge, { backgroundColor: over ? colors.primary + '25' : colors.accent + '18', borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={[bd.idealText, { color: over ? colors.primary : colors.accent, fontFamily: 'Inter_500Medium' }]}>
                  {over ? `+${seg.pct - seg.ideal}% عن الهدف` : `مثالي ${seg.ideal}%`}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const bd = StyleSheet.create({
  wrapper: { gap: 16, alignItems: 'center' },
  chartWrap: { width: 240, height: 240 },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  centerScore: { fontSize: 48, lineHeight: 52 },
  centerSlash: { fontSize: 13 },
  centerTagline: { fontSize: 14, marginTop: 2 },
  centerBig: { fontSize: 36, lineHeight: 40 },
  centerLabel: { fontSize: 15 },
  centerAmt: { fontSize: 12 },
  centerAmtRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3 },
  cards: { flexDirection: 'row-reverse', gap: 8, width: '100%' },
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  cardBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, borderRadius: 2 },
  cardDot: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardPct: { fontSize: 15 },
  cardName: { fontSize: 11 },
  cardAmt: { fontSize: 10 },
  idealBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, marginTop: 1 },
  idealText: { fontSize: 9 },
});

// ─── Overview ────────────────────────────────────────────────────────────────

const SIM_CHIPS: { id: string; label: string; icon: string }[] = [
  { id: 'loan',         label: 'قرض',           icon: 'wallet-outline'  },
  { id: 'installment',  label: 'شراء تقسيط',    icon: 'bag-outline'     },
  { id: 'deferred',     label: 'دفع آجل',        icon: 'time-outline'    },
  { id: 'subscription', label: 'اشتراك جديد',   icon: 'repeat-outline'  },
];

function SimulatorBanner() {
  const colors = useColors();
  return (
    <View style={[simBanner.card, { backgroundColor: colors.primary }]}>
      {/* Decorative circles */}
      <View style={[simBanner.circle, { backgroundColor: '#ffffff18' }]} />
      <View style={[simBanner.circleSmall, { backgroundColor: '#ffffff10' }]} />

      {/* Header row */}
      <View style={simBanner.headerRow}>
        <View style={[simBanner.iconWrap, { backgroundColor: '#ffffff22' }]}>
          <Ionicons name="flask-outline" size={24} color="#FFFFFF" />
        </View>
        <View style={simBanner.headerText}>
          <Text style={[simBanner.title, { fontFamily: 'Inter_700Bold' }]}>محاكي القرارات المالية</Text>
          <Text style={[simBanner.sub, { fontFamily: 'Inter_400Regular' }]}>
            اعرف الأثر قبل أن تقرر
          </Text>
        </View>
      </View>

      {/* Icon tiles grid — 2 rows × 2 cols */}
      {[[SIM_CHIPS[0], SIM_CHIPS[1]], [SIM_CHIPS[2], SIM_CHIPS[3]]].map((pair, rowIdx) => (
        <View key={rowIdx} style={simBanner.tilesRow}>
          {/* Right tile (قرض / دفع آجل) — icon on left */}
          <TouchableOpacity
            activeOpacity={0.72}
            onPress={() => router.push({ pathname: '/financial-health/simulator', params: { type: pair[0].id } })}
            style={[simBanner.tile, { flexDirection: 'row' }]}
          >
            <View style={simBanner.tileIconWrap}>
              <Ionicons name={pair[0].icon as any} size={20} color={colors.primary} />
            </View>
            <Text style={[simBanner.tileLabel, { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', textAlign: 'left' }]}>
              {pair[0].label}
            </Text>
          </TouchableOpacity>
          {/* Left tile (شراء تقسيط / اشتراك جديد) — icon on right */}
          <TouchableOpacity
            activeOpacity={0.72}
            onPress={() => router.push({ pathname: '/financial-health/simulator', params: { type: pair[1].id } })}
            style={[simBanner.tile, { flexDirection: 'row-reverse' }]}
          >
            <View style={simBanner.tileIconWrap}>
              <Ionicons name={pair[1].icon as any} size={20} color={colors.primary} />
            </View>
            <Text style={[simBanner.tileLabel, { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', textAlign: 'right' }]}>
              {pair[1].label}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const simBanner = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 18,
    flexDirection: 'column',
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  circle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -40,
    left: -30,
  },
  circleSmall: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    bottom: -20,
    left: 60,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, alignItems: 'flex-end', gap: 3 },
  title: { color: '#FFFFFF', fontSize: 15 },
  sub: { color: '#ffffffCC', fontSize: 12, textAlign: 'right' },
  tilesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  tile: {
    flex: 1,
    backgroundColor: '#ffffff14',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff22',
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 8,
  },
  tileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tileLabel: { fontSize: 12, textAlign: 'right', flex: 1 },
});

// ─── Metrics ─────────────────────────────────────────────────────────────────

// Built from real Twin values each render, expanded with a real historical
// trend from GET /api/twin/:id/history where enough data exists. Each
// metric gets a three-tier status — "needs work" / "good" / "excellent" —
// so a value that clears the ideal target by a wide margin isn't flatly
// labeled the same as one that just barely clears it.
function useMetricDefs() {
  const colors = useColors();
  const { savingsRate, debtRatio, budgetSegments } = useFinancialHealth();
  const needs = budgetSegments.find(s => s.id === 'needs');
  const wants = budgetSegments.find(s => s.id === 'wants');
  const adherence = needs && wants
    ? Math.max(0, Math.min(100, 100 - Math.abs(needs.pct - needs.ideal) - Math.abs(wants.pct - wants.ideal)))
    : 0;
  const savingsPct = Math.round(savingsRate * 100);
  const debtPct = Math.round(debtRatio * 100);

  // The three 50/30/20 shares are zero-sum (they split the same income), so
  // a savings rate far above its 20% target isn't automatically something
  // to celebrate — it mechanically means needs and/or wants are getting a
  // smaller share. If needs looks starved (well under its own 50% target),
  // that's flagged instead of being praised as "excellent".
  const needsUnderfunded = needs ? needs.pct < needs.ideal * 0.7 : false;
  const savingsStatus = savingsPct >= 20 && needsUnderfunded
    ? 'مرتفع فوق الهدف، لكن على حساب الاحتياجات — تأكد أنها مغطاة بالكامل.'
    : savingsPct >= 40
    ? 'ممتاز — تتجاوز الهدف المثالي بفارق كبير.'
    : savingsPct >= 20
    ? 'جيد — أنت في المسار الصحيح.'
    : 'أقل من الهدف المثالي — يمكن تحسينه تدريجيًا.';
  const savingsStatusColor = savingsPct >= 20 && needsUnderfunded
    ? colors.warning
    : savingsPct >= 40
    ? colors.accent
    : savingsPct >= 20
    ? '#9AB4D6'
    : colors.warning;

  return [
    {
      id: 'savings',
      label: 'معدل الادخار',
      icon: 'wallet-outline' as const,
      current: `${savingsPct}%`,
      positive: savingsPct >= 20 && !needsUnderfunded,
      color: '#9AB4D6',
      ideal: '20%',
      description: 'معدل الادخار يقيس نسبة ما تدخره من إجمالي دخلك الشهري. كلما ارتفع هذا المعدل كلما زادت قدرتك على مواجهة الطوارئ وتحقيق أهدافك المالية بعيدة المدى. لكن لأن الاحتياجات والرغبات والادخار تقتسم نفس الدخل، ارتفاعه كثيرًا عن الهدف قد يعني أن حصة الاحتياجات تقلّصت.',
      status: savingsStatus,
      statusColor: savingsStatusColor,
      tip: needsUnderfunded
        ? 'راجع قسم "الميزانية" للتأكد أن كل احتياجاتك الأساسية مغطاة قبل تحويل مبالغ إضافية للادخار.'
        : 'تحويل مبلغ إضافي بشكل تلقائي كل شهر يقرّبك من الهدف المثالي بثبات.',
    },
    {
      id: 'debt',
      label: 'نسبة الديون',
      icon: 'trending-down-outline' as const,
      current: `${debtPct}%`,
      positive: debtPct < 30,
      color: '#9AB4D6',
      ideal: '< 30%',
      description: 'نسبة الديون هي مقارنة بين إجمالي التزاماتك الشهرية ودخلك. النسبة الصحية أقل من 30%، وكلما انخفضت كلما كانت صحتك المالية أفضل.',
      status: debtPct === 0
        ? 'ممتاز — بدون أي التزامات ديون شهرية.'
        : debtPct < 30
        ? 'جيد — ضمن النسبة الصحية.'
        : 'مقبول — لكن يمكن تحسينه.',
      statusColor: debtPct === 0 ? colors.accent : debtPct < 30 ? '#9AB4D6' : colors.warning,
      tip: 'سداد قسط إضافي كلما أمكن يخفض هذه النسبة تدريجيًا.',
    },
    {
      id: 'efficiency',
      label: 'كفاءة الإنفاق',
      icon: 'analytics-outline' as const,
      current: `${Math.round(adherence)}%`,
      positive: adherence >= 70,
      color: '#9AB4D6',
      ideal: '100%',
      description: 'يقيس مدى قرب توزيع إنفاقك الفعلي (احتياجات/رغبات/ادخار) من قاعدة 50/30/20 المثالية.',
      status: adherence >= 90
        ? 'ممتاز — توزيعك يطابق القاعدة المثالية تقريبًا.'
        : adherence >= 70
        ? 'جيد — توزيعك قريب من القاعدة المثالية.'
        : 'هناك انحراف ملحوظ عن القاعدة المثالية.',
      statusColor: adherence >= 90 ? colors.accent : adherence >= 70 ? '#9AB4D6' : colors.warning,
      tip: 'مراجعة قسم "الميزانية" يوضح بالضبط أي فئة تحتاج تعديلًا.',
    },
  ];
}

function MetricsChart() {
  const colors = useColors();
  const [activeId, setActiveId] = useState('savings');
  const [expanded, setExpanded] = useState(false);
  const METRIC_DEFS = useMetricDefs();
  const historyQuery = useTwinHistory();

  const metric = METRIC_DEFS.find(m => m.id === activeId)!;

  const history = historyQuery.data ?? [];
  const trendPoints = history.map(h => {
    const label = historyMonthLabel(h.month);
    if (activeId === 'savings') return { label, value: h.savings_rate * 100 };
    if (activeId === 'debt') return { label, value: h.debt_ratio * 100 };
    const { needsPct, wantsPct } = needsWantsFromCategoryRatios(h.category_ratios);
    const adherence = Math.max(0, Math.min(100, 100 - Math.abs(needsPct - 50) - Math.abs(wantsPct - 30)));
    return { label, value: adherence };
  });

  return (
    <View style={mc.wrapper}>
      {/* Section header */}
      <Text style={[tabStyles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        المؤشرات الرئيسية
      </Text>

      {/* Metric selector chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={mc.chips}>
        {METRIC_DEFS.map(m => {
          const active = m.id === activeId;
          return (
            <TouchableOpacity
              key={m.id}
              onPress={() => { setActiveId(m.id); setExpanded(false); }}
              style={[
                mc.chip,
                {
                  backgroundColor: active ? m.color + '22' : colors.card,
                  borderColor: active ? m.color : colors.border,
                },
              ]}
            >
              <Ionicons name={m.icon} size={13} color={active ? m.color : colors.mutedForeground} />
              <Text style={[mc.chipText, { color: active ? m.color : colors.mutedForeground, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Chart card */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setExpanded(e => !e)}
        style={[mc.card, { backgroundColor: colors.card, borderColor: expanded ? metric.color : colors.border }]}
      >
        {/* Current value row */}
        <View style={mc.valueRow}>
          <View style={[mc.trendBadge, { backgroundColor: '#9AB4D618' }]}>
            <Ionicons
              name={metric.positive ? 'checkmark-circle-outline' : 'alert-circle-outline'}
              size={11}
              color="#9AB4D6"
            />
            <Text style={[mc.trendText, { color: '#9AB4D6', fontFamily: 'Inter_500Medium' }]}>
              الهدف {metric.ideal}
            </Text>
          </View>
          <View style={mc.valueGroup}>
            <Text style={[mc.currentVal, { color: '#E07A5F', fontFamily: 'Inter_700Bold' }]}>
              {metric.current}
            </Text>
            <Text style={[mc.metricLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              {metric.label}
            </Text>
          </View>
        </View>

        {/* Real historical trend from GET /api/twin/:id/history — falls
            back to an honest empty-state when there's too little history. */}
        <TrendLineChart
          points={trendPoints}
          legend={metric.label}
          color={metric.color}
          formatValue={v => `${Math.round(v)}%`}
        />

        {/* Tap hint */}
        <View style={mc.hintRow}>
          <Ionicons
            name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={14}
            color={colors.mutedForeground}
          />
          <Text style={[mc.hint, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            {expanded ? 'إخفاء التفاصيل' : 'اضغط لعرض التفاصيل'}
          </Text>
        </View>

        {/* Expanded detail */}
        {expanded && (
          <View style={[mc.detail, { borderTopColor: colors.border }]}>
            <View style={mc.detailStats}>
              <View style={mc.detailStat}>
                <Text style={[mc.detailStatVal, { color: metric.color, fontFamily: 'Inter_700Bold' }]}>
                  {metric.ideal}
                </Text>
                <Text style={[mc.detailStatLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                  الهدف المثالي
                </Text>
              </View>
              <View style={[mc.detailDivider, { backgroundColor: colors.border }]} />
              <View style={mc.detailStat}>
                <Text style={[mc.detailStatVal, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                  {metric.current}
                </Text>
                <Text style={[mc.detailStatLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                  الحالي
                </Text>
              </View>
            </View>

            <View style={[mc.statusBadge, { backgroundColor: metric.statusColor + '15' }]}>
              <Text style={[mc.statusText, { color: metric.statusColor, fontFamily: 'Inter_500Medium' }]}>
                {metric.status}
              </Text>
            </View>

            <Text style={[mc.descText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>
              {metric.description}
            </Text>

            <View style={[mc.tipBox, { backgroundColor: colors.secondary, borderColor: metric.color + '44' }]}>
              <Ionicons name="bulb-outline" size={15} color={metric.color} />
              <Text style={[mc.tipText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                {metric.tip}
              </Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const mc = StyleSheet.create({
  wrapper: { gap: 10 },
  chips: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12 },
  card: { borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 10, overflow: 'hidden' },
  valueRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' },
  valueGroup: { alignItems: 'flex-end', gap: 2 },
  currentVal: { fontSize: 28 },
  metricLabel: { fontSize: 12 },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  trendText: { fontSize: 12 },
  hintRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, justifyContent: 'center' },
  hint: { fontSize: 11 },
  detail: { borderTopWidth: 1, paddingTop: 14, gap: 12 },
  detailStats: { flexDirection: 'row-reverse', justifyContent: 'space-around', alignItems: 'center' },
  detailStat: { alignItems: 'center', gap: 3 },
  detailStatVal: { fontSize: 20 },
  detailStatLabel: { fontSize: 11 },
  detailDivider: { width: 1, height: 36 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-end' },
  statusText: { fontSize: 12 },
  descText: { fontSize: 13, textAlign: 'right', lineHeight: 21 },
  tipBox: { flexDirection: 'row-reverse', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 12, textAlign: 'right', lineHeight: 19 },
});

// ─── Featured Product Card ────────────────────────────────────────────────────

const RECOMMENDATION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'ادخار': 'wallet-outline',
  'تمويل': 'card-outline',
  'ديون': 'trending-down-outline',
  'بطاقات': 'card-outline',
  'أعمال': 'briefcase-outline',
};

function FeaturedRecommendation({ onSeeAll }: { onSeeAll: () => void }) {
  const { recommendations } = useFinancialHealth();
  const top = recommendations[0];

  // No real suggestion applies to this account right now — showing a fake
  // one just to fill the card would be exactly the kind of fabrication
  // this screen is supposed to avoid, so it's hidden instead.
  if (!top) return null;

  return (
    <LinearGradient
      colors={['#112236', '#1C1028']}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={fr.card}
    >
      {/* Glow blobs — radial gradient via SVG */}
      <Svg style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200 }} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id="glowTop" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#E07A5F" stopOpacity="0.28" />
            <Stop offset="100%" stopColor="#E07A5F" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="100" cy="100" r="100" fill="url(#glowTop)" />
      </Svg>
      <Svg style={{ position: 'absolute', bottom: -40, left: -40, width: 140, height: 140 }} viewBox="0 0 140 140">
        <Defs>
          <RadialGradient id="glowBottom" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#9AB4D6" stopOpacity="0.2" />
            <Stop offset="100%" stopColor="#9AB4D6" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="70" cy="70" r="70" fill="url(#glowBottom)" />
      </Svg>

      {/* ── Tag ── */}
      <View style={fr.tagRow}>
        <View style={fr.tag}>
          <View style={fr.tagDot} />
          <Text style={[fr.tagText, { fontFamily: 'Inter_700Bold' }]}>توصية مخصصة لك</Text>
        </View>
      </View>

      {/* ── الرقم الكبير — فقط لو فيه مبلغ حقيقي من التوصية ── */}
      {top.savings > 0 && (
        <>
          <View style={fr.numberBlock}>
            <Text style={[fr.numberSub, { fontFamily: 'Inter_400Regular' }]}>مبلغ يمكنك تحويله للتوفير</Text>
            <View style={fr.numberRow}>
              <Text style={[fr.numberBig, { fontFamily: 'Inter_700Bold' }]}>
                {Math.round(top.savings).toLocaleString('en-US')}
              </Text>
              <RiyalSymbol size={18} color="#ffffff66" />
            </View>
          </View>

          {/* ── Gradient divider ── */}
          <LinearGradient
            colors={['#E07A5F55', '#E07A5F00']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 0 }}
            style={fr.divider}
          />
        </>
      )}

      {/* ── Body — شرح التوصية الحقيقية من محرك الاقتراحات ── */}
      <Text style={[fr.body, { fontFamily: 'Inter_400Regular' }]}>
        {top.description}
      </Text>

      {/* ── Solution box ── */}
      <View style={fr.solutionBox}>
        <View style={fr.solutionTexts}>
          <Text style={[fr.solutionName, { fontFamily: 'Inter_700Bold' }]}>{top.title}</Text>
          <Text style={[fr.solutionDesc, { fontFamily: 'Inter_400Regular' }]}>
            {top.category}
          </Text>
        </View>
        <View style={fr.productIcon}>
          <Ionicons name={RECOMMENDATION_ICONS[top.category] ?? 'bulb-outline'} size={20} color="#E07A5F" />
        </View>
      </View>

      {/* ── CTA — يفتح تبويب التوصيات الكامل ── */}
      <TouchableOpacity activeOpacity={0.85} style={fr.ctaBtn} onPress={onSeeAll}>
        <Ionicons name="chevron-back-outline" size={14} color="#112236" />
        <Text style={[fr.ctaText, { fontFamily: 'Inter_700Bold' }]}>عرض كل التوصيات</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const fr = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 14,
    gap: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ffffff12',
  },
  glowTop: {
    position: 'absolute', top: -50, right: -50,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: '#E07A5F28',
  },
  glowBottom: {
    position: 'absolute', bottom: -35, left: -35,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#9AB4D618',
  },
  // ── Tag
  tagRow: { flexDirection: 'row-reverse' },
  tag: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    backgroundColor: '#E07A5F1A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  tagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E07A5F' },
  tagText: { color: '#E07A5F', fontSize: 11 },
  // ── Number block
  numberBlock: { gap: 4, alignItems: 'flex-end' },
  numberSub: { color: '#ffffff55', fontSize: 13, textAlign: 'right' },
  numberRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  numberBig: { color: '#E07A5F', fontSize: 34, lineHeight: 38 },
  numberUnit: { color: '#ffffff66', fontSize: 13, marginBottom: 4 },
  // ── Divider
  divider: { height: 1 },
  // ── Body
  body: { color: '#9AB4D6', fontSize: 14, textAlign: 'right', lineHeight: 22 },
  // ── Solution box
  solutionBox: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12,
    backgroundColor: '#ffffff0A', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#ffffff10',
  },
  solutionTexts: { flex: 1, gap: 2, alignItems: 'flex-end' },
  solutionName: { color: '#FFFFFF', fontSize: 13 },
  solutionDesc: { color: '#ffffff66', fontSize: 12 },
  productIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: '#E07A5F18', borderWidth: 1, borderColor: '#E07A5F33',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  // ── CTA
  ctaBtn: {
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 13,
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  ctaText: { color: '#112236', fontSize: 15 },
});

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ onSeeAll }: { onSeeAll: () => void }) {
  const colors = useColors();

  return (
    <View style={tabStyles.section}>
      {/* Budget donut */}
      <BudgetDonut />

      {/* Featured recommendation — visible immediately */}
      <FeaturedRecommendation onSeeAll={onSeeAll} />

      {/* Simulator banner */}
      <SimulatorBanner />

      {/* Metrics line chart */}
      <MetricsChart />
    </View>
  );
}

// ─── Digital Twin ────────────────────────────────────────────────────────────

function DimensionRow({ dim, colors }: { dim: Dimension; colors: ReturnType<typeof useColors> }) {
  const [widthVal] = React.useState(dim.value);
  return (
    <View style={tabStyles.dimRow}>
      <View style={tabStyles.dimLabelRow}>
        <Text style={[tabStyles.dimLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          {dim.label}
        </Text>
        <Text style={[tabStyles.dimValue, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
          {dim.value}
        </Text>
      </View>
      <View style={[tabStyles.dimTrack, { backgroundColor: colors.border, transform: [{ scaleX: -1 }] }]}>
        <View
          style={[
            tabStyles.dimFill,
            { width: `${widthVal}%` as any, backgroundColor: dim.color },
          ]}
        />
      </View>
    </View>
  );
}

function DigitalTwinTab() {
  const colors = useColors();
  const { dimensions, score, scoreLabel, archetypeName, archetypeDescription, personalityConfidence } = useFinancialHealth();
  const historyQuery = useTwinHistory();

  const sorted = [...dimensions].sort((a, b) => b.value - a.value);
  const strengths = sorted.slice(0, 2);
  const opportunities = sorted.slice(-2);

  // Real evolution — the earliest and latest entries in the history are
  // both genuine classify() runs on genuine historical states (see
  // twin/features.py::historical_snapshots), not a fabricated timeline.
  const history = historyQuery.data ?? [];
  const earliestPersonality = history.length >= 2 ? history[0].financial_personality : null;
  const personalityChanged = earliestPersonality && earliestPersonality !== history[history.length - 1]?.financial_personality;

  return (
    <View style={tabStyles.section}>
      {/* Archetype card */}
      <View style={[tabStyles.archetypeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[tabStyles.archetypeIcon, { backgroundColor: colors.primary + '22' }]}>
          <Ionicons name="person-outline" size={28} color={colors.primary} />
        </View>
        <Text style={[tabStyles.archetypeLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          النمط المالي · ثقة التصنيف {Math.round(personalityConfidence * 100)}%
        </Text>
        <Text style={[tabStyles.archetypeName, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
          {archetypeName}
        </Text>
        <Text style={[tabStyles.archetypeDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          {archetypeDescription}
        </Text>
        {earliestPersonality && (
          <View style={tabStyles.evolutionRow}>
            <Ionicons name={personalityChanged ? 'trending-up-outline' : 'checkmark-done-outline'} size={12} color={colors.mutedForeground} />
            <Text style={[tabStyles.evolutionText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              {personalityChanged
                ? `كنت "${personalityLabels[earliestPersonality] ?? earliestPersonality}" قبل ${history.length} أشهر`
                : `نمطك ثابت منذ ${history.length} أشهر على الأقل`}
            </Text>
          </View>
        )}
        <View style={[tabStyles.scorePill, { backgroundColor: colors.primary }]}>
          <Text style={[tabStyles.scorePillText, { fontFamily: 'Inter_700Bold' }]}>{score}/100 – {scoreLabel}</Text>
        </View>
      </View>

      {/* Dimensions */}
      <Text style={[tabStyles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        أبعاد صحتك المالية
      </Text>
      <View style={[tabStyles.dimsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {dimensions.map(dim => (
          <DimensionRow key={dim.label} dim={dim} colors={colors} />
        ))}
      </View>

      {/* Strengths */}
      <Text style={[tabStyles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        نقاط قوتك
      </Text>
      {strengths.map(dim => (
        <View key={dim.label} style={[tabStyles.strengthItem, { backgroundColor: '#9AB4D615', borderColor: '#9AB4D630' }]}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#9AB4D6" />
          <View style={tabStyles.strengthText}>
            <Text style={[tabStyles.strengthLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              {dim.label}
            </Text>
            <Text style={[tabStyles.strengthValue, { color: '#9AB4D6', fontFamily: 'Inter_500Medium' }]}>
              {dim.value}%
            </Text>
          </View>
        </View>
      ))}

      {/* Opportunities */}
      <Text style={[tabStyles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        فرص التحسين
      </Text>
      {opportunities.map(dim => (
        <View key={dim.label} style={[tabStyles.strengthItem, { backgroundColor: '#E07A5F15', borderColor: '#E07A5F30' }]}>
          <Ionicons name="arrow-up-circle-outline" size={20} color="#E07A5F" />
          <View style={tabStyles.strengthText}>
            <Text style={[tabStyles.strengthLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              {dim.label}
            </Text>
            <Text style={[tabStyles.strengthValue, { color: '#E07A5F', fontFamily: 'Inter_500Medium' }]}>
              {dim.value}%
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Behavior ─────────────────────────────────────────────────────────────────

function BehaviorTab() {
  const colors = useColors();
  const { spendingCategories, monthlyExpenses, monthsOfHistory } = useFinancialHealth();
  const historyQuery = useTwinHistory();
  const spendingTrendPoints = (historyQuery.data ?? []).map(h => ({
    label: historyMonthLabel(h.month),
    value: h.monthly_expenses,
  }));

  return (
    <View style={tabStyles.section}>
      {/* Month summary */}
      <View style={[tabStyles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[tabStyles.summaryLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          متوسط الإنفاق الشهري
        </Text>
        <Text style={[tabStyles.summaryAmount, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
          {monthlyExpenses.toLocaleString('en-US')} ريال
        </Text>
        <View style={tabStyles.summaryChangeRow}>
          <Ionicons name="analytics-outline" size={14} color="#9AB4D6" />
          <Text style={[tabStyles.summaryChange, { color: '#9AB4D6', fontFamily: 'Inter_500Medium' }]}>
            مبني على {monthsOfHistory} شهرًا من البيانات
          </Text>
        </View>
      </View>

      {/* Category bars */}
      <Text style={[tabStyles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        توزيع الإنفاق حسب الفئة
      </Text>
      <View style={[tabStyles.categoriesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {spendingCategories.map(cat => (
          <SpendingBar
            key={cat.id}
            name={cat.name}
            amount={cat.amount}
            budget={cat.budget}
            percentage={cat.percentage}
            color={cat.color}
          />
        ))}
      </View>
      <View style={tabStyles.categoryNoteRow}>
        <Ionicons name="information-circle-outline" size={13} color={colors.mutedForeground} />
        <Text style={[tabStyles.categoryNoteText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          التصنيف مبني على نوع العملية البنكية الفعلي، وليس على اسم المتجر — بيانات الحساب لا تتضمن نص وصف التاجر.
        </Text>
      </View>

      {/* Monthly trend — real per-month spend from GET /api/twin/:id/history */}
      <Text style={[tabStyles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        اتجاه الإنفاق الشهري
      </Text>
      <View style={[tabStyles.trendCard, { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: 16 }]}>
        <TrendLineChart
          points={spendingTrendPoints}
          legend="المصروفات الشهرية"
          color="#E07A5F"
          formatValue={v => `${Math.round(v).toLocaleString('en-US')} ريال`}
        />
      </View>
    </View>
  );
}

// ─── Predictions ─────────────────────────────────────────────────────────────

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

// All values below come straight from the Twin's linear-projection forecast
// (GET /api/twin/:id → forecast.projected_balances). The backend does not
// compute a per-month "score" or "confidence", and has no concept of
// user-defined savings goals or milestones — so none of those are shown.
const CONFIDENCE_LABEL_AR: Record<string, string> = { high: 'ثقة عالية', medium: 'ثقة متوسطة', low: 'ثقة منخفضة' };
const CONFIDENCE_COLOR: Record<string, string> = { high: '#4CAF8C', medium: '#9AB4D6', low: '#F4A836' };

function PredictionsTab() {
  const colors = useColors();
  const { forecast, currentBalance, lastUpdated } = useFinancialHealth();
  const predictionsQuery = useQuery({
    queryKey: ['twin-predictions', ACCOUNT_ID],
    queryFn: () => fetchTwinPredictions(ACCOUNT_ID),
    staleTime: 60_000,
  });
  const patternsQuery = useQuery({
    queryKey: ['twin-patterns', ACCOUNT_ID],
    queryFn: () => fetchTwinPatterns(ACCOUNT_ID),
    staleTime: 60_000,
  });

  const anchor = new Date(lastUpdated);
  const nextMonths = forecast.projected_balances.slice(0, 3).map((balance, i) => {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() + i + 1, 1);
    const prevBalance = i === 0 ? currentBalance : forecast.projected_balances[i - 1];
    return {
      month: `${MONTH_NAMES_AR[d.getMonth()]} ${d.getFullYear()}`,
      balance,
      delta: balance - prevBalance,
    };
  });

  const growth12m = forecast.balance_in_12m - currentBalance;
  const growth24m = forecast.balance_in_24m - currentBalance;

  return (
    <View style={tabStyles.section}>
      <Text style={[tabStyles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        التوقعات للأشهر القادمة
      </Text>
      <Text style={[tabStyles.summaryChange, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'right' }]}>
        امتداد خطي لنمط دخلك ومصروفاتك الحالي — وليس تنبؤًا بأحداث مستقبلية.
      </Text>
      <View style={[tabStyles.forecastCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10 }]}>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={[tabStyles.forecastLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            الرصيد الحالي
          </Text>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline', gap: 3 }}>
            <Text style={[tabStyles.forecastVal, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              {Math.round(currentBalance).toLocaleString('en-US')}
            </Text>
            <RiyalSymbol size={13} color={colors.foreground} />
          </View>
        </View>
      </View>
      {nextMonths.map((f, i) => (
        <View key={i} style={[tabStyles.forecastCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={tabStyles.forecastHeader}>
            <View style={[tabStyles.confBadge, { backgroundColor: f.delta >= 0 ? '#9AB4D622' : '#E07A5F22' }]}>
              <Text style={[tabStyles.confText, { color: f.delta >= 0 ? '#9AB4D6' : '#E07A5F', fontFamily: 'Inter_500Medium' }]}>
                {f.delta >= 0 ? '+' : ''}{Math.round(f.delta).toLocaleString('en-US')}
              </Text>
            </View>
            <Text style={[tabStyles.forecastMonth, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              {f.month}
            </Text>
          </View>
          <View style={tabStyles.forecastBody}>
            <View style={tabStyles.forecastItem}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 3 }}>
                <Text style={[tabStyles.forecastVal, { color: '#9AB4D6', fontFamily: 'Inter_700Bold' }]}>
                  {Math.round(f.balance).toLocaleString('en-US')}
                </Text>
                <RiyalSymbol size={13} color="#9AB4D6" />
              </View>
              <Text style={[tabStyles.forecastLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                الرصيد المتوقع
              </Text>
            </View>
          </View>
        </View>
      ))}

      <Text style={[tabStyles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        على المدى الأبعد
      </Text>
      <View style={[tabStyles.yearCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[tabStyles.yearLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          الرصيد المتوقع بعد 12 شهرًا
        </Text>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline', gap: 4 }}>
          <Text style={[tabStyles.yearAmount, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            {Math.round(forecast.balance_in_12m).toLocaleString('en-US')} ريال
          </Text>
          <Text style={{ color: growth12m >= 0 ? '#9AB4D6' : '#E07A5F', fontSize: 13, fontFamily: 'Inter_500Medium' }}>
            ({growth12m >= 0 ? '+' : ''}{Math.round(growth12m).toLocaleString('en-US')})
          </Text>
        </View>
        <Text style={[tabStyles.yearLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 8 }]}>
          الرصيد المتوقع بعد 24 شهرًا
        </Text>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline', gap: 4 }}>
          <Text style={[tabStyles.yearAmount, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            {Math.round(forecast.balance_in_24m).toLocaleString('en-US')} ريال
          </Text>
          <Text style={{ color: growth24m >= 0 ? '#9AB4D6' : '#E07A5F', fontSize: 13, fontFamily: 'Inter_500Medium' }}>
            ({growth24m >= 0 ? '+' : ''}{Math.round(growth24m).toLocaleString('en-US')})
          </Text>
        </View>
      </View>

      <View style={[tabStyles.trendCard, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center', gap: 8, paddingVertical: 20 }]}>
        <Ionicons
          name={forecast.months_to_zero === null ? 'shield-checkmark-outline' : 'alert-circle-outline'}
          size={22}
          color={forecast.months_to_zero === null ? '#9AB4D6' : '#E07A5F'}
        />
        <Text style={[tabStyles.summaryChange, { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: 'center' }]}>
          {forecast.months_to_zero === null
            ? `لا يوجد خطر على رصيدك خلال ${forecast.horizon_months} شهرًا القادمة وفق النمط الحالي.`
            : `عند استمرار النمط الحالي، رصيدك متوقع أن يصل للصفر خلال ${forecast.months_to_zero} شهرًا.`}
        </Text>
      </View>

      {/* Real empirical probabilities — frequency counts over the account's
          own historical months, not a fitted model (GET /api/twin/:id/predictions) */}
      {predictionsQuery.data && (
        <>
          <View style={tabStyles.predictionsHeaderRow}>
            <View style={[tabStyles.confPill, { backgroundColor: CONFIDENCE_COLOR[predictionsQuery.data.confidence.label] + '22' }]}>
              <Text style={[tabStyles.confPillText, { color: CONFIDENCE_COLOR[predictionsQuery.data.confidence.label], fontFamily: 'Inter_500Medium' }]}>
                {CONFIDENCE_LABEL_AR[predictionsQuery.data.confidence.label]}
              </Text>
            </View>
            <Text style={[tabStyles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              احتمالات مبنية على سلوكك الفعلي
            </Text>
          </View>
          <View style={[tabStyles.probRow]}>
            <ProbBox label="تجاوز 50/30/20" value={predictionsQuery.data.overspending_probability} colors={colors} />
            <ProbBox label="شهر بعجز" value={predictionsQuery.data.deficit_probability} colors={colors} />
            <ProbBox label="ارتفاع الديون" value={predictionsQuery.data.debt_increase_probability} colors={colors} />
          </View>
          <Text style={[tabStyles.probFootnote, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            نسبة الأشهر الفعلية (من أصل {predictionsQuery.data.months_observed}) التي انطبق عليها كل مؤشر — وليست تنبؤًا احتماليًا مولّدًا بنموذج.
          </Text>
        </>
      )}

      {/* Real, evidence-backed behavioral patterns (GET /api/twin/:id/patterns) */}
      {patternsQuery.data && patternsQuery.data.length > 0 && (
        <>
          <Text style={[tabStyles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            أنماط سلوكية ملحوظة
          </Text>
          {patternsQuery.data.map((p, i) => (
            <View key={i} style={[tabStyles.trendCard, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }]}>
              <Ionicons name="analytics-outline" size={18} color={colors.primary} />
              <Text style={[tabStyles.summaryChange, { color: colors.foreground, fontFamily: 'Inter_400Regular', flex: 1, textAlign: 'right' }]}>
                {p.detail}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function ProbBox({ label, value, colors }: { label: string; value: number; colors: ReturnType<typeof useColors> }) {
  const pct = Math.round(value * 100);
  const color = pct >= 60 ? colors.destructive : pct >= 30 ? colors.warning : colors.accent;
  return (
    <View style={[tabStyles.probBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[tabStyles.probVal, { color, fontFamily: 'Inter_700Bold' }]}>{pct}%</Text>
      <Text style={[tabStyles.probLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{label}</Text>
    </View>
  );
}

// ─── Recommendations ─────────────────────────────────────────────────────────

function RecommendationsTab() {
  const colors = useColors();
  const { recommendations, behavioralTips } = useFinancialHealth();

  return (
    <View style={tabStyles.section}>
      {behavioralTips.length > 0 && (
        <>
          <Text style={[tabStyles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            نصائح سلوكية
          </Text>
          {behavioralTips.map(tip => (
            <View key={tip.id} style={[tabStyles.tipCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[tabStyles.tipIconWrap, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name={tip.icon as any} size={18} color={colors.primary} />
              </View>
              <View style={tabStyles.tipTextGroup}>
                <Text style={[tabStyles.tipTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                  {tip.title}
                </Text>
                <Text style={[tabStyles.tipDetail, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                  {tip.detail}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      <Text style={[tabStyles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        توصيات مخصصة لك
      </Text>
      {recommendations.map(rec => (
        <InsightCard key={rec.id} {...rec} />
      ))}
      {recommendations.length < 3 && (
        <View style={tabStyles.categoryNoteRow}>
          <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
          <Text style={[tabStyles.categoryNoteText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            توصيات إضافية (بطاقات، تمويل عقاري/سيارة، تمويل أعمال) تظهر فقط عند توفر إشارات حقيقية عليها من حسابك — لا نعرض توصية بدون أساس فعلي من بياناتك.
          </Text>
        </View>
      )}

      {/* Simulator CTA */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/financial-health/simulator')}
        style={[tabStyles.simulatorCTA, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}
      >
        <View style={tabStyles.simulatorCTALeft}>
          <Text style={[tabStyles.simulatorCTATitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            محاكي القرارات المالية
          </Text>
          <Text style={[tabStyles.simulatorCTADesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            اكتشف كيف تؤثر قراراتك على صحتك المالية
          </Text>
        </View>
        <Ionicons name="chevron-back" size={20} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FinancialHealthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);
  const tabBarRef = useRef<ScrollView>(null);
  const { recommendations } = useFinancialHealth();

  useEffect(() => {
    // ابدأ من اليمين (نظرة عامة) فور تحميل الصفحة
    setTimeout(() => tabBarRef.current?.scrollToEnd({ animated: false }), 0);
  }, []);

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 8;

  return (
    <>
      <View style={[styles.container, { backgroundColor: colors.background }]}>

        {/* ── Custom header ────────────────────────────────── */}
        <View style={[styles.customHeader, { paddingTop: insets.top + 42, backgroundColor: colors.background }]}>
          {/* Title + back */}
          <View style={styles.headerTitle}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.headerBtn, { backgroundColor: colors.card }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={19} color={colors.foreground} style={{ transform: [{ scaleX: -1 }] }} />
            </TouchableOpacity>
            <View style={[styles.headerIconBadge, { backgroundColor: colors.primary + '22' }]}>
              <Ionicons name="heart-outline" size={15} color={colors.primary} />
            </View>
            <Text style={[styles.headerTitleText, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              الصحة المالية
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push('/financial-health/goals')}
              style={[styles.headerBtn, { backgroundColor: colors.card }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="flag-outline" size={19} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/financial-health/reports')}
              style={[styles.headerBtn, { backgroundColor: colors.card }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="bar-chart-outline" size={19} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/financial-health/settings')}
              style={[styles.headerBtn, { backgroundColor: colors.card }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="settings-outline" size={19} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab bar — reversed array + scrollToEnd so نظرة عامة is on the right */}
        <ScrollView
          ref={tabBarRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabScrollView, { borderBottomColor: colors.border }]}
          contentContainerStyle={styles.tabBarContent}
        >
          {[...TAB_NAMES].reverse().map((tab, displayIdx) => {
            const i = TAB_NAMES.length - 1 - displayIdx;
            const isRec = i === TAB_NAMES.length - 1;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => setActiveTab(i)}
                style={[
                  styles.tabItem,
                  activeTab === i && [styles.activeTabItem, { borderBottomColor: colors.primary }],
                ]}
              >
                <View style={styles.tabInner}>
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: activeTab === i ? colors.primary : colors.mutedForeground,
                        fontFamily: activeTab === i ? 'Inter_600SemiBold' : 'Inter_400Regular',
                      },
                    ]}
                  >
                    {tab}
                  </Text>
                  {isRec && activeTab !== i && recommendations.length > 0 && (
                    <View style={[styles.tabBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.tabBadgeText}>{recommendations.length}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentInner, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 0 && <OverviewTab onSeeAll={() => setActiveTab(4)} />}
          {activeTab === 1 && <DigitalTwinTab />}
          {activeTab === 2 && <BehaviorTab />}
          {activeTab === 3 && <PredictionsTab />}
          {activeTab === 4 && <RecommendationsTab />}
        </ScrollView>
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  customHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  headerIconBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerTitleText: { fontSize: 18 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabScrollView: {
    flexGrow: 0,
    borderBottomWidth: 1,
  },
  tabBarContent: {
    paddingHorizontal: 16,
    gap: 4,
  },
  tabItem: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    letterSpacing: 0.1,
  },
  tabInner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  tabBadge: {
    minWidth: 17, height: 17, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },
  content: { flex: 1 },
  contentInner: { padding: 16, gap: 0 },
});

const tabStyles = StyleSheet.create({
  section: { gap: 12 },
  scoreWrap: { alignItems: 'center', paddingVertical: 20 },
  sectionTitle: { fontSize: 16, marginTop: 8, marginBottom: 2, textAlign: 'right' },
  sectionTitleRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  seeAll: { fontSize: 13 },
  metricsGrid: { gap: 10 },
  metricRow: { flexDirection: 'row', gap: 10 },
  // Archetype
  archetypeCard: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 8, alignItems: 'flex-end' },
  archetypeIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  archetypeLabel: { fontSize: 12, textAlign: 'right' },
  archetypeName: { fontSize: 22, textAlign: 'right' },
  archetypeDesc: { fontSize: 13, textAlign: 'right', lineHeight: 20 },
  evolutionRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  evolutionText: { fontSize: 11 },
  scorePill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-end' },
  scorePillText: { color: '#FFFFFF', fontSize: 12 },
  // Dimensions
  dimsCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 14 },
  dimRow: { gap: 6 },
  dimLabelRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  dimLabel: { fontSize: 13 },
  dimValue: { fontSize: 13 },
  dimTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  dimFill: { height: 6, borderRadius: 3 },
  // Strength/opportunity items
  strengthItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  strengthText: { flex: 1, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  strengthLabel: { fontSize: 14 },
  strengthValue: { fontSize: 14 },
  // Behavior
  summaryCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  summaryLabel: { fontSize: 12, textAlign: 'right' },
  summaryAmount: { fontSize: 26, textAlign: 'right' },
  summaryChangeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  summaryChange: { fontSize: 12 },
  categoriesCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 16 },
  categoryNoteRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 5, paddingHorizontal: 4 },
  categoryNoteText: { flex: 1, fontSize: 10, textAlign: 'right', lineHeight: 15 },
  tipCard: { flexDirection: 'row-reverse', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'flex-start' },
  tipIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tipTextGroup: { flex: 1, gap: 4 },
  tipTitle: { fontSize: 14, textAlign: 'right' },
  tipDetail: { fontSize: 12, textAlign: 'right', lineHeight: 18 },
  trendCard: { borderRadius: 14, borderWidth: 1, padding: 16 },
  trendBarsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 },
  monthBarWrap: { flex: 1, alignItems: 'center', gap: 4 },
  monthBarVal: { fontSize: 10 },
  monthBarFill: { width: '100%', borderRadius: 3, minHeight: 4 },
  monthBarLabel: { fontSize: 10 },
  // Predictions
  forecastCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  forecastHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  forecastMonth: { fontSize: 15 },
  confBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  confText: { fontSize: 11 },
  forecastBody: { flexDirection: 'row', alignItems: 'center' },
  forecastItem: { flex: 1, alignItems: 'center', gap: 4 },
  forecastVal: { fontSize: 18 },
  forecastLabel: { fontSize: 11, textAlign: 'center' },
  predictionsHeaderRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  confPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  confPillText: { fontSize: 11 },
  probRow: { flexDirection: 'row-reverse', gap: 8 },
  probBox: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4 },
  probVal: { fontSize: 20 },
  probLabel: { fontSize: 11, textAlign: 'center' },
  probFootnote: { fontSize: 10, textAlign: 'right', lineHeight: 15 },
  forecastDivider: { width: 1, height: 40 },
  yearCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  yearLabel: { fontSize: 12, textAlign: 'right' },
  yearAmount: { fontSize: 28, textAlign: 'right' },
  yearBar: { height: 10, borderRadius: 5, overflow: 'hidden' },
  yearFill: { height: 10, borderRadius: 5 },
  yearProgress: { fontSize: 12, textAlign: 'right' },
  milestoneCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  milestoneTitleRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  milestoneTitle: { fontSize: 14 },
  milestoneDate: { fontSize: 12 },
  milestoneTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  milestoneFill: { height: 6, borderRadius: 3 },
  milestonePct: { fontSize: 12, textAlign: 'left' },
  // Recommendations
  simulatorCTA: { borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginTop: 8 },
  simulatorCTALeft: { flex: 1, gap: 4 },
  simulatorCTATitle: { fontSize: 15, textAlign: 'right' },
  simulatorCTADesc: { fontSize: 13, textAlign: 'right' },
});
