import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { RiyalSymbol } from '@/components/RiyalSymbol';

interface InsightCardProps {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  impactPoints: number;
  effort: 'easy' | 'medium' | 'hard';
  category: string;
  savings: number;
  basis?: string[];
  onPress?: () => void;
}

const impactLabel: Record<string, string> = { high: 'تأثير عالٍ', medium: 'تأثير متوسط', low: 'تأثير منخفض' };
const effortLabel: Record<string, string> = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };

export function InsightCard({ title, description, impact, impactPoints, effort, category, savings, basis, onPress }: InsightCardProps) {
  const colors = useColors();

  const impactColor = impact === 'high' ? '#9AB4D6' : impact === 'medium' ? '#E07A5F' : colors.mutedForeground;
  const effortColor = effort === 'easy' ? '#9AB4D6' : effort === 'medium' ? '#E07A5F' : colors.primary;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {/* Top row */}
      <View style={styles.topRow}>
        <View style={[styles.badge, { backgroundColor: impactColor + '22', borderColor: impactColor + '44' }]}>
          <Text style={[styles.badgeText, { color: impactColor, fontFamily: 'Inter_600SemiBold' }]}>
            {impactLabel[impact]}
          </Text>
        </View>
        <View style={styles.categoryRow}>
          <Text style={[styles.category, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            {category}
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        {title}
      </Text>

      {/* Description */}
      <Text style={[styles.description, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
        {description}
      </Text>

      {/* Why — real signals that triggered this suggestion, not a black box */}
      {basis && basis.length > 0 && (
        <View style={[styles.basisBox, { backgroundColor: colors.secondary }]}>
          <Ionicons name="bulb-outline" size={12} color={colors.mutedForeground} />
          <View style={{ flex: 1, gap: 2 }}>
            {basis.map((b, i) => (
              <Text key={i} style={[styles.basisText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                {b}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Bottom row */}
      <View style={styles.bottomRow}>
        <View style={[styles.effortBadge, { backgroundColor: effortColor + '1A' }]}>
          <Text style={[styles.effortText, { color: effortColor, fontFamily: 'Inter_500Medium' }]}>
            {effortLabel[effort]}
          </Text>
        </View>

        <View style={styles.pointsRow}>
          {savings > 0 && (
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 2 }}>
              <Text style={[styles.savings, { color: '#9AB4D6', fontFamily: 'Inter_600SemiBold' }]}>
                وفّر {savings.toLocaleString('en-US')}
              </Text>
              <RiyalSymbol size={12} color="#9AB4D6" />
            </View>
          )}
          <View style={[styles.pointsBadge, { backgroundColor: colors.primary + '22' }]}>
            <Ionicons name="arrow-up-outline" size={11} color={colors.primary} />
            <Text style={[styles.pointsText, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>
              +{impactPoints}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  category: {
    fontSize: 12,
  },
  title: {
    fontSize: 15,
    textAlign: 'right',
    lineHeight: 22,
  },
  description: {
    fontSize: 13,
    textAlign: 'right',
    lineHeight: 20,
  },
  basisBox: {
    flexDirection: 'row-reverse',
    gap: 6,
    borderRadius: 10,
    padding: 8,
    alignItems: 'flex-start',
  },
  basisText: {
    fontSize: 11,
    textAlign: 'right',
    lineHeight: 16,
  },
  bottomRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  effortBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  effortText: {
    fontSize: 11,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  savings: {
    fontSize: 12,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pointsText: {
    fontSize: 12,
  },
});
