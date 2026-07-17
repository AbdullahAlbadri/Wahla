import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { RiyalSymbol } from '@/components/RiyalSymbol';

interface SpendingBarProps {
  name: string;
  amount: number;
  budget: number;
  percentage: number;
  color: string;
}

export function SpendingBar({ name, amount, budget, percentage, color }: SpendingBarProps) {
  const colors = useColors();
  const widthAnim = useRef(new Animated.Value(0)).current;
  const isOverBudget = amount > budget;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.min(percentage / 100, 1),
      duration: 900,
      delay: 100,
      useNativeDriver: false,
    }).start();
  }, [percentage]);

  const width = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.row}>
      {/* Label row */}
      <View style={styles.labelRow}>
        <Text style={[styles.name, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>
          {name}
        </Text>
        <View style={styles.leftSide}>
          <Text style={[styles.percent, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
            {percentage}%
          </Text>
          {isOverBudget && (
            <View style={[styles.overBudge, { backgroundColor: colors.destructive + '22' }]}>
              <Text style={[styles.overText, { color: colors.destructive, fontFamily: 'Inter_600SemiBold' }]}>
                تجاوز
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Bar */}
      <View style={[styles.track, { backgroundColor: colors.border, transform: [{ scaleX: -1 }] }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              width,
              backgroundColor: isOverBudget ? colors.destructive : color,
            },
          ]}
        />
      </View>

      {/* Amounts */}
      <View style={styles.amountsRow}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 2 }}>
          <Text style={[styles.budget, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            من {budget.toLocaleString('en-US')}
          </Text>
          <RiyalSymbol size={10} color={colors.mutedForeground} />
        </View>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 2 }}>
          <Text style={[styles.amount, { color: isOverBudget ? colors.destructive : colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            {amount.toLocaleString('en-US')}
          </Text>
          <RiyalSymbol size={11} color={isOverBudget ? colors.destructive : colors.foreground} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 14,
  },
  percent: {
    fontSize: 12,
  },
  overBudge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  overText: {
    fontSize: 10,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  amountsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  amount: {
    fontSize: 13,
  },
  budget: {
    fontSize: 12,
  },
});
