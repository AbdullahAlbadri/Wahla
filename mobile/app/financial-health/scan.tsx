import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RiyalSymbol } from '@/components/RiyalSymbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useFinancialHealth } from '@/context/FinancialHealthContext';
import { ACCOUNT_ID, checkDecision, simulateDecision, verdictLabels } from '@/lib/api';

// ─── Mock AI result (what a real AI would extract) ──────────────────────────

const MOCK_RESULT = {
  product: 'آيفون 16 برو ماكس 256GB',
  price: 5299,
  store: 'Apple Store',
  category: 'إلكترونيات',
  hasInstallment: true,
  monthlyInstallment: 883,
  installmentMonths: 6,
  totalInstallment: 5298,
  confidence: 94,
};

const SCAN_STEPS = [
  'جاري قراءة الصورة...',
  'تحديد المنتج والسعر...',
  'تحليل الوضع المالي...',
  'إعداد التقرير...',
];

type Phase = 'idle' | 'scanning' | 'done';

// ─── Idle ────────────────────────────────────────────────────────────────────

function IdleState({ onPick, colors }: { onPick: () => void; colors: ReturnType<typeof useColors> }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={idle.container}>
      {/* Hero */}
      <View style={idle.hero}>
        <Animated.View
          style={[
            idle.iconRing,
            { borderColor: colors.primary + '44', transform: [{ scale: pulseAnim }] },
          ]}
        >
          <View style={[idle.iconInner, { backgroundColor: colors.primary + '22' }]}>
            <Ionicons name="scan-outline" size={48} color={colors.primary} />
          </View>
        </Animated.View>

        <Text style={[idle.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
          تحليل قرار الشراء
        </Text>
        <Text style={[idle.subtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          التقط لقطة شاشة من موقع تسوق أو تطبيق، شاركها هنا وسيحللها المحاكي ويخبرك بأثرها على صحتك المالية
        </Text>
      </View>

      {/* Upload zone */}
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPick}
        style={[idle.uploadZone, { borderColor: colors.primary + '55', backgroundColor: colors.primary + '0A' }]}
      >
        <Ionicons name="image-outline" size={32} color={colors.primary} />
        <Text style={[idle.uploadText, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
          اختر صورة من المعرض
        </Text>
        <Text style={[idle.uploadHint, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          PNG · JPG · لقطة شاشة
        </Text>
      </TouchableOpacity>

      {/* Examples */}
      <View style={idle.examplesRow}>
        <Text style={[idle.examplesLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          يعمل مع:
        </Text>
        {['أمازون', 'نون', 'متاجر إلكترونية', 'إعلانات'].map(ex => (
          <View key={ex} style={[idle.tag, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[idle.tagText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              {ex}
            </Text>
          </View>
        ))}
      </View>

      {/* How it works */}
      <View style={[idle.stepsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[idle.stepsTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
          كيف يعمل؟
        </Text>
        {[
          { icon: 'camera-outline', text: 'التقط صورة لصفحة المنتج أو العرض' },
          { icon: 'scan-outline', text: 'يقرأ المحاكي السعر والتفاصيل تلقائياً' },
          { icon: 'analytics-outline', text: 'يحلل الأثر على ميزانيتك الشهرية' },
          { icon: 'checkmark-circle-outline', text: 'تحصل على توصية مالية فورية' },
        ].map((step, i) => (
          <View key={i} style={idle.stepRow}>
            <Text style={[idle.stepNum, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>
              {i + 1}
            </Text>
            <Ionicons name={step.icon as any} size={18} color={colors.primary} />
            <Text style={[idle.stepText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              {step.text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const idle = StyleSheet.create({
  container: { gap: 20 },
  hero: { alignItems: 'center', gap: 12, paddingTop: 8 },
  iconRing: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  iconInner: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, textAlign: 'center' },
  subtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  uploadZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  uploadText: { fontSize: 16 },
  uploadHint: { fontSize: 12 },
  examplesRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, alignItems: 'center' },
  examplesLabel: { fontSize: 12 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  tagText: { fontSize: 12 },
  stepsCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  stepsTitle: { fontSize: 14, textAlign: 'right' },
  stepRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  stepNum: { fontSize: 13, width: 18, textAlign: 'center' },
  stepText: { flex: 1, fontSize: 13, textAlign: 'right', lineHeight: 18 },
});

// ─── Scanning ────────────────────────────────────────────────────────────────

function ScanningState({
  imageUri,
  scanStep,
  colors,
}: {
  imageUri: string;
  scanStep: number;
  colors: ReturnType<typeof useColors>;
}) {
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(scanLineAnim, { toValue: 1, duration: 1600, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const IMAGE_H = 240;
  const scanTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-IMAGE_H / 2, IMAGE_H / 2],
  });

  const progress = Math.min(scanStep / SCAN_STEPS.length, 1);

  return (
    <View style={scan.container}>
      <Text style={[scan.heading, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
        جاري تحليل الصورة
      </Text>

      {/* Image with scan overlay */}
      <View style={[scan.imageWrap, { borderColor: colors.primary, height: IMAGE_H }]}>
        <Image source={{ uri: imageUri }} style={scan.image} resizeMode="cover" />

        {/* Dark overlay */}
        <View style={[scan.overlay, { backgroundColor: '#000000AA' }]} />

        {/* Corner brackets */}
        {[
          { top: 8, right: 8 },
          { top: 8, left: 8 },
          { bottom: 8, right: 8 },
          { bottom: 8, left: 8 },
        ].map((pos, i) => (
          <Animated.View
            key={i}
            style={[scan.corner, pos, { borderColor: colors.primary, opacity: glowAnim }]}
          />
        ))}

        {/* Scan line */}
        <Animated.View
          style={[
            scan.scanLine,
            { backgroundColor: colors.primary, transform: [{ translateY: scanTranslate }] },
          ]}
        />

        {/* Step label overlay */}
        <View style={scan.stepBadge}>
          <View style={[scan.stepBadgeInner, { backgroundColor: colors.primary }]}>
            <Ionicons name="scan-outline" size={14} color="#FFFFFF" />
            <Text style={[scan.stepBadgeText, { fontFamily: 'Inter_600SemiBold' }]}>
              {SCAN_STEPS[Math.min(scanStep, SCAN_STEPS.length - 1)]}
            </Text>
          </View>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[scan.progressTrack, { backgroundColor: colors.border, transform: [{ scaleX: -1 }] }]}>
        <Animated.View
          style={[scan.progressFill, { backgroundColor: colors.primary, width: `${progress * 100}%` as any }]}
        />
      </View>

      {/* Step list */}
      <View style={[scan.stepsList, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {SCAN_STEPS.map((step, i) => {
          const done = i < scanStep;
          const active = i === scanStep;
          return (
            <View key={i} style={scan.stepItem}>
              <View style={[
                scan.stepIcon,
                {
                  backgroundColor: done ? colors.accent : active ? colors.primary + '22' : colors.muted,
                },
              ]}>
                {done
                  ? <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                  : active
                  ? <Animated.View style={{ opacity: glowAnim }}>
                      <Ionicons name="ellipse" size={8} color={colors.primary} />
                    </Animated.View>
                  : <View style={[scan.stepDot, { backgroundColor: colors.border }]} />
                }
              </View>
              <Text style={[scan.stepText, {
                color: done ? colors.accent : active ? colors.foreground : colors.mutedForeground,
                fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
              }]}>
                {step}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const scan = StyleSheet.create({
  container: { gap: 18, alignItems: 'center' },
  heading: { fontSize: 20, textAlign: 'center' },
  imageWrap: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  image: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderWidth: 3,
  },
  scanLine: { width: '100%', height: 2, opacity: 0.9 },
  stepBadge: { position: 'absolute', bottom: 12 },
  stepBadgeInner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  stepBadgeText: { color: '#FFFFFF', fontSize: 12 },
  progressTrack: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  stepsList: { width: '100%', borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  stepItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  stepIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepDot: { width: 8, height: 8, borderRadius: 4 },
  stepText: { fontSize: 13, flex: 1, textAlign: 'right' },
});

// ─── Results ─────────────────────────────────────────────────────────────────

function ResultState({
  imageUri,
  monthlySavings,
  colors,
}: {
  imageUri: string;
  monthlySavings: number;
  colors: ReturnType<typeof useColors>;
}) {
  const r = MOCK_RESULT;

  // Product/price extraction stays mocked (no OCR/vision capability exists
  // in the backend) — but once we have a price, the feasibility verdict is
  // real, from the actual decision engine.
  const decisionCheckQuery = useQuery({
    queryKey: ['decision-check', r.price],
    queryFn: () => checkDecision(ACCOUNT_ID, { is_need: false, amount: r.price, can_pay_installments: false }),
  });
  const simInstallmentQuery = useQuery({
    queryKey: ['simulate-installment', r.monthlyInstallment, r.installmentMonths],
    queryFn: () =>
      simulateDecision(ACCOUNT_ID, {
        type: 'installment',
        monthly: r.monthlyInstallment,
        months: r.installmentMonths,
        hasDownPayment: false,
      }),
    enabled: r.hasInstallment,
  });

  const isLoading = decisionCheckQuery.isLoading || (r.hasInstallment && simInstallmentQuery.isLoading);
  const isError = decisionCheckQuery.isError || (r.hasInstallment && simInstallmentQuery.isError);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isLoading) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, [isLoading]);

  const cashFeasible = decisionCheckQuery.data?.allow ?? false;
  const cashNote = decisionCheckQuery.data?.reason ?? '';
  // Signed, not clamped to 0 — clamping made a negative balance display as
  // "0" or a vague "عجز" tag that could contradict the real feasible flag
  // above it (e.g. allow:true from the budget-discipline check while the
  // raw cash-on-hand comparison is negative). Showing the real number for
  // both avoids that contradiction.
  const surplusAfterCash = monthlySavings - r.price;

  const simResult = simInstallmentQuery.data;
  const installmentFeasible = simResult ? (simResult.verdict === 'safe' || simResult.verdict === 'caution') : false;
  const surplusAfterInstallment = simResult ? (simResult.after.net_cashflow as number) : 0;
  const installmentNote = simResult
    ? (installmentFeasible ? 'يبقى وضعك مستقراً' : 'يضغط على ميزانيتك')
    : '';
  const surplusUsagePct = monthlySavings > 0
    ? Math.min(100, Math.round((r.monthlyInstallment / monthlySavings) * 100))
    : 0;
  // Composed from the real, already-translated verdict enum instead of
  // rendering simResult.explanation directly — that field is generated in
  // English by the backend (twin/explain.py) and was leaking untranslated
  // into this Arabic screen.
  const recommendationText = simResult
    ? (verdictLabels[simResult.verdict]?.sub ?? cashNote)
    : cashNote;

  return (
    <Animated.View style={[result.container, { opacity: fadeAnim }]}>
      {/* Header */}
      <View style={result.titleRow}>
        <View style={[result.aiTag, { backgroundColor: colors.primary + '22', borderColor: colors.primary + '44' }]}>
          <Ionicons name="flash-outline" size={12} color={colors.primary} />
          <Text style={[result.aiTagText, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
            تحليل بالذكاء الاصطناعي
          </Text>
        </View>
        <Text style={[result.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
          نتيجة التحليل
        </Text>
      </View>

      {/* Detected product */}
      <View style={[result.productCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={result.productHeader}>
          <View style={[result.confBadge, { backgroundColor: colors.accent + '22' }]}>
            <Text style={[result.confText, { color: colors.accent, fontFamily: 'Inter_600SemiBold' }]}>
              دقة {r.confidence}%
            </Text>
          </View>
          <Text style={[result.productCardTitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            ما تم اكتشافه
          </Text>
        </View>

        <View style={[result.productImageWrap, { borderColor: colors.border }]}>
          <Image source={{ uri: imageUri }} style={result.productThumb} resizeMode="cover" />
          <View style={[result.productThumbOverlay, { backgroundColor: '#00000055' }]}>
            <Ionicons name="scan" size={18} color="#FFFFFF" />
          </View>
        </View>

        <View style={[result.productDivider, { backgroundColor: colors.border }]} />

        <ResultRow label="المنتج" value={r.product} colors={colors} />
        <ResultRow label="السعر" value={`${r.price.toLocaleString('en-US')} ريال`} bold colors={colors} />
        <ResultRow label="المتجر" value={r.store} colors={colors} />
        <ResultRow label="الفئة" value={r.category} colors={colors} />
        {r.hasInstallment && (
          <ResultRow
            label="التقسيط"
            value={`${r.monthlyInstallment.toLocaleString('en-US')} ريال × ${r.installmentMonths} أشهر`}
            colors={colors}
          />
        )}
      </View>

      {/* Verdict cards — real decision-check / simulate results */}
      <Text style={[result.sectionLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        تقييم القرار
      </Text>
      {isLoading ? (
        <View style={[result.impactCard, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center' }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={[result.impactCard, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center', gap: 8 }]}>
          <Text style={[result.recText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' }]}>
            تعذر تحليل الأثر المالي، حاول مجددًا
          </Text>
          <TouchableOpacity onPress={() => { decisionCheckQuery.refetch(); simInstallmentQuery.refetch(); }}>
            <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={result.verdictRow}>
            <VerdictCard
              title="شراء نقداً"
              feasible={cashFeasible}
              surplus={surplusAfterCash}
              note={cashNote}
              colors={colors}
            />
            {r.hasInstallment && (
              <VerdictCard
                title="تقسيط"
                feasible={installmentFeasible}
                surplus={surplusAfterInstallment}
                note={installmentNote}
                colors={colors}
                recommended
              />
            )}
          </View>

          {/* Budget impact */}
          <Text style={[result.sectionLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            الأثر على ميزانيتك
          </Text>
          <View style={[result.impactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ImpactRow label={monthlySavings < 0 ? 'العجز الحالي' : 'الفائض الحالي'} value={`${monthlySavings.toLocaleString('en-US')} ريال`} colors={colors} />
            <ImpactRow
              label={surplusAfterInstallment < 0 ? 'العجز بعد التقسيط' : 'الفائض بعد التقسيط'}
              value={`${Math.round(surplusAfterInstallment).toLocaleString('en-US')} ريال`}
              colors={colors}
              highlight={!installmentFeasible}
            />
            <View style={result.barWrap}>
              <View style={[result.barTrack, { backgroundColor: colors.border, transform: [{ scaleX: -1 }] }]}>
                <View style={[result.barFill, { width: `${surplusUsagePct}%` as any, backgroundColor: surplusUsagePct > 70 ? colors.warning : colors.primary }]} />
              </View>
              <Text style={[result.barLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                {surplusUsagePct}% من فائضك الشهري يذهب للتقسيط
              </Text>
            </View>
          </View>

          {/* AI Recommendation — real explanation from decision-check/simulate */}
          <View style={[result.recCard, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '33' }]}>
            <View style={result.recHeader}>
              <Ionicons name="flash-outline" size={16} color={colors.primary} />
              <Text style={[result.recTitle, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
                توصية توأمك الرقمي
              </Text>
            </View>
            <Text style={[result.recText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>
              {recommendationText}
            </Text>
          </View>
        </>
      )}

      {/* CTA */}
      <TouchableOpacity
        style={[result.primaryBtn, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
        onPress={() => router.push('/financial-health/simulator')}
      >
        <Ionicons name="flask-outline" size={18} color="#FFFFFF" />
        <Text style={[result.primaryBtnText, { fontFamily: 'Inter_700Bold' }]}>جرّب في المحاكي التفصيلي</Text>
      </TouchableOpacity>

      <TouchableOpacity style={result.retryBtn} onPress={() => router.back()}>
        <Text style={[result.retryText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          تحليل صورة أخرى
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ResultRow({ label, value, bold, colors }: { label: string; value: string; bold?: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={rr.row}>
      <Text style={[rr.val, { color: colors.foreground, fontFamily: bold ? 'Inter_700Bold' : 'Inter_400Regular' }]}>{value}</Text>
      <Text style={[rr.label, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{label}</Text>
    </View>
  );
}
const rr = StyleSheet.create({
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 12 },
  val: { fontSize: 14 },
});

function ImpactRow({ label, value, highlight, colors }: { label: string; value: string; highlight?: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={ir.row}>
      <Text style={[ir.val, { color: highlight ? colors.destructive : colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>{value}</Text>
      <Text style={[ir.label, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{label}</Text>
    </View>
  );
}
const ir = StyleSheet.create({
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13 },
  val: { fontSize: 16 },
});

function VerdictCard({ title, feasible, surplus, note, recommended, colors }: {
  title: string; feasible: boolean; surplus: number; note: string; recommended?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const bg = feasible ? colors.accent + '15' : colors.destructive + '12';
  const border = feasible ? colors.accent + '35' : colors.destructive + '28';
  const iconName = feasible ? 'checkmark-circle-outline' : 'close-circle-outline';
  const iconColor = feasible ? colors.accent : colors.destructive;
  return (
    <View style={[vc.card, { backgroundColor: bg, borderColor: border }]}>
      {recommended && (
        <View style={[vc.recBadge, { backgroundColor: colors.primary }]}>
          <Text style={[vc.recBadgeText, { fontFamily: 'Inter_700Bold' }]}>موصى</Text>
        </View>
      )}
      <Ionicons name={iconName as any} size={24} color={iconColor} />
      <Text style={[vc.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>{title}</Text>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 3 }}>
        <Text style={[vc.surplus, { color: feasible ? colors.accent : colors.destructive, fontFamily: 'Inter_600SemiBold' }]}>
          {surplus < 0 ? '-' : ''}{Math.round(Math.abs(surplus)).toLocaleString('en-US')}
        </Text>
        <RiyalSymbol size={14} color={feasible ? colors.accent : colors.destructive} />
      </View>
      <Text style={[vc.note, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{note}</Text>
    </View>
  );
}
const vc = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 6, position: 'relative', overflow: 'hidden' },
  recBadge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  recBadgeText: { color: '#FFFFFF', fontSize: 10 },
  title: { fontSize: 14 },
  surplus: { fontSize: 18 },
  note: { fontSize: 11, textAlign: 'center' },
});

const result = StyleSheet.create({
  container: { gap: 14 },
  titleRow: { alignItems: 'flex-end', gap: 6 },
  title: { fontSize: 22 },
  aiTag: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  aiTagText: { fontSize: 11 },
  productCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  productHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  productCardTitle: { fontSize: 12 },
  confBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  confText: { fontSize: 11 },
  productImageWrap: { borderRadius: 10, borderWidth: 1, overflow: 'hidden', height: 90 },
  productThumb: { width: '100%', height: '100%' },
  productThumbOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  productDivider: { height: 1 },
  sectionLabel: { fontSize: 15, textAlign: 'right' },
  verdictRow: { flexDirection: 'row', gap: 10 },
  impactCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  barWrap: { gap: 6 },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barLabel: { fontSize: 12, textAlign: 'right' },
  recCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  recHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  recTitle: { fontSize: 14 },
  recText: { fontSize: 13, textAlign: 'right', lineHeight: 21 },
  primaryBtn: { borderRadius: 16, paddingVertical: 17, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'center', gap: 8 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16 },
  retryBtn: { alignItems: 'center', paddingVertical: 4 },
  retryText: { fontSize: 14 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { monthlySavings } = useFinancialHealth();

  const [phase, setPhase] = useState<Phase>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [scanStep, setScanStep] = useState(0);

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 8;

  const startScanning = (uri: string) => {
    setImageUri(uri);
    setPhase('scanning');
    setScanStep(0);

    // Animate through steps
    SCAN_STEPS.forEach((_, i) => {
      setTimeout(() => {
        setScanStep(i + 1);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (i === SCAN_STEPS.length - 1) {
          setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setPhase('done');
          }, 500);
        }
      }, i * 800 + 400);
    });
  };

  const pickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });

    if (!res.canceled && res.assets[0]) {
      startScanning(res.assets[0].uri);
    }
  };

  return (
    <ScrollView
      style={[main.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[main.content, { paddingBottom: bottomPad + 28 }]}
      showsVerticalScrollIndicator={false}
    >
      {phase === 'idle' && <IdleState onPick={pickImage} colors={colors} />}
      {phase === 'scanning' && imageUri && (
        <ScanningState imageUri={imageUri} scanStep={scanStep} colors={colors} />
      )}
      {phase === 'done' && imageUri && (
        <ResultState imageUri={imageUri} monthlySavings={monthlySavings} colors={colors} />
      )}
    </ScrollView>
  );
}

const main = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 20 },
});
