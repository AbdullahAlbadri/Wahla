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
import { RiyalSymbol } from '@/components/RiyalSymbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Polyline, Defs, LinearGradient as SvgLinearGradient, RadialGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
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

              {/* Ideal badge */}
              <View style={[bd.idealBadge, { backgroundColor: over ? colors.primary + '25' : colors.accent + '18' }]}>
                <Text style={[bd.idealText, { color: over ? colors.primary : colors.accent, fontFamily: 'Inter_500Medium' }]}>
                  {over ? `↑${seg.pct - seg.ideal}%` : `مثالي ${seg.ideal}%`}
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

// ─── Metrics Line Chart ──────────────────────────────────────────────────────

const CHART_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'];

// Built from real Twin values each render — no fabricated history. `data`
// is the real current value repeated (a flat line), since no historical
// series exists on the backend yet; this is honest (claims no trend)
// while keeping the existing chart math (which needs >=2 points) intact.
function useMetricDefs() {
  const { savingsRate, debtRatio, budgetSegments } = useFinancialHealth();
  const needs = budgetSegments.find(s => s.id === 'needs');
  const wants = budgetSegments.find(s => s.id === 'wants');
  const adherence = needs && wants
    ? Math.max(0, Math.min(100, 100 - Math.abs(needs.pct - needs.ideal) - Math.abs(wants.pct - wants.ideal)))
    : 0;
  const savingsPct = Math.round(savingsRate * 100);
  const debtPct = Math.round(debtRatio * 100);

  return [
    {
      id: 'savings',
      label: 'معدل الادخار',
      icon: 'wallet-outline' as const,
      current: `${savingsPct}%`,
      positive: savingsPct >= 20,
      color: '#9AB4D6',
      data: [savingsPct, savingsPct, savingsPct, savingsPct, savingsPct, savingsPct],
      ideal: '20%',
      description: 'معدل الادخار يقيس نسبة ما تدخره من إجمالي دخلك الشهري. كلما ارتفع هذا المعدل كلما زادت قدرتك على مواجهة الطوارئ وتحقيق أهدافك المالية بعيدة المدى.',
      status: savingsPct >= 20 ? 'جيد — أنت في المسار الصحيح.' : 'أقل من الهدف المثالي — يمكن تحسينه تدريجيًا.',
      tip: 'تحويل مبلغ إضافي بشكل تلقائي كل شهر يقرّبك من الهدف المثالي بثبات.',
    },
    {
      id: 'debt',
      label: 'نسبة الديون',
      icon: 'trending-down-outline' as const,
      current: `${debtPct}%`,
      positive: debtPct < 30,
      color: '#9AB4D6',
      data: [debtPct, debtPct, debtPct, debtPct, debtPct, debtPct],
      ideal: '< 30%',
      description: 'نسبة الديون هي مقارنة بين إجمالي التزاماتك الشهرية ودخلك. النسبة الصحية أقل من 30%، وكلما انخفضت كلما كانت صحتك المالية أفضل.',
      status: debtPct < 30 ? 'جيد — ضمن النسبة الصحية.' : 'مقبول — لكن يمكن تحسينه.',
      tip: 'سداد قسط إضافي كلما أمكن يخفض هذه النسبة تدريجيًا.',
    },
    {
      id: 'efficiency',
      label: 'التوافق مع 50/30/20',
      icon: 'analytics-outline' as const,
      current: `${Math.round(adherence)}%`,
      positive: adherence >= 70,
      color: '#9AB4D6',
      data: [adherence, adherence, adherence, adherence, adherence, adherence],
      ideal: '100%',
      description: 'يقيس مدى قرب توزيع إنفاقك الفعلي (احتياجات/رغبات/ادخار) من قاعدة 50/30/20 المثالية.',
      status: adherence >= 70 ? 'جيد — توزيعك قريب من القاعدة المثالية.' : 'هناك انحراف ملحوظ عن القاعدة المثالية.',
      tip: 'مراجعة قسم "الميزانية" يوضح بالضبط أي فئة تحتاج تعديلًا.',
    },
  ];
}

