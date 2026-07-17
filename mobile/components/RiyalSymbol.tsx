import React from 'react';
import { Image, StyleSheet } from 'react-native';

interface Props {
  size?: number;
  color?: string;
}

export function RiyalSymbol({ size = 14, color = '#FFFFFF' }: Props) {
  return (
    <Image
      source={require('@/assets/images/riyal.png')}
      style={[styles.icon, { width: size, height: size }]}
      tintColor={color}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  icon: { marginHorizontal: 1 },
});
