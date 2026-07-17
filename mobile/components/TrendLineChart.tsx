import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

function buildLinePath(data: number[], w: number, h: number, pad = 16): string {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: h - pad - ((v - min) / range) * (h - pad * 2),
  }));
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

const TREND_W = 320;
const TREND_H = 130;
const TREND_PAD = 22;

// Fed by GET /api/twin/:id/history — every point is a real recomputation
// from real transactions up to that month, never a fabricated series.
export function TrendLineChart({
  points,
  legend,
  color,
  formatValue,
}: {
  points: { label: string; value: number }[];
  legend: string;
  color: string;
  formatValue: (v: number) => string;
}) {
  const colors = useColors();
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <View style={tc.empty}>
        <Ionicons name="stats-chart-outline" size={22} color={colors.mutedForeground} />
        <Text style={[tc.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          سيتوفر عرض الاتجاه عند تجميع بيانات كافية عبر الوقت
        </Text>
      </View>
    );
  }

  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = points.map((p, i) => ({
    x: TREND_PAD + (i / (points.length - 1)) * (TREND_W - TREND_PAD * 2),
    y: TREND_H - TREND_PAD - ((p.value - min) / range) * (TREND_H - TREND_PAD * 2),
    ...p,
  }));
  const linePath = buildLinePath(values, TREND_W, TREND_H, TREND_PAD);
  const fillPath = buildFillPath(values, TREND_W, TREND_H, TREND_PAD);
  const active = activeIdx !== null ? pts[activeIdx] : pts[pts.length - 1];
  const gradId = `trendFade-${legend.replace(/\s/g, '')}`;

  return (
    <View style={tc.wrapper}>
      <View style={tc.legendRow}>
        <View style={[tc.legendDot, { backgroundColor: color }]} />
        <Text style={[tc.legendText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{legend}</Text>
      </View>

      <View style={tc.calloutRow}>
        <Text style={[tc.calloutMonth, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{active.label}</Text>
        <Text style={[tc.calloutVal, { color, fontFamily: 'Inter_700Bold' }]}>{formatValue(active.value)}</Text>
      </View>

      <Svg width={TREND_W} height={TREND_H}>
        <Defs>
          <RadialGradient id={gradId} cx="50%" cy="0%" r="100%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d={fillPath} fill={`url(#${gradId})`} />
        <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((pt, i) => (
          <Circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={i === activeIdx || (activeIdx === null && i === pts.length - 1) ? 5 : 3}
            fill={color}
            onPress={() => setActiveIdx(i)}
          />
        ))}
        {pts.map((pt, i) => (
          i % Math.ceil(pts.length / 6) === 0 ? (
            <SvgText key={`lbl-${i}`} x={pt.x} y={TREND_H - 2} fontSize={8} fill={colors.mutedForeground} textAnchor="middle">
              {pt.label.split(' ')[0].slice(0, 3)}
            </SvgText>
          ) : null
        ))}
      </Svg>
    </View>
  );
}

const tc = StyleSheet.create({
  wrapper: { gap: 8, alignItems: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 22 },
  emptyText: { fontSize: 12, textAlign: 'center', paddingHorizontal: 20 },
  legendRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, alignSelf: 'flex-end' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
  calloutRow: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 8, alignSelf: 'flex-end' },
  calloutMonth: { fontSize: 11 },
  calloutVal: { fontSize: 16 },
});