function buildLinePath(data: number[], w: number, h: number, pad = 16): string {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: h - pad - ((v - min) / range) * (h - pad * 2),
  }));
  // smooth bezier
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) / 3;
    const cp2x = pts[i].x - (pts[i].x - pts[i - 1].x) / 3;
    d += ` C ${cp1x} ${pts[i - 1].y} ${cp2x} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

function buildFillPath(data: number[], w: number, h: number, pad = 16): string {
  const line = buildLinePath(data, w, h, pad);
  const lastX = pad + (w - pad * 2);
  return `${line} L ${lastX} ${h - pad} L ${pad} ${h - pad} Z`;
}

const CHART_W = 340;
const CHART_H = 130;
const CHART_PAD = 20;

function MetricsChart() {
  const colors = useColors();
  const [activeId, setActiveId] = useState('savings');
  const [expanded, setExpanded] = useState(false);
  const METRIC_DEFS = useMetricDefs();

  const metric = METRIC_DEFS.find(m => m.id === activeId)!;
  const min = Math.min(...metric.data);
  const max = Math.max(...metric.data);
  const range = max - min || 1;
  const pts = metric.data.map((v, i) => ({
    x: CHART_PAD + (i / (metric.data.length - 1)) * (CHART_W - CHART_PAD * 2),
    y: CHART_H - CHART_PAD - ((v - min) / range) * (CHART_H - CHART_PAD * 2),
    v,
  }));
  const linePath = buildLinePath(metric.data, CHART_W, CHART_H, CHART_PAD);
  const fillPath = buildFillPath(metric.data, CHART_W, CHART_H, CHART_PAD);

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

        {/* SVG line chart */}
        <Svg width={CHART_W} height={CHART_H}>
          <Defs>
            <SvgLinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#E07A5F" stopOpacity={0.3} />
              <Stop offset="100%" stopColor="#E07A5F" stopOpacity={0.0} />
            </SvgLinearGradient>
          </Defs>
          {/* Fill */}
          <Path d={fillPath} fill="url(#lineGrad)" />
          {/* Line */}
          <Path d={linePath} stroke="#E07A5F" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {/* Dots */}
          {pts.map((pt, i) => (
            <Circle key={i} cx={pt.x} cy={pt.y} r={i === pts.length - 1 ? 5 : 3} fill="#E07A5F" />
          ))}
          {/* X labels */}
          {pts.map((pt, i) => (
            <SvgText
              key={`lbl-${i}`}
              x={pt.x}
              y={CHART_H - 2}
              fontSize={8}
              fill={colors.mutedForeground}
              textAnchor="middle"
            >
              {CHART_MONTHS[i].slice(0, 3)}
            </SvgText>
          ))}
        </Svg>

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

            <View style={[mc.statusBadge, { backgroundColor: metric.color + '15' }]}>
              <Text style={[mc.statusText, { color: metric.color, fontFamily: 'Inter_500Medium' }]}>
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

function FeaturedRecommendation({ onSeeAll: _ }: { onSeeAll: () => void }) {
  const { monthlyExpenses } = useFinancialHealth();
  const lostMonthly = Math.round(monthlyExpenses * 0.02);

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
          <Text style={[fr.tagText, { fontFamily: 'Inter_700Bold' }]}>فرصة ضائعة</Text>
        </View>
      </View>

      {/* ── الرقم الكبير ── */}
      <View style={fr.numberBlock}>
        <Text style={[fr.numberSub, { fontFamily: 'Inter_400Regular' }]}>كل شهر تخسر دون أن تشعر</Text>
        <View style={fr.numberRow}>
          <Text style={[fr.numberBig, { fontFamily: 'Inter_700Bold' }]}>
            {lostMonthly.toLocaleString('en-US')}
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

      {/* ── Body ── */}
      <Text style={[fr.body, { fontFamily: 'Inter_400Regular' }]}>
        إنفاقك بالمدى لا يعود عليك بشيء — وكان يمكن أن يفعل.
      </Text>

      {/* ── Solution box ── */}
      <View style={fr.solutionBox}>
        <View style={fr.solutionTexts}>
          <Text style={[fr.solutionName, { fontFamily: 'Inter_700Bold' }]}>بطاقة علينا المميزة</Text>
          <Text style={[fr.solutionDesc, { fontFamily: 'Inter_400Regular' }]}>
            تحوّل إنفاقك إلى مبلغ تسترده
          </Text>
        </View>
        <View style={fr.productIcon}>
          <Ionicons name="card-outline" size={20} color="#E07A5F" />
        </View>
      </View>

      {/* ── CTA ── */}
      <TouchableOpacity activeOpacity={0.85} style={fr.ctaBtn}>
        <Ionicons name="chevron-back-outline" size={14} color="#112236" />
        <Text style={[fr.ctaText, { fontFamily: 'Inter_700Bold' }]}>أصدر بطاقتك الآن</Text>
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
        <Text style={[tabStyles.dimValue, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
          {dim.value}
        </Text>
        <Text style={[tabStyles.dimLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          {dim.label}
        </Text>
      </View>
      <View style={[tabStyles.dimTrack, { backgroundColor: colors.border }]}>
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

  const sorted = [...dimensions].sort((a, b) => b.value - a.value);
  const strengths = sorted.slice(0, 2);
  const opportunities = sorted.slice(-2);

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

      {/* Monthly trend — no historical series exists on the backend yet;
          honest empty-state instead of a fabricated chart. */}
      <Text style={[tabStyles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        اتجاه الإنفاق الشهري
      </Text>
      <View style={[tabStyles.trendCard, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center', gap: 8, paddingVertical: 24 }]}>
        <Ionicons name="stats-chart-outline" size={24} color={colors.mutedForeground} />
        <Text style={[tabStyles.summaryChange, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' }]}>
          سيتوفر عرض الاتجاه الشهري عند تجميع بيانات كافية عبر الوقت
        </Text>
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
function PredictionsTab() {
  const colors = useColors();
  const { forecast, currentBalance, lastUpdated } = useFinancialHealth();

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
    </View>
  );
}

// ─── Recommendations ─────────────────────────────────────────────────────────

function RecommendationsTab() {
  const colors = useColors();
  const { recommendations } = useFinancialHealth();

  return (
    <View style={tabStyles.section}>
      <Text style={[tabStyles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        توصيات مخصصة لك
      </Text>
      {recommendations.map(rec => (
        <InsightCard key={rec.id} {...rec} />
      ))}

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
              <Ionicons name="chevron-forward" size={19} color={colors.foreground} />
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
                  {isRec && activeTab !== i && (
                    <View style={[styles.tabBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.tabBadgeText}>3</Text>
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
