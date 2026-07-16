import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

const SIZE = 168;
const STROKE_WIDTH = 13;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ScoreRingProps {
  score: number;
  label: string;
  description: string;
}

function getScoreColor(score: number, accent: string, primary: string, warning: string) {
  if (score >= 80) return accent;
  if (score >= 60) return primary;
  return warning;
}

export function ScoreRing({ score, label, description }: ScoreRingProps) {
  const colors = useColors();
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: score / 100,
      duration: 1400,
      delay: 200,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const strokeDashoffset = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  const ringColor = getScoreColor(score, colors.accent, colors.primary, colors.warning);

  return (
    <View style={styles.wrapper}>
      <View style={{ width: SIZE, height: SIZE }}>
        {/* SVG ring */}
        <Svg
          width={SIZE}
          height={SIZE}
          style={styles.svg}
        >
          {/* Track */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.border}
            strokeWidth={STROKE_WIDTH}
            fill="transparent"
          />
          {/* Progress */}
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={ringColor}
            strokeWidth={STROKE_WIDTH}
            fill="transparent"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset as unknown as number}
            strokeLinecap="round"
          />
        </Svg>
        {/* Center text – overlaid on the SVG */}
        <View style={styles.center}>
          <Text style={[styles.scoreNumber, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            {score}
          </Text>
          <Text style={[styles.scoreUnit, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
            / 100
          </Text>
        </View>
      </View>
      <Text style={[styles.label, { color: ringColor, fontFamily: 'Inter_600SemiBold' }]}>
        {label}
      </Text>
      <Text style={[styles.description, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
        {description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 10,
  },
  svg: {
    transform: [{ rotate: '-90deg' }],
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  scoreNumber: {
    fontSize: 44,
    lineHeight: 52,
  },
  scoreUnit: {
    fontSize: 14,
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  label: {
    fontSize: 17,
    marginTop: 4,
  },
  description: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});
