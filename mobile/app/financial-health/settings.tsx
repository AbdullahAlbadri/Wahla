import React from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useFinancialHealth, type NotificationSettings } from '@/context/FinancialHealthContext';

const NOTIFICATION_ITEMS: { key: keyof NotificationSettings; label: string; desc: string; icon: string }[] = [
  { key: 'budgetAlerts', label: 'تنبيهات الميزانية', desc: 'إشعار عند تجاوز حد الميزانية', icon: 'warning-outline' },
  { key: 'weeklyInsights', label: 'الرؤى الأسبوعية', desc: 'ملخص أسبوعي لإنفاقك وادخارك', icon: 'analytics-outline' },
  { key: 'goalReminders', label: 'تذكيرات الأهداف', desc: 'تتبع تقدمك نحو الأهداف المالية', icon: 'flag-outline' },
  { key: 'savingsOpportunities', label: 'فرص الادخار', desc: 'اكتشاف فرص لتوفير المزيد', icon: 'cash-outline' },
  { key: 'monthlyReport', label: 'التقرير الشهري', desc: 'تقرير شامل في نهاية كل شهر', icon: 'document-text-outline' },
];

function SectionHeader({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
      {title}
    </Text>
  );
}

function SettingRow({ icon, label, desc, colors, onPress, children }: {
  icon: string; label: string; desc?: string;
  colors: ReturnType<typeof useColors>;
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      {...(onPress ? { onPress, activeOpacity: 0.7 } : {})}
      style={[styles.settingRow, { borderBottomColor: colors.border }]}
    >
      <View style={styles.settingRight}>
        <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
          <Ionicons name={icon as any} size={17} color={colors.primary} />
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>
            {label}
          </Text>
          {desc && (
            <Text style={[styles.settingDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              {desc}
            </Text>
          )}
        </View>
      </View>
      {children ?? (onPress && (
        <Ionicons name="chevron-back" size={16} color={colors.mutedForeground} />
      ))}
    </Wrapper>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { notifications, toggleNotification } = useFinancialHealth();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 8;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Notifications */}
      <SectionHeader title="الإشعارات" colors={colors} />
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {NOTIFICATION_ITEMS.map((item, i) => (
          <SettingRow
            key={item.key}
            icon={item.icon}
            label={item.label}
            desc={item.desc}
            colors={colors}
          >
            <Switch
              value={notifications[item.key]}
              onValueChange={() => {
                toggleNotification(item.key);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              trackColor={{ false: colors.border, true: colors.primary + '88' }}
              thumbColor={notifications[item.key] ? colors.primary : colors.mutedForeground}
              ios_backgroundColor={colors.border}
            />
          </SettingRow>
        ))}
      </View>

      {/* Budget settings */}
      <SectionHeader title="إعدادات الميزانية" colors={colors} />
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingRow icon="calendar-outline" label="الفترة الشهرية" desc="من اليوم الأول حتى الأخير" colors={colors} onPress={() => {}} />
        <SettingRow icon="cash-outline" label="عملة العرض" desc="ريال سعودي (ر.س)" colors={colors} onPress={() => {}} />
        <SettingRow icon="bar-chart-outline" label="مقارنة بأشخاص مشابهين" desc="قارن مؤشراتك بمتوسط فئتك العمرية" colors={colors}>
          <Switch
            value={true}
            onValueChange={() => {}}
            trackColor={{ false: colors.border, true: colors.primary + '88' }}
            thumbColor={colors.primary}
            ios_backgroundColor={colors.border}
          />
        </SettingRow>
      </View>

      {/* Data & Privacy */}
      <SectionHeader title="البيانات والخصوصية" colors={colors} />
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingRow icon="cloud-download-outline" label="تصدير البيانات" desc="تنزيل سجلك المالي بصيغة PDF" colors={colors} onPress={() => {}} />
        <SettingRow icon="trash-outline" label="مسح سجل التحليل" desc="حذف بيانات الصحة المالية المحفوظة" colors={colors} onPress={() => {}} />
        <SettingRow icon="lock-closed-outline" label="البصمة / Face ID" desc="حماية المعلومات المالية" colors={colors}>
          <Switch
            value={false}
            onValueChange={() => {}}
            trackColor={{ false: colors.border, true: colors.primary + '88' }}
            thumbColor={colors.mutedForeground}
            ios_backgroundColor={colors.border}
          />
        </SettingRow>
      </View>

      {/* About */}
      <SectionHeader title="حول الميزة" colors={colors} />
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingRow icon="information-circle-outline" label="كيف تُحسَب النقاط؟" colors={colors} onPress={() => {}} />
        <SettingRow icon="shield-checkmark-outline" label="سياسة الخصوصية" colors={colors} onPress={() => {}} />
        <SettingRow icon="help-circle-outline" label="الدعم الفني" colors={colors} onPress={() => {}} />
      </View>

      <Text style={[styles.version, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
        الصحة المالية – إصدار 1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
  sectionHeader: { fontSize: 12, textAlign: 'right', paddingHorizontal: 4, marginTop: 12, marginBottom: 4, letterSpacing: 0.5 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  settingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingRight: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, flex: 1 },
  iconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  settingText: { flex: 1, gap: 2 },
  settingLabel: { fontSize: 14, textAlign: 'right' },
  settingDesc: { fontSize: 11, textAlign: 'right', lineHeight: 16 },
  version: { fontSize: 11, textAlign: 'center', marginTop: 16 },
});
