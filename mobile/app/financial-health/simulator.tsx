import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ACCOUNT_ID,
  attributeLabels,
  COMMITMENT_TYPE_TO_API,
  fetchAlternatives,
  reasonLabels,
  riskLabels,
  simulateDecision,
  verdictLabels,
  type AlternativesResult,
} from '@/lib/api';
import { useFinancialHealth } from '@/context/FinancialHealthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type CommitmentType = 'loan' | 'installment' | 'deferred' | 'subscription';
type DurationOption = 2 | 3 | 4 | 6 | 12 | 18 | 24;
type TimelinePeriod = 3 | 6 | 12;

const COMMITMENT_TYPES: { id: CommitmentType; label: string; sub: string; icon: string }[] = [
  { id: 'loan', label: 'قرض', sub: 'اختبر أثر قسط تمويلي جديد', icon: 'wallet-outline' },
  { id: 'installment', label: 'شراء بالتقسيط', sub: 'اعرف أثر المشتريات المقسطة', icon: 'bag-outline' },
  { id: 'deferred', label: 'دفع آجل', sub: 'راجع أثر الدفعات القادمة', icon: 'time-outline' },
  { id: 'subscription', label: 'اشتراك جديد', sub: 'اختبر التزام شهري متكرر', icon: 'repeat-outline' },
];

const DURATION_OPTIONS: DurationOption[] = [3, 6, 12, 18];
const durationLabel = (d: number) => `${d} ${d === 1 ? 'شهر' : 'أشهر'}`;

// BNPL is a short, fixed number of installments (Tabby/Tamara-style),
// not an open-ended monthly commitment — a different, smaller option set
// than DURATION_OPTIONS on purpose.
const INSTALLMENT_OPTIONS: DurationOption[] = [2, 3, 4, 6];
const installmentLabel = (n: number) => `${n} دفعات`;

