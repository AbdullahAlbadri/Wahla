import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useFinancialHealth } from '@/context/FinancialHealthContext';
import { RiyalSymbol } from '@/components/RiyalSymbol';

interface Goal {
  id: string;
  title: string;
  targetAmount: number;
}

// Goals are local to this session, not persisted to the backend — same
// pattern as the notification toggles in settings.tsx. What IS real: the
// current balance and the projected-arrival estimate, both computed from
// the live Twin's forecast (GET /api/twin/:id → forecast.projected_balances),
// never a fabricated timeline.
function projectedArrival(targetAmount: number, currentBalance: number, projectedBalances: number[]): string {
  if (currentBalance >= targetAmount) return 'تحقق الهدف بالفعل';
  const idx = projectedBalances.findIndex(b => b >= targetAmount);
  if (idx === -1) return `لن يتحقق خلال ${projectedBalances.length} شهرًا القادمة وفق النمط الحالي`;
  return idx === 0 ? 'متوقع خلال الشهر القادم' : `متوقع خلال ${idx + 1} شهرًا`;
}

function GoalCard({ goal, currentBalance, projectedBalances, onRemove, colors }: {
  goal: Goal;
  currentBalance: number;
  projectedBalances: number[];
  onRemove: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const progressPct = Math.max(0, Math.min(100, Math.round((currentBalance / goal.targetAmount) * 100)));
  const arrival = projectedArrival(goal.targetAmount, currentBalance, projectedBalances);
  const reached = currentBalance >= goal.targetAmount;

  return (
    <View style={[gc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={gc.headerRow}>
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-outline" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={[gc.title, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>{goal.title}</Text>
      </View>

      <View style={gc.amountsRow}>
        <View style={gc.amountBox}>
          <Text style={[gc.amountLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>الهدف</Text>
          <View style={gc.amountValRow}>
            <Text style={[gc.amountVal, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              {goal.targetAmount.toLocaleString('en-US')}
            </Text>
            <RiyalSymbol size={13} color={colors.foreground} />
          </View>
        </View>
        <View style={gc.amountBox}>
          <Text style={[gc.amountLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>الرصيد الحالي</Text>
          <View style={gc.amountValRow}>
            <Text style={[gc.amountVal, { color: reached ? colors.accent : colors.primary, fontFamily: 'Inter_700Bold' }]}>
              {Math.round(currentBalance).toLocaleString('en-US')}
            </Text>
            <RiyalSymbol size={13} color={reached ? colors.accent : colors.primary} />
          </View>
        </View>
      </View>

      <View style={[gc.track, { backgroundColor: colors.border, transform: [{ scaleX: -1 }] }]}>
        <View style={[gc.fill, { width: `${progressPct}%` as any, backgroundColor: reached ? colors.accent : colors.primary }]} />
      </View>
      <Text style={[gc.pct, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{progressPct}% من الهدف</Text>

      <View style={[gc.arrivalBox, { backgroundColor: colors.secondary }]}>
        <Ionicons name={reached ? 'checkmark-circle-outline' : 'trending-up-outline'} size={14} color={reached ? colors.accent : colors.primary} />
        <Text style={[gc.arrivalText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{arrival}</Text>
      </View>
    </View>
  );
}
const gc = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, flex: 1, textAlign: 'right' },
  amountsRow: { flexDirection: 'row-reverse', gap: 10 },
  amountBox: { flex: 1, alignItems: 'flex-end', gap: 2 },
  amountLabel: { fontSize: 11 },
  amountValRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3 },
  amountVal: { fontSize: 17 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  pct: { fontSize: 11, textAlign: 'right' },
  arrivalBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, borderRadius: 10, padding: 10 },
  arrivalText: { fontSize: 12, flex: 1, textAlign: 'right' },
});

export default function GoalsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentBalance, forecast } = useFinancialHealth();
  const [goals, setGoals] = useState<Goal[]>([
    { id: '1', title: 'صندوق الطوارئ', targetAmount: Math.round(currentBalance * 1.5 / 100) * 100 || 5000 },
  ]);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 8;

  const addGoal = () => {
    const amount = parseFloat(newAmount.replace(/,/g, ''));
    if (!newTitle.trim() || !amount || amount <= 0) return;
    setGoals(g => [...g, { id: String(Date.now()), title: newTitle.trim(), targetAmount: amount }]);
    setNewTitle('');
    setNewAmount('');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.intro, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
        أضف هدفًا ماليًا وقارن رصيدك الحالي بالمتوقع بناءً على توأمك الرقمي.
      </Text>

      {goals.map(g => (
        <GoalCard
          key={g.id}
          goal={g}
          currentBalance={currentBalance}
          projectedBalances={forecast.projected_balances}
          onRemove={() => setGoals(gs => gs.filter(x => x.id !== g.id))}
          colors={colors}
        />
      ))}

      {/* Add goal form */}
      <View style={[styles.addCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.addTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>هدف جديد</Text>
        <TextInput
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="اسم الهدف (مثال: دفعة أولى لسيارة)"
          placeholderTextColor={colors.mutedForeground}
          textAlign="right"
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, fontFamily: 'Inter_400Regular' }]}
        />
        <TextInput
          value={newAmount}
          onChangeText={v => setNewAmount(v.replace(/[^0-9.]/g, ''))}
          placeholder="المبلغ المستهدف (ريال)"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="numeric"
          textAlign="right"
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, fontFamily: 'Inter_400Regular' }]}
        />
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={addGoal}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={[styles.addBtnText, { fontFamily: 'Inter_700Bold' }]}>إضافة الهدف</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14 },
  intro: { fontSize: 12, textAlign: 'right', lineHeight: 18 },
  addCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  addTitle: { fontSize: 14, textAlign: 'right' },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  addBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 13 },
  addBtnText: { color: '#FFFFFF', fontSize: 14 },
});
