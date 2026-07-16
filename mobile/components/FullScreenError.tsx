import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export function FullScreenError({ onRetry }: { onRetry: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.destructive} />
      <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
        تعذر الاتصال بالخادم
      </Text>
      <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
        تأكد من تشغيل الخادم وحاول مرة أخرى.
      </Text>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onRetry}
        style={[styles.button, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.buttonText, { color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }]}>
          إعادة المحاولة
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  title: { fontSize: 16, marginTop: 4 },
  sub: { fontSize: 13, textAlign: 'center' },
  button: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  buttonText: { fontSize: 14 },
});
