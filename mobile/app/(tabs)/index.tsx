import React, { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useFinancialHealth } from '@/context/FinancialHealthContext';
import { RiyalSymbol } from '@/components/RiyalSymbol';

const QUICK_ACTIONS = [
  { icon: 'receipt-outline', label: 'دفع الفواتير', badge: '2' },
  { icon: 'flash-outline', label: 'الحوالات', badge: null },
  { icon: 'phone-portrait-outline', label: 'شحن الجوال', badge: null },
  { icon: 'car-outline', label: 'المخالفات', badge: null },
];

const ACCOUNTS = [
  { id: '1', name: 'الحساب الادخاري الخاص ب حليمة 9001', type: 'جاري', iban: '•••• 9001' },
  { id: '2', name: 'حساب التوفير 4521', type: 'توفير', iban: '•••• 4521' },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { score, scoreLabel } = useFinancialHealth();

  const [balanceVisible, setBalanceVisible] = useState(false);
  const [activeAccount, setActiveAccount] = useState(0);

  const topPad = Platform.OS === 'web' ? 16 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 : insets.bottom + 49;
  const cardWidth = Math.min(width - 32, 420);

  const handleFHPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/financial-health');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ─── Header ─── */}
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.background }]}>
        {/* Right: greeting + avatar — no real user/name field exists on the
            backend (Twin has no name, only anonymized demographics), so
            this stays a generic greeting rather than a fabricated name. */}
        <View style={styles.headerUser}>
          <View style={styles.userTextGroup}>
            <Text style={[styles.userName, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              مرحباً بك
            </Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '33', borderColor: colors.primary + '66' }]}>
            <Ionicons name="person" size={18} color={colors.primary} />
          </View>
        </View>

        {/* Left: action icons */}
        <View style={styles.headerIcons}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]}>
            <Ionicons name="exit-outline" size={19} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]}>
            <Ionicons name="notifications-outline" size={19} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]}>
            <Ionicons name="pencil-outline" size={19} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Scroll body ─── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 16 }]}
      >
        {/* Account cards carousel */}
        <View style={styles.carouselSection}>
          <FlatList
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            data={ACCOUNTS}
            keyExtractor={item => item.id}
            snapToInterval={cardWidth + 16}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
            onMomentumScrollEnd={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + 16));
              setActiveAccount(Math.max(0, Math.min(idx, ACCOUNTS.length - 1)));
            }}
            renderItem={({ item }) => (
              <LinearGradient
                colors={['#0D2340', '#091525']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.accountCard, { width: cardWidth, borderColor: colors.border }]}
              >
                {/* Account name row */}
                <View style={styles.accountNameRow}>
                  <View style={[styles.accountTypeBadge, { backgroundColor: colors.primary + '22', borderColor: colors.primary + '44' }]}>
                    <Text style={[styles.accountTypeText, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
                      {item.type}
                    </Text>
                  </View>
                  <Text style={[styles.accountName, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>

                {/* Balance */}
                <View style={styles.balanceRow}>
                  <TouchableOpacity
                    onPress={() => setBalanceVisible(v => !v)}
                    style={[styles.eyeBtn, { backgroundColor: colors.muted }]}
                  >
                    <Ionicons
                      name={balanceVisible ? 'eye-outline' : 'eye-off-outline'}
                      size={16}
                      color={colors.mutedForeground}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.balance, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                    {balanceVisible ? '12,450.00' : '•••••••'}
                  </Text>
                  <RiyalSymbol size={14} color={colors.mutedForeground} />
                </View>

                {/* IBAN */}
                <Text style={[styles.iban, { color: colors.mutedForeground + 'AA', fontFamily: 'Inter_400Regular' }]}>
                  {item.iban}
                </Text>
              </LinearGradient>
            )}
          />

          {/* Dots */}
          <View style={styles.dots}>
            {ACCOUNTS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === activeAccount ? colors.primary : colors.border,
                    width: i === activeAccount ? 16 : 6,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {/* ─── Financial Health Card ─── */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleFHPress}
          style={[styles.fhCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.fhHeaderRow}>
            <View style={styles.fhTitleGroup}>
              <View style={[styles.fhIconWrap, { backgroundColor: colors.primary + '22' }]}>
                <Ionicons name="heart-circle-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.fhTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                الصحة المالية
              </Text>
            </View>
            <Ionicons name="chevron-back" size={17} color={colors.mutedForeground} />
          </View>

          <View style={styles.fhProgressSection}>
            <View style={styles.fhProgressLabelRow}>
              <Text style={[styles.fhScoreLabel, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
                {scoreLabel}
              </Text>
              <Text style={[styles.fhScoreNum, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                {score} / 100
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border, transform: [{ scaleX: -1 }] }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${score}%`, backgroundColor: colors.primary },
                ]}
              />
            </View>
            <Text style={[styles.fhHint, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              {score >= 75 ? 'أنت في أفضل حالاتك المالية' : `${Math.max(0, 75 - score)} نقاط تفصلك عن الصحة الممتازة`}
            </Text>
          </View>
        </TouchableOpacity>


        {/* ─── Simulator Card ─── */}
        <View style={[styles.simCard, { backgroundColor: colors.primary }]}>
          {/* Header */}
          <View style={styles.simHeader}>
            <View style={[styles.simIconWrap, { backgroundColor: '#ffffff22' }]}>
              <Ionicons name="flask-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.simTexts}>
              <Text style={[styles.simTitle, { color: '#FFFFFF', fontFamily: 'Inter_700Bold' }]}>
                محاكي القرارات المالية
              </Text>
              <Text style={[styles.simSub, { color: '#ffffffCC', fontFamily: 'Inter_400Regular' }]}>
                اعرف الأثر قبل أن تقرر
              </Text>
            </View>
          </View>
          {/* CTA */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/financial-health/simulator')}
            style={styles.simBtn}
          >
            <Text style={[styles.simBtnText, { fontFamily: 'Inter_700Bold' }]}>جرّب الآن</Text>
            <Ionicons name="chevron-back" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ─── Quick Actions ─── */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionMore, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
            المزيد
          </Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            الخدمات السريعة
          </Text>
        </View>

        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map((action, i) => (
            <TouchableOpacity key={i} style={styles.qaItem} activeOpacity={0.7}>
              <View style={[styles.qaIconWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {action.badge && (
                  <View style={[styles.qaBadge, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.qaBadgeText, { fontFamily: 'Inter_700Bold' }]}>{action.badge}</Text>
                  </View>
                )}
                <Ionicons name={action.icon as any} size={24} color={colors.foreground} />
              </View>
              <Text style={[styles.qaLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── Promo Banner ─── */}
        <LinearGradient
          colors={['#112E4F', '#0A1F35']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.promoBanner, { borderColor: colors.border }]}
        >
          <View style={[styles.promoIconWrap, { backgroundColor: colors.primary + '22' }]}>
            <Ionicons name="gift-outline" size={26} color={colors.primary} />
          </View>
          <View style={styles.promoText}>
            <Text style={[styles.promoTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              بنقطتين
            </Text>
            <View style={[styles.promoBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.promoBadgeText, { fontFamily: 'Inter_700Bold' }]}>خصم 20%</Text>
            </View>
            <Text style={[styles.promoSub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              في أكثر من 100 متجر شريك
            </Text>
          </View>
          <Ionicons name="chevron-back" size={18} color={colors.mutedForeground} />
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerUser: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  userTextGroup: { alignItems: 'flex-end', gap: 1 },
  greeting: { fontSize: 12 },
  userName: { fontSize: 18 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarText: { fontSize: 18 },
  // Scroll
  scrollContent: { gap: 16, paddingTop: 4 },
  // Carousel
  carouselSection: { gap: 10 },
  accountCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  accountNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  accountName: { fontSize: 12, flex: 1, textAlign: 'right' },
  accountTypeBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  accountTypeText: { fontSize: 11 },
  balanceRow: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 8 },
  balance: { fontSize: 28 },
  currency: { fontSize: 14, marginBottom: 2 },
  eyeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iban: { fontSize: 12, textAlign: 'right', letterSpacing: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  dot: { height: 6, borderRadius: 3 },
  // FH Card
  fhCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  fhHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  fhTitleGroup: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  fhIconWrap: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fhTitle: { fontSize: 15 },
  fhProgressSection: { gap: 8 },
  fhProgressLabelRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  fhScoreNum: { fontSize: 18 },
  fhScoreLabel: { fontSize: 13 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  fhHint: { fontSize: 11, textAlign: 'right' },
  // Section
  sectionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  sectionTitle: { fontSize: 15 },
  sectionMore: { fontSize: 13 },
  // Quick Actions
  quickActions: { flexDirection: 'row-reverse', paddingHorizontal: 16, gap: 8 },
  qaItem: { flex: 1, alignItems: 'center', gap: 6 },
  qaIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  qaBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  qaBadgeText: { color: '#FFFFFF', fontSize: 10 },
  qaLabel: { fontSize: 10, textAlign: 'center', lineHeight: 14 },
  // Simulator card
  simCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  simHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  simIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  simTexts: { flex: 1, gap: 3, alignItems: 'flex-end' },
  simTitle: { fontSize: 14 },
  simSub: { fontSize: 12 },
  simBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 11,
  },
  simBtnText: { color: '#E07A5F', fontSize: 15 },
  simChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  simChipText: { fontSize: 11 },
  // Promo
  promoBanner: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  promoIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  promoText: { flex: 1, gap: 4, alignItems: 'flex-end' },
  promoTitle: { fontSize: 18 },
  promoBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  promoBadgeText: { color: '#FFFFFF', fontSize: 12 },
  promoSub: { fontSize: 11, textAlign: 'right' },
});