// No native date-picker package is used here — @react-native-community/
// datetimepicker has no web implementation, and this app explicitly ships
// a web target (`start:web`). A month-pill selector matches the existing
// duration-pill pattern, works identically on every platform, and is all
// that's needed for "which month does a recurring commitment start."
const START_MONTH_OPTIONS = [0, 1, 2, 3] as const;
const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
function startMonthLabel(offset: number): string {
  if (offset === 0) return 'هذا الشهر';
  if (offset === 1) return 'الشهر القادم';
  return `بعد ${offset} أشهر`;
}
function calendarMonthLabel(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${MONTH_NAMES_AR[d.getMonth()]} ${d.getFullYear()}`;
}

// BNPL is a schedule of real dated installments, not an abstract duration —
// each payment lands in its own calendar month starting at startOffset.
// Month-level only (no day-of-month claim): the Twin's data doesn't carry
// per-payment due dates, only monthly cadence.
function installmentDueDates(startOffset: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => calendarMonthLabel(startOffset + i));
}

// Sane bounds for a monthly commitment amount — rejects negative/zero and
// absurdly large values before they ever reach the simulation API.
const MIN_AMOUNT = 50;
const MAX_AMOUNT = 500_000;

// ─── Step 1 — Choose type ─────────────────────────────────────────────────────

function Step1({
  selected,
  onSelect,
  onNext,
  colors,
}: {
  selected: CommitmentType;
  onSelect: (t: CommitmentType) => void;
  onNext: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={s1.container}>
      {/* Title */}
      <View style={s1.titleBlock}>
        <Text style={[s1.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>جرّب قرارك</Text>
        <Text style={[s1.subtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          اختر نوع الالتزام
        </Text>
      </View>

      {/* Options */}
      <View style={s1.optionsList}>
        {COMMITMENT_TYPES.map(item => {
          const active = selected === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.75}
              onPress={() => { onSelect(item.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[
                s1.option,
                {
                  backgroundColor: active ? colors.primary + '18' : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              {/* Radio */}
              <View style={[s1.radio, { borderColor: active ? colors.primary : colors.border }]}>
                {active && <View style={[s1.radioFill, { backgroundColor: colors.primary }]} />}
              </View>

              {/* Text */}
              <View style={s1.optionText}>
                <Text style={[s1.optionLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                  {item.label}
                </Text>
                <Text style={[s1.optionSub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                  {item.sub}
                </Text>
              </View>

              {/* Icon */}
              <View style={[s1.iconWrap, { backgroundColor: active ? colors.primary + '22' : colors.muted }]}>
                <Ionicons name={item.icon as any} size={22} color={active ? colors.primary : colors.mutedForeground} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={[s1.primaryBtn, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
        onPress={onNext}
      >
        <Text style={[s1.primaryBtnText, { fontFamily: 'Inter_700Bold' }]}>متابعة</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={s1.backLink}>
        <Text style={[s1.backLinkText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          العودة للرئيسية
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const s1 = StyleSheet.create({
  container: { gap: 18 },
  titleBlock: { alignItems: 'flex-end', gap: 4 },
  title: { fontSize: 24 },
  subtitle: { fontSize: 13 },
  optionsList: { gap: 10 },
  option: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioFill: { width: 10, height: 10, borderRadius: 5 },
  optionText: { flex: 1, alignItems: 'flex-end', gap: 2 },
  optionLabel: { fontSize: 14 },
  optionSub: { fontSize: 11 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16 },
  backLink: { alignItems: 'center', paddingVertical: 4 },
  backLinkText: { fontSize: 14 },
});

// ─── Step 2 — Decision details ────────────────────────────────────────────────

function Step2({
  type,
  amount,
  setAmount,
  duration,
  setDuration,
  hasDownPayment,
  setHasDownPayment,
  downPaymentAmount,
  setDownPaymentAmount,
  hasFinalPayment,
  setHasFinalPayment,
  finalPaymentAmount,
  setFinalPaymentAmount,
  startOffset,
  setStartOffset,
  onBack,
  onNext,
  colors,
}: {
  type: CommitmentType;
  amount: string;
  setAmount: (v: string) => void;
  duration: DurationOption;
  setDuration: (v: DurationOption) => void;
  hasDownPayment: boolean;
  setHasDownPayment: (v: boolean) => void;
  downPaymentAmount: string;
  setDownPaymentAmount: (v: string) => void;
  hasFinalPayment: boolean;
  setHasFinalPayment: (v: boolean) => void;
  finalPaymentAmount: string;
  setFinalPaymentAmount: (v: string) => void;
  startOffset: number;
  setStartOffset: (v: number) => void;
  onBack: () => void;
  onNext: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const parsedAmount = parseFloat(amount.replace(/,/g, '')) || 0;
  const parsedDownPayment = parseFloat(downPaymentAmount.replace(/,/g, '')) || 0;
  const parsedFinalPayment = parseFloat(finalPaymentAmount.replace(/,/g, '')) || 0;
  const total = parsedAmount * duration;
  const typeLabel = COMMITMENT_TYPES.find(t => t.id === type)?.label ?? '';

  // BNPL is a fixed short installment count, not an open-ended term, and
  // doesn't carry the same "down payment" concept a loan/installment does.
  const isBnpl = type === 'deferred';
  const isSubscription = type === 'subscription';
  const showDownPayment = !isBnpl && !isSubscription;
  const durationOptions = isBnpl ? INSTALLMENT_OPTIONS : DURATION_OPTIONS;
  const durationFieldLabel = isBnpl ? 'عدد الدفعات' : isSubscription ? 'احسب الأثر خلال' : 'مدة الالتزام';
  const formatDuration = isBnpl ? installmentLabel : durationLabel;

  const amountError = amount.length > 0 && parsedAmount > 0
    && (parsedAmount < MIN_AMOUNT || parsedAmount > MAX_AMOUNT);
  const canContinue = parsedAmount >= MIN_AMOUNT && parsedAmount <= MAX_AMOUNT;

  return (
    <View style={s2.container}>
      <Text style={[s2.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>تفاصيل القرار</Text>

      {/* Decision type (read-only) */}
      <FieldBlock label="نوع القرار" colors={colors}>
        <View style={[s2.readonlyField, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s2.readonlyText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>{typeLabel}</Text>
        </View>
      </FieldBlock>

      {/* Monthly amount */}
      <FieldBlock label={isBnpl ? 'قيمة الدفعة' : 'قيمة القسط الشهري'} colors={colors}>
        <View style={[s2.inputRow, {
          backgroundColor: colors.card,
          borderColor: amountError ? colors.destructive : colors.border,
        }]}>
          <Text style={[s2.inputUnit, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>ريال</Text>
          <TextInput
            value={amount}
            onChangeText={v => setAmount(v.replace(/[^0-9.]/g, ''))}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            textAlign="right"
            style={[s2.input, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', flex: 1 }]}
          />
        </View>
        {amountError && (
          <Text style={[s2.errorText, { color: colors.destructive, fontFamily: 'Inter_400Regular' }]}>
            {parsedAmount < MIN_AMOUNT
              ? `الحد الأدنى ${MIN_AMOUNT} ريال`
              : `الحد الأقصى ${MAX_AMOUNT.toLocaleString('en-US')} ريال`}
          </Text>
        )}
      </FieldBlock>

      {/* Duration / installments — meaning and options differ per type */}
      <FieldBlock label={durationFieldLabel} colors={colors}>
        <View style={s2.pillRow}>
          {durationOptions.map(d => {
            const active = duration === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => { setDuration(d); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={[s2.pill, {
                  backgroundColor: active ? colors.foreground : colors.card,
                  borderColor: active ? colors.foreground : colors.border,
                }]}
              >
                <Text style={[s2.pillText, {
                  color: active ? colors.background : colors.mutedForeground,
                  fontFamily: active ? 'Inter_700Bold' : 'Inter_400Regular',
                }]}>
                  {formatDuration(d)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </FieldBlock>

      {/* Start month — a real selector, not static text */}
      <FieldBlock label="تاريخ البداية" colors={colors}>
        <View style={s2.pillRow}>
          {START_MONTH_OPTIONS.map(o => {
            const active = startOffset === o;
            return (
              <TouchableOpacity
                key={o}
                onPress={() => { setStartOffset(o); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={[s2.pill, {
                  backgroundColor: active ? colors.foreground : colors.card,
                  borderColor: active ? colors.foreground : colors.border,
                }]}
              >
                <Text style={[s2.pillText, {
                  color: active ? colors.background : colors.mutedForeground,
                  fontFamily: active ? 'Inter_700Bold' : 'Inter_400Regular',
                }]}>
                  {startMonthLabel(o)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[s2.hintText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          {calendarMonthLabel(startOffset)}
        </Text>
      </FieldBlock>

      {/* Down payment — only for loan/installment, real amount field */}
      {showDownPayment && (
        <FieldBlock label="هل توجد دفعة أولى؟" colors={colors}>
          <View style={s2.toggleRow}>
            <TouchableOpacity
              onPress={() => setHasDownPayment(false)}
              style={[s2.toggleBtn, {
                backgroundColor: !hasDownPayment ? colors.foreground : colors.card,
                borderColor: !hasDownPayment ? colors.foreground : colors.border,
              }]}
            >
              <Text style={[s2.toggleText, {
                color: !hasDownPayment ? colors.background : colors.mutedForeground,
                fontFamily: !hasDownPayment ? 'Inter_700Bold' : 'Inter_400Regular',
              }]}>لا</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setHasDownPayment(true)}
              style={[s2.toggleBtn, {
                backgroundColor: hasDownPayment ? colors.foreground : colors.card,
                borderColor: hasDownPayment ? colors.foreground : colors.border,
              }]}
            >
              <Text style={[s2.toggleText, {
                color: hasDownPayment ? colors.background : colors.mutedForeground,
                fontFamily: hasDownPayment ? 'Inter_700Bold' : 'Inter_400Regular',
              }]}>نعم</Text>
            </TouchableOpacity>
          </View>
          {hasDownPayment && (
            <View style={[s2.inputRow, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10 }]}>
              <Text style={[s2.inputUnit, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>ريال</Text>
              <TextInput
                value={downPaymentAmount}
                onChangeText={v => setDownPaymentAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
                placeholder="قيمة الدفعة الأولى"
                placeholderTextColor={colors.mutedForeground}
                textAlign="right"
                style={[s2.input, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', flex: 1 }]}
              />
            </View>
          )}
        </FieldBlock>
      )}

      {/* Final (balloon) payment — only for loan/installment, lands at maturity */}
      {showDownPayment && (
        <FieldBlock label="هل توجد دفعة أخيرة؟" colors={colors}>
          <View style={s2.toggleRow}>
            <TouchableOpacity
              onPress={() => setHasFinalPayment(false)}
              style={[s2.toggleBtn, {
                backgroundColor: !hasFinalPayment ? colors.foreground : colors.card,
                borderColor: !hasFinalPayment ? colors.foreground : colors.border,
              }]}
            >
              <Text style={[s2.toggleText, {
                color: !hasFinalPayment ? colors.background : colors.mutedForeground,
                fontFamily: !hasFinalPayment ? 'Inter_700Bold' : 'Inter_400Regular',
              }]}>لا</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setHasFinalPayment(true)}
              style={[s2.toggleBtn, {
                backgroundColor: hasFinalPayment ? colors.foreground : colors.card,
                borderColor: hasFinalPayment ? colors.foreground : colors.border,
              }]}
            >
              <Text style={[s2.toggleText, {
                color: hasFinalPayment ? colors.background : colors.mutedForeground,
                fontFamily: hasFinalPayment ? 'Inter_700Bold' : 'Inter_400Regular',
              }]}>نعم</Text>
            </TouchableOpacity>
          </View>
          {hasFinalPayment && (
            <>
              <View style={[s2.inputRow, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10 }]}>
                <Text style={[s2.inputUnit, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>ريال</Text>
                <TextInput
                  value={finalPaymentAmount}
                  onChangeText={v => setFinalPaymentAmount(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  placeholder="قيمة الدفعة الأخيرة"
                  placeholderTextColor={colors.mutedForeground}
                  textAlign="right"
                  style={[s2.input, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', flex: 1 }]}
                />
              </View>
              <Text style={[s2.hintText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                تُخصم عند نهاية المدة ({formatDuration(duration)}) وليست اليوم
              </Text>
            </>
          )}
        </FieldBlock>
      )}

      {/* Summary card */}
      {parsedAmount > 0 && (
        <View style={[s2.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s2.summaryTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>ملخص القرار</Text>
          <View style={[s2.summaryDivider, { backgroundColor: colors.border }]} />
          <SummaryRow label={isBnpl ? 'قيمة الدفعة' : 'القسط الشهري'} value={`${parsedAmount.toLocaleString('en-US')} ريال`} colors={colors} />
          <SummaryRow label={durationFieldLabel} value={formatDuration(duration)} colors={colors} />
          <SummaryRow label="إجمالي الالتزام" value={`${total.toLocaleString('en-US')} ريال`} colors={colors} highlighted />
          {showDownPayment && hasDownPayment && parsedDownPayment > 0 && (
            <SummaryRow label="الدفعة الأولى" value={`${parsedDownPayment.toLocaleString('en-US')} ريال`} colors={colors} />
          )}
          {showDownPayment && hasFinalPayment && parsedFinalPayment > 0 && (
            <SummaryRow label="الدفعة الأخيرة" value={`${parsedFinalPayment.toLocaleString('en-US')} ريال`} colors={colors} />
          )}
          <SummaryRow label="البداية" value={calendarMonthLabel(startOffset)} colors={colors} />
        </View>
      )}

      {/* BNPL is date-based, not duration-based — show the real schedule */}
      {isBnpl && parsedAmount > 0 && (
        <FieldBlock label="مواعيد الدفعات" colors={colors}>
          <View style={[s2.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, gap: 6 }]}>
            {installmentDueDates(startOffset, duration).map((dateLabel, i) => (
              <View key={i} style={s2.dueDateRow}>
                <Text style={[s2.dueDateAmount, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                  {parsedAmount.toLocaleString('en-US')} ريال
                </Text>
                <Text style={[s2.dueDateLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                  الدفعة {i + 1} — {dateLabel}
                </Text>
              </View>
            ))}
          </View>
        </FieldBlock>
      )}

      {/* Actions */}
      <TouchableOpacity
        style={[s2.primaryBtn, { backgroundColor: canContinue ? colors.primary : colors.muted }]}
        activeOpacity={0.85}
        onPress={canContinue ? onNext : undefined}
        disabled={!canContinue}
      >
        <Text style={[s2.primaryBtnText, { color: canContinue ? '#FFFFFF' : colors.mutedForeground, fontFamily: 'Inter_700Bold' }]}>
          عرض النتيجة
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack} style={s2.backLink}>
        <Text style={[s2.backLinkText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          تعديل نوع القرار
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function FieldBlock({ label, colors, children }: { label: string; colors: ReturnType<typeof useColors>; children: React.ReactNode }) {
  return (
    <View style={fbStyles.block}>
      <Text style={[fbStyles.label, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>{label}</Text>
      {children}
    </View>
  );
}
const fbStyles = StyleSheet.create({
  block: { gap: 8 },
  label: { fontSize: 13, textAlign: 'right' },
});

function SummaryRow({ label, value, highlighted, colors }: { label: string; value: string; highlighted?: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={sr.row}>
      <Text style={[sr.val, { color: highlighted ? colors.primary : colors.foreground, fontFamily: highlighted ? 'Inter_700Bold' : 'Inter_500Medium' }]}>
        {value}
      </Text>
      <Text style={[sr.label, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{label}</Text>
    </View>
  );
}
const sr = StyleSheet.create({
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13 },
  val: { fontSize: 14 },
});

const s2 = StyleSheet.create({
  container: { gap: 14 },
  title: { fontSize: 22, textAlign: 'right' },
  readonlyField: { borderRadius: 12, borderWidth: 1, padding: 12 },
  readonlyText: { fontSize: 14, textAlign: 'right' },
  inputRow: { borderRadius: 12, borderWidth: 1, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 2 },
  input: { fontSize: 18, paddingVertical: 8 },
  inputUnit: { fontSize: 13 },
  errorText: { fontSize: 11, textAlign: 'right' },
  hintText: { fontSize: 11, textAlign: 'right' },
  pillRow: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  pill: { borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 7 },
  pillText: { fontSize: 12 },
  toggleRow: { flexDirection: 'row-reverse', gap: 8 },
  toggleBtn: { flex: 1, borderRadius: 12, borderWidth: 1.5, paddingVertical: 10, alignItems: 'center' },
  toggleText: { fontSize: 14 },
  summaryCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  summaryTitle: { fontSize: 13, textAlign: 'right' },
  summaryDivider: { height: 1 },
  dueDateRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  dueDateLabel: { fontSize: 12 },
  dueDateAmount: { fontSize: 13 },
  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontSize: 16 },
  backLink: { alignItems: 'center', paddingVertical: 4 },
  backLinkText: { fontSize: 14 },
});

// ─── Step 3 — Results ─────────────────────────────────────────────────────────

const toneColor: Record<'ok' | 'warn' | 'risk', string> = {
  ok: '#9AB4D6',
  warn: '#E07A5F',
  risk: '#EF4444',
};

function Step3({
  type,
  amount,
  duration,
  hasDownPayment,
  downPaymentAmount,
  hasFinalPayment,
  finalPaymentAmount,
  startOffset,
  onEdit,
  colors,
}: {
  type: CommitmentType;
  amount: string;
  duration: DurationOption;
  hasDownPayment: boolean;
  downPaymentAmount: string;
  hasFinalPayment: boolean;
  finalPaymentAmount: string;
  startOffset: number;
  onEdit: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [timeline, setTimeline] = useState<TimelinePeriod>(6);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const parsedAmount = parseFloat(amount.replace(/,/g, '')) || 0;
  const parsedDownPayment = hasDownPayment ? (parseFloat(downPaymentAmount.replace(/,/g, '')) || 0) : 0;
  const parsedFinalPayment = hasFinalPayment ? (parseFloat(finalPaymentAmount.replace(/,/g, '')) || 0) : 0;

  const simQuery = useQuery({
    queryKey: ['simulate', type, parsedAmount, duration, hasDownPayment, parsedDownPayment, hasFinalPayment, parsedFinalPayment],
    queryFn: () =>
      simulateDecision(ACCOUNT_ID, {
        type: COMMITMENT_TYPE_TO_API[type],
        monthly: parsedAmount,
        months: duration,
        hasDownPayment,
        down_payment: parsedDownPayment,
        hasFinalPayment,
        final_payment: parsedFinalPayment,
      }),
    enabled: parsedAmount > 0,
  });

  if (simQuery.isLoading || !simQuery.data) {
    return (
      <View style={[s3.container, { alignItems: 'center', paddingVertical: 60 }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[s3.subtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 12 }]}>
          توأمك الرقمي يحاكي أثر القرار...
        </Text>
      </View>
    );
  }

  if (simQuery.isError) {
    return (
      <View style={[s3.container, { alignItems: 'center', paddingVertical: 60 }]}>
        <Ionicons name="cloud-offline-outline" size={32} color={colors.destructive} />
        <Text style={[s3.subtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 12 }]}>
          تعذر الاتصال بمحرك المحاكاة
        </Text>
        <TouchableOpacity onPress={onEdit} style={[s3.primaryBtn, { backgroundColor: colors.primary, marginTop: 16, paddingHorizontal: 24 }]}>
          <Text style={[s3.primaryBtnText, { fontFamily: 'Inter_700Bold' }]}>الرجوع</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const result = simQuery.data;
  const verdict = verdictLabels[result.verdict] ?? verdictLabels.caution;
  const surplusBefore = result.before.net_cashflow as number;
  const surplusAfter = result.after.net_cashflow as number;
  const totalCommitment = result.total_commitment;
  const balances = result.forecast_after?.projected_balances ?? [];
  const projectedBalance = balances[timeline - 1] ?? result.after.current_balance;
  const minBalance = balances.length ? Math.min(...balances.slice(0, timeline)) : result.after.current_balance;

  const interestingAttrs = new Set([
    'financial_health_score', 'savings_rate', 'emergency_fund_months',
    'net_cashflow', 'risk_level', 'debt_ratio',
  ]);
  const reasons = result.twin_diff
    .filter(d => interestingAttrs.has(d.attribute))
    .slice(0, 4)
    .map(d => {
      const label = attributeLabels[d.attribute] ?? d.attribute;
      const translated = (d.reasons ?? []).map(r => reasonLabels[r]).filter(Boolean);
      return translated.length ? `${label} — بسبب ${translated.join(' و')}` : label;
    });

  // Composed client-side from data that's already real and already
  // translated (twin_diff + attributeLabels), instead of rendering
  // result.explanation directly — that field is generated in English by
  // the backend (twin/explain.py) and was leaking untranslated into the
  // Arabic UI. No backend change needed since the underlying numbers are
  // already available and already shown as bullets below.
  const scoreBefore = Math.round(result.before.financial_health_score as number);
  const scoreAfter = Math.round(result.after.financial_health_score as number);
  const scoreLead = scoreAfter === scoreBefore
    ? 'صحتك المالية لم تتغيّر بشكل ملحوظ مع هذا القرار.'
    : scoreAfter > scoreBefore
    ? `تحسّنت صحتك المالية من ${scoreBefore} إلى ${scoreAfter} نقطة مع هذا القرار.`
    : `تراجعت صحتك المالية من ${scoreBefore} إلى ${scoreAfter} نقطة مع هذا القرار.`;

  const beforeBarHeight = 80;
  const afterBarHeight = Math.max(4, (Math.max(surplusAfter, 0) / Math.max(surplusBefore, 1)) * beforeBarHeight);
  const badgeColor = toneColor[verdict.tone];

  return (
    <View style={s3.container}>
      <View style={s3.titleBlock}>
        <Text style={[s3.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>نتيجة المحاكاة</Text>
        <Text style={[s3.subtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          الأثر المتوقع على وضعك المالي
        </Text>
      </View>

      {/* Verdict banner — real 4-tier verdict from the simulation engine */}
      <View style={[s3.warningCard, { backgroundColor: badgeColor + '1C', borderColor: badgeColor + '55' }]}>
        <Ionicons
          name={verdict.tone === 'ok' ? 'checkmark-circle-outline' : 'warning-outline'}
          size={20}
          color={badgeColor}
        />
        <View style={s3.warningText}>
          <Text style={[s3.warningTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            {verdict.title}
          </Text>
          <Text style={[s3.warningDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            {verdict.sub}
          </Text>
        </View>
      </View>

      {/* Before / After cards */}
      <Text style={[s3.sectionLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        قبل القرار وبعده
      </Text>
      <View style={s3.comparisonRow}>
        <View style={[s3.compCard, { backgroundColor: '#9AB4D614', borderColor: '#9AB4D633' }]}>
          <View style={s3.compDot}>
            <View style={[s3.dot, { backgroundColor: '#9AB4D6' }]} />
            <Text style={[s3.compCardTitle, { color: '#9AB4D6', fontFamily: 'Inter_600SemiBold' }]}>قبل القرار</Text>
          </View>
          <CompLine label={surplusBefore < 0 ? 'العجز الشهري' : 'الفائض الشهري'} value={`${Math.round(surplusBefore).toLocaleString('en-US')} ريال`} bold colors={colors} />
          <CompLine label="مستوى الضغط" value={riskLabels[result.before.risk_level] ?? result.before.risk_level} colors={colors} />
        </View>

        <View style={[s3.compCard, { backgroundColor: badgeColor + '12', borderColor: badgeColor + '30' }]}>
          <View style={s3.compDot}>
            <View style={[s3.dot, { backgroundColor: badgeColor }]} />
            <Text style={[s3.compCardTitle, { color: badgeColor, fontFamily: 'Inter_600SemiBold' }]}>بعد القرار</Text>
          </View>
          <CompLine label={surplusAfter < 0 ? 'العجز الشهري' : 'الفائض الشهري'} value={`${Math.round(surplusAfter).toLocaleString('en-US')} ريال`} bold colors={colors} />
          <CompLine label="مستوى الضغط" value={riskLabels[result.after.risk_level] ?? result.after.risk_level} colors={colors} />
        </View>
      </View>

      {/* Surplus drop indicator */}
      <View style={[s3.dropRow, { backgroundColor: colors.destructive + '10', borderColor: colors.destructive + '25' }]}>
        <Ionicons name="trending-down-outline" size={16} color={colors.destructive} />
        <Text style={[s3.dropText, { color: colors.destructive, fontFamily: 'Inter_500Medium' }]}>
          {surplusAfter < surplusBefore
            ? `انخفاض الفائض بمقدار ${Math.round(surplusBefore - surplusAfter).toLocaleString('en-US')} ريال شهريًا`
            : `تحسّن الفائض بمقدار ${Math.round(surplusAfter - surplusBefore).toLocaleString('en-US')} ريال شهريًا`}
        </Text>
      </View>

      {/* Bar chart comparison */}
      <View style={[s3.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s3.chartTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
          {surplusBefore < 0 || surplusAfter < 0 ? 'مقارنة الوضع الشهري' : 'مقارنة الفائض الشهري'}
        </Text>
        <View style={s3.barsRow}>
          <View style={s3.barGroup}>
            <Text style={[s3.barVal, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              {Math.round(surplusAfter).toLocaleString('en-US')}
            </Text>
            <View style={{ height: 100, justifyContent: 'flex-end' }}>
              <View style={[s3.bar, { height: afterBarHeight, backgroundColor: colors.primary + '88', width: 52 }]} />
            </View>
            <Text style={[s3.barLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>بعد</Text>
          </View>
          <View style={s3.barGroup}>
            <Text style={[s3.barVal, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              {Math.round(surplusBefore).toLocaleString('en-US')}
            </Text>
            <View style={{ height: 100, justifyContent: 'flex-end' }}>
              <View style={[s3.bar, { height: beforeBarHeight, backgroundColor: colors.foreground + 'CC', width: 52 }]} />
            </View>
            <Text style={[s3.barLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>قبل</Text>
          </View>
        </View>
      </View>

      {/* Timeline */}
      <Text style={[s3.sectionLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        اختر الفترة الزمنية
      </Text>
      <View style={s3.timelinePills}>
        {([3, 6, 12] as TimelinePeriod[]).map(p => {
          const active = timeline === p;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => { setTimeline(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[s3.timelinePill, {
                backgroundColor: active ? colors.foreground : colors.card,
                borderColor: active ? colors.foreground : colors.border,
              }]}
            >
              <Text style={[s3.timelinePillText, {
                color: active ? colors.background : colors.mutedForeground,
                fontFamily: active ? 'Inter_700Bold' : 'Inter_400Regular',
              }]}>
                {durationLabel(p)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Projection metrics grid — real forecast from the Twin */}
      <View style={s3.metricsGrid}>
        <MetricBox
          label="الرصيد المتوقع"
          value={`${Math.max(0, Math.round(projectedBalance)).toLocaleString('en-US')} ريال`}
          colors={colors}
        />
        <MetricBox
          label="أقل رصيد متوقع"
          value={`${Math.max(0, Math.round(minBalance)).toLocaleString('en-US')} ريال`}
          colors={colors}
        />
        <MetricBox
          label="إجمالي الالتزام"
          value={`${Math.round(totalCommitment).toLocaleString('en-US')} ريال`}
          colors={colors}
        />
        <MetricBox
          label="الصحة المالية بعد القرار"
          value={`${Math.round(result.after.financial_health_score)}/100`}
          colors={colors}
          highlight={result.after.financial_health_score < result.before.financial_health_score}
        />
      </View>

      {/* Why section — real explanation + twin_diff from the simulation engine */}
      <Text style={[s3.sectionLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        لماذا ظهرت هذه النتيجة؟
      </Text>
      <View style={[s3.reasonsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s3.reasonText, { color: colors.foreground, fontFamily: 'Inter_500Medium', marginBottom: 4 }]}>
          {scoreLead}
        </Text>
        {reasons.map((r, i) => (
          <View key={i} style={s3.reasonRow}>
            <Text style={[s3.reasonText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>{r}</Text>
            <View style={[s3.reasonNum, { backgroundColor: colors.primary }]}>
              <Text style={[s3.reasonNumText, { fontFamily: 'Inter_700Bold' }]}>{i + 1}</Text>
            </View>
          </View>
        ))}
        <Text style={[s3.disclaimer, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          ⓘ نتيجة من محاكاة توأمك الرقمي بناءً على دخلك ونمط إنفاقك الفعلي، وقد تتغير عند تغير الدخل أو المصروفات.
        </Text>
      </View>

      {/* CTA buttons */}
      <TouchableOpacity
        style={[s3.primaryBtn, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
        onPress={() => setShowAlternatives(v => !v)}
      >
        <Text style={[s3.primaryBtnText, { fontFamily: 'Inter_700Bold' }]}>
          {showAlternatives ? 'إخفاء البدائل' : 'عرض البدائل'}
        </Text>
      </TouchableOpacity>

      {showAlternatives && (
        <AlternativesPanel monthly={parsedAmount} months={duration} currentScore={result.before.financial_health_score as number} colors={colors} />
      )}

      <TouchableOpacity onPress={onEdit} style={s3.editLink}>
        <Text style={[s3.editLinkText, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
          تعديل القرار
        </Text>
      </TouchableOpacity>
    </View>
  );
}

interface AlternativeCardData {
  id: string;
  icon: string;
  title: string;
  summary: string;
  verdict?: string | null;
  healthAfter?: number | null;
  currentScore: number;
  longTermNote: string;
  recommended?: boolean;
}

function buildAlternativeCards(alts: AlternativesResult, currentScore: number): AlternativeCardData[] {
  const cards: AlternativeCardData[] = [];
  if (alts.reduce_payment.suggested_monthly > 0) {
    cards.push({
      id: 'reduce_payment',
      icon: 'trending-down-outline',
      title: 'تقليل قيمة القسط',
      summary: `قسط مقترح: ${Math.round(alts.reduce_payment.suggested_monthly).toLocaleString('en-US')} ريال شهريًا`,
      verdict: alts.reduce_payment.verdict,
      healthAfter: alts.reduce_payment.health_after,
      currentScore,
      longTermNote: 'يقلل الالتزام الشهري فورًا، على حساب إطالة أو تقليص حجم ما تحصل عليه.',
    });
  }
  cards.push({
    id: 'longer_duration',
    icon: 'calendar-outline',
    title: 'تمديد المدة',
    summary: `على ${alts.longer_duration.months} شهرًا بدل الحالية: ${Math.round(alts.longer_duration.monthly).toLocaleString('en-US')} ريال شهريًا`,
    verdict: alts.longer_duration.verdict,
    healthAfter: alts.longer_duration.health_after,
    currentScore,
    longTermNote: 'يخفّض الضغط الشهري، لكنه يطيل مدة الالتزام بمجموعه.',
  });
  if (alts.delay.months_to_save_buffer != null) {
    cards.push({
      id: 'delay',
      icon: 'time-outline',
      title: 'تأجيل القرار',
      summary: alts.delay.months_to_save_buffer === 0
        ? 'احتياطيك الحالي يغطي 3 أشهر بالفعل — لا حاجة للتأجيل'
        : `الانتظار ${alts.delay.months_to_save_buffer} أشهر يبني احتياطي 3 أشهر أولًا`,
      currentScore,
      longTermNote: 'لا يغيّر قيمة الالتزام، لكنه يمنحك هامش أمان أكبر قبل البدء به.',
    });
  }
  if (alts.review_subscriptions.recurring_total > 0) {
    cards.push({
      id: 'review_subscriptions',
      icon: 'list-outline',
      title: 'مراجعة المصروفات المتكررة',
      summary: `${alts.review_subscriptions.count} التزامات متكررة بمجموع ${Math.round(alts.review_subscriptions.recurring_total).toLocaleString('en-US')} ريال شهريًا`,
      currentScore,
      longTermNote: 'إلغاء أو تقليص التزامات متكررة قائمة يفتح مساحة حقيقية للقرار الجديد دون تغيير شروطه.',
    });
  }
  if (alts.use_liquidity.feasible) {
    cards.push({
      id: 'use_liquidity',
      icon: 'wallet-outline',
      title: 'الدفع من السيولة الحالية',
      summary: `رصيدك يغطي كامل المبلغ نقدًا — الرصيد بعده: ${Math.round(alts.use_liquidity.balance_after ?? 0).toLocaleString('en-US')} ريال`,
      verdict: alts.use_liquidity.verdict,
      healthAfter: alts.use_liquidity.health_after,
      currentScore,
      longTermNote: 'يتجنب أي التزام شهري جديد بالكامل، على حساب تقليص رصيدك الحالي فورًا.',
    });
  }
  cards.push({
    id: 'invest_instead',
    icon: 'trending-up-outline',
    title: 'استثمار المبلغ بدل الالتزام به',
    summary: `بعائد افتراضي 7% سنويًا: ${Math.round(alts.invest_instead.projected_value).toLocaleString('en-US')} ريال متوقعة (+${Math.round(alts.invest_instead.projected_gain).toLocaleString('en-US')})`,
    verdict: alts.invest_instead.verdict,
    healthAfter: alts.invest_instead.health_after,
    currentScore,
    longTermNote: 'مقارنة افتراضية بعائد استثمار قياسي 7% — وليس عرضًا حقيقيًا أو نصيحة استثمارية.',
  });
  if (alts.restructure_debt.feasible) {
    cards.push({
      id: 'restructure_debt',
      icon: 'swap-horizontal-outline',
      title: 'إعادة هيكلة الالتزامات الحالية',
      summary: `تسديد التزاماتك الحالية يحرر ${Math.round(alts.restructure_debt.freed_up_monthly).toLocaleString('en-US')} ريال شهريًا`,
      verdict: alts.restructure_debt.verdict,
      healthAfter: alts.restructure_debt.health_after,
      currentScore,
      longTermNote: 'يزيل التزامًا قائمًا بدل إضافة جديد — يحتاج القدرة على سداده دفعة واحدة أو التفاوض مع الجهة الممولة.',
    });
  }

  const titleToId: Record<string, string> = {
    'تقليل القسط': 'reduce_payment',
    'تمديد المدة': 'longer_duration',
    'استخدام السيولة الحالية': 'use_liquidity',
    'استثمار المبلغ بدل الالتزام به': 'invest_instead',
    'إعادة هيكلة الالتزامات الحالية': 'restructure_debt',
  };
  const bestId = titleToId[alts.best_scenario];
  if (bestId) {
    const bestCard = cards.find(c => c.id === bestId);
    if (bestCard) bestCard.recommended = true;
  }

  return cards;
}

function AlternativeCard({ data, colors }: { data: AlternativeCardData; colors: ReturnType<typeof useColors> }) {
  const [open, setOpen] = useState(false);
  const verdictInfo = data.verdict ? verdictLabels[data.verdict] : null;
  const delta = data.healthAfter != null ? Math.round(data.healthAfter - data.currentScore) : null;
  const deltaColor = delta == null ? colors.mutedForeground : delta >= 0 ? '#4CAF8C' : colors.destructive;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => setOpen(o => !o)}
      style={[ac.card, { backgroundColor: colors.card, borderColor: data.recommended ? colors.accent : open ? colors.primary : colors.border }]}
    >
      {data.recommended && (
        <View style={[ac.recBadge, { backgroundColor: colors.accent }]}>
          <Text style={[ac.recBadgeText, { fontFamily: 'Inter_700Bold' }]}>الأفضل لك</Text>
        </View>
      )}
      <View style={ac.headerRow}>
        <Ionicons name={open ? 'chevron-up-outline' : 'chevron-down-outline'} size={16} color={colors.mutedForeground} />
        <View style={ac.headerText}>
          <Text style={[ac.title, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>{data.title}</Text>
          <Text style={[ac.summary, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{data.summary}</Text>
        </View>
        <View style={[ac.iconWrap, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name={data.icon as any} size={18} color={colors.primary} />
        </View>
      </View>

      {open && (
        <View style={[ac.detail, { borderTopColor: colors.border }]}>
          {(verdictInfo || delta != null) && (
            <View style={ac.statsRow}>
              {verdictInfo && (
                <View style={ac.statBox}>
                  <Text style={[ac.statLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>الوضع المتوقع</Text>
                  <Text style={[ac.statVal, { color: toneColor[verdictInfo.tone], fontFamily: 'Inter_700Bold' }]}>{verdictInfo.title}</Text>
                </View>
              )}
              {delta != null && (
                <View style={ac.statBox}>
                  <Text style={[ac.statLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>الفرق عن وضعك الحالي</Text>
                  <Text style={[ac.statVal, { color: deltaColor, fontFamily: 'Inter_700Bold' }]}>
                    {delta >= 0 ? '+' : ''}{delta} نقطة
                  </Text>
                </View>
              )}
            </View>
          )}
          <View style={[ac.noteBox, { backgroundColor: colors.secondary }]}>
            <Ionicons name="bulb-outline" size={14} color={colors.primary} />
            <Text style={[ac.noteText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{data.longTermNote}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}
const ac = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 10, position: 'relative', overflow: 'hidden' },
  recBadge: { position: 'absolute', top: 0, left: 0, paddingHorizontal: 10, paddingVertical: 4, borderBottomRightRadius: 12 },
  recBadgeText: { color: '#FFFFFF', fontSize: 10 },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
  headerText: { flex: 1, alignItems: 'flex-end', gap: 3 },
  title: { fontSize: 14 },
  summary: { fontSize: 12, textAlign: 'right' },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  detail: { borderTopWidth: 1, paddingTop: 10, gap: 10 },
  statsRow: { flexDirection: 'row-reverse', gap: 8 },
  statBox: { flex: 1, alignItems: 'flex-end', gap: 2 },
  statLabel: { fontSize: 10, textAlign: 'right' },
  statVal: { fontSize: 13 },
  noteBox: { flexDirection: 'row-reverse', gap: 8, borderRadius: 10, padding: 10, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 11, textAlign: 'right', lineHeight: 17 },
});

function AlternativesPanel({ monthly, months, currentScore, colors }: { monthly: number; months: number; currentScore: number; colors: ReturnType<typeof useColors> }) {
  const altQuery = useQuery({
    queryKey: ['alternatives', monthly, months],
    queryFn: () => fetchAlternatives(ACCOUNT_ID, monthly, months),
    enabled: monthly > 0,
  });

  if (altQuery.isLoading) {
    return (
      <View style={[s3.reasonsCard, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (altQuery.isError || !altQuery.data) {
    return (
      <View style={[s3.reasonsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s3.reasonText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' }]}>
          تعذر تحميل البدائل
        </Text>
      </View>
    );
  }

  const cards = buildAlternativeCards(altQuery.data, currentScore);

  return (
    <View style={{ gap: 10 }}>
      {cards.map(c => <AlternativeCard key={c.id} data={c} colors={colors} />)}
    </View>
  );
}

function CompLine({ label, value, bold, colors }: { label: string; value: string; bold?: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={cl.row}>
      <Text style={[cl.val, { color: colors.foreground, fontFamily: bold ? 'Inter_700Bold' : 'Inter_400Regular' }]}>{value}</Text>
      <Text style={[cl.label, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{label}</Text>
    </View>
  );
}
const cl = StyleSheet.create({
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 11 },
  val: { fontSize: 13 },
});

function MetricBox({ label, value, highlight, colors }: { label: string; value: string; highlight?: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[mb.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[mb.label, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{label}</Text>
      <Text style={[mb.val, { color: highlight ? colors.destructive : colors.foreground, fontFamily: 'Inter_700Bold' }]}>
        {value}
      </Text>
    </View>
  );
}
const mb = StyleSheet.create({
  box: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, gap: 6, alignItems: 'flex-end' },
  label: { fontSize: 11, textAlign: 'right' },
  val: { fontSize: 16, textAlign: 'right' },
});

const s3 = StyleSheet.create({
  container: { gap: 14 },
  titleBlock: { alignItems: 'flex-end', gap: 4 },
  title: { fontSize: 24 },
  subtitle: { fontSize: 13 },
  warningCard: { flexDirection: 'row-reverse', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: 'flex-start' },
  okCard: { flexDirection: 'row-reverse', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: 'flex-start' },
  warningText: { flex: 1, gap: 4 },
  warningTitle: { fontSize: 14, textAlign: 'right' },
  warningDesc: { fontSize: 12, textAlign: 'right', lineHeight: 18 },
  sectionLabel: { fontSize: 15, textAlign: 'right' },
  comparisonRow: { flexDirection: 'row', gap: 10 },
  compCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, gap: 8 },
  compDot: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  compCardTitle: { fontSize: 12 },
  dropRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  dropText: { fontSize: 13, flex: 1, textAlign: 'right' },
  chartCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 14 },
  chartTitle: { fontSize: 14, textAlign: 'right' },
  barsRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, alignItems: 'flex-end' },
  barGroup: { alignItems: 'center', gap: 6 },
  barVal: { fontSize: 14 },
  bar: { borderRadius: 8 },
  barLabel: { fontSize: 12 },
  timelinePills: { flexDirection: 'row-reverse', gap: 8 },
  timelinePill: { flex: 1, borderRadius: 20, borderWidth: 1.5, paddingVertical: 10, alignItems: 'center' },
  timelinePillText: { fontSize: 13 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reasonsCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  reasonRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  reasonNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  reasonNumText: { color: '#FFFFFF', fontSize: 12 },
  reasonText: { flex: 1, fontSize: 13, textAlign: 'right', lineHeight: 20 },
  disclaimer: { fontSize: 11, textAlign: 'right', lineHeight: 17 },
  primaryBtn: { borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 17 },
  editLink: { alignItems: 'center', paddingVertical: 4 },
  editLinkText: { fontSize: 15 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SimulatorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { monthlyExpenses } = useFinancialHealth();

  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();
  const validType = (typeParam && ['loan','installment','deferred','subscription'].includes(typeParam))
    ? typeParam as CommitmentType
    : null;

  const [step, setStep] = useState<1 | 2 | 3>(validType ? 2 : 1);
  const [selectedType, setSelectedType] = useState<CommitmentType>(validType ?? 'installment');
  // Derived from the real monthly expenses instead of a hardcoded guess —
  // still just a starting point for the input, not a recommendation.
  const [amount, setAmount] = useState(() => String(Math.max(MIN_AMOUNT, Math.round(monthlyExpenses * 0.1 / 50) * 50)));
  const [duration, setDuration] = useState<DurationOption>(6);
  const [hasDownPayment, setHasDownPayment] = useState(false);
  const [downPaymentAmount, setDownPaymentAmount] = useState('');
  const [hasFinalPayment, setHasFinalPayment] = useState(false);
  const [finalPaymentAmount, setFinalPaymentAmount] = useState('');
  const [startOffset, setStartOffset] = useState(1);

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 8;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step indicator */}
        <View style={styles.stepRow}>
          {[1, 2, 3].map(n => (
            <View
              key={n}
              style={[
                styles.stepDot,
                {
                  backgroundColor: n <= step ? colors.primary : colors.border,
                  width: n === step ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {step === 1 && (
          <Step1
            selected={selectedType}
            onSelect={setSelectedType}
            onNext={() => setStep(2)}
            colors={colors}
          />
        )}
        {step === 2 && (
          <Step2
            type={selectedType}
            amount={amount}
            setAmount={setAmount}
            duration={duration}
            setDuration={setDuration}
            hasDownPayment={hasDownPayment}
            setHasDownPayment={setHasDownPayment}
            downPaymentAmount={downPaymentAmount}
            setDownPaymentAmount={setDownPaymentAmount}
            hasFinalPayment={hasFinalPayment}
            setHasFinalPayment={setHasFinalPayment}
            finalPaymentAmount={finalPaymentAmount}
            setFinalPaymentAmount={setFinalPaymentAmount}
            startOffset={startOffset}
            setStartOffset={setStartOffset}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            colors={colors}
          />
        )}
        {step === 3 && (
          <Step3
            type={selectedType}
            amount={amount}
            duration={duration}
            hasDownPayment={hasDownPayment}
            downPaymentAmount={downPaymentAmount}
            hasFinalPayment={hasFinalPayment}
            finalPaymentAmount={finalPaymentAmount}
            startOffset={startOffset}
            onEdit={() => setStep(2)}
            colors={colors}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 20 },
  stepRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  stepDot: { height: 8, borderRadius: 4 },
});
