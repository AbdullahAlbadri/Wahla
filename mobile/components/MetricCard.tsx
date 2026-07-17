import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface MetricCardProps {
  title: string;
  value: string;
  trend: string;
  trendPositive?: boolean;
  trendNeutral?: boolean;
  icon: string;
  subtitle?: string;
}

export function MetricCard({ title, value, trend, trendPositive, trendNeutral, icon, subtitle }: MetricCardProps) {
  const colors = useColors();

  const trendColor = trendNeutral
    ? colors.mutedForeground
    : trendPositive
    ? colors.accent
    : colors.destructive;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
        <Ionicons name={icon as any} size={18} color={colors.primary} />
      </View>
      <Text style={[styles.value, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
        {value}
      </Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          {subtitle}
        </Text>
      )}
      <Text style={[styles.title, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
        {title}
      </Text>
      <View style={styles.trendRow}>
        <Ionicons
          name={trendNeutral ? 'remove-outline' : trendPositive ? 'trending-up-outline' : 'trending-down-outline'}
          size={12}
          color={trendColor}
        />
        <Text style={[styles.trend, { color: trendColor, fontFamily: 'Inter_500Medium' }]}>
          {trend}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
    minHeight: 120,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    alignSelf: 'flex-end',
  },
  value: {
    fontSize: 22,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: -2,
  },
  title: {
    fontSize: 11,
    textAlign: 'right',
    lineHeight: 16,
  },
  trendRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  trend: {
    fontSize: 11,
  },
});
