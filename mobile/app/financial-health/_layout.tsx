import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

function FinancialHealthTitle() {
  const colors = useColors();
  return (
    <View style={s.titleRow}>
      <View style={[s.iconBadge, { backgroundColor: colors.primary + '22' }]}>
        <Ionicons name="heart-outline" size={15} color={colors.primary} />
      </View>
      <Text style={[s.title, { color: colors.foreground }]}>الصحة المالية</Text>
    </View>
  );
}

function HeaderActions() {
  const colors = useColors();
  const router = useRouter();
  return (
    <View style={s.actions}>
      <TouchableOpacity
        onPress={() => router.push('/financial-health/goals')}
        style={[s.iconBtn, { backgroundColor: colors.card }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="flag-outline" size={19} color={colors.foreground} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.push('/financial-health/reports')}
        style={[s.iconBtn, { backgroundColor: colors.card }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="bar-chart-outline" size={19} color={colors.foreground} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.push('/financial-health/settings')}
        style={[s.iconBtn, { backgroundColor: colors.card }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="settings-outline" size={19} color={colors.foreground} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  titleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  iconBadge: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginRight: Platform.OS === 'ios' ? 0 : 4,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default function FinancialHealthLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 17 },
        headerShadowVisible: false,
        headerBackTitle: 'رجوع',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen name="simulator" options={{ title: 'محاكي القرارات' }} />
      <Stack.Screen name="reports" options={{ title: 'التقارير الشهرية' }} />
      <Stack.Screen name="settings" options={{ title: 'إعدادات الصحة المالية' }} />
      <Stack.Screen name="scan" options={{ title: 'تحليل قرار الشراء' }} />
      <Stack.Screen name="goals" options={{ title: 'أهدافي المالية' }} />
    </Stack>
  );
}
