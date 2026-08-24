// screens/AdminDashboardScreen.js
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  ScrollView,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 32;

// ---------- Translations ----------
const translations = {
  English: {
    adminDashboard: 'Admin Dashboard',
    totalUsers: 'Total Users',
    totalPosts: 'Total Posts',
    totalShops: 'Total Shops',
    totalPlaces: 'Total Places',
    totalBusinessIdeas: 'Business Ideas',
    totalMalls: 'Total Malls',
    totalReports: 'Total Reports',
    activeSubscriptions: 'Active Subs',
    expiredSubscriptions: 'Expired Subs',
    blockedUsers: 'Blocked Users',
    revenue: 'Revenue',
    totalRevenue: 'Total Revenue',
    addUpdate: 'Add Update',
    fundsAvailable: 'Earned across the platform',
    platformOverview: 'Platform overview',
    capacity: 'Total records',
    activeLabel: 'Active',
    removedLabel: 'Blocked / Stopped',
    onTrack: 'Platform is healthy',
    offTrack: 'Blocked or stopped items need attention',
    activityTrends: 'Activity trends',
    trendOfRevenue: 'Trend of revenue',
    contentTab: 'Content',
    subsTab: 'Subscriptions',
    contentBreakdown: 'Content breakdown',
    allCategories: 'All categories',
    noChartData: 'Not enough data to display a chart yet.',
    latestActivity: 'Latest activity',
    showAll: 'Show all',
    noActivity: 'No recent activity',
    ofTotal: 'of',
    logout: 'Logout',
    notProvided: 'N/A',
    ok: 'OK',
    success: 'Success',
    error: 'Error',
    payments: 'All Payments',
    paidSubscriptions: 'Paid Subscriptions',
    plan: 'Plan',
    amount: 'Amount',
    date: 'Date',
    status: 'Status',
    user: 'User',
    noPayments: 'No payments recorded yet.',
    viewAllPayments: 'View all payments',
  },
  Kinyarwanda: {
    adminDashboard: 'Ikibaho cy’umuyobozi',
    totalUsers: 'Abakoresha bose',
    totalPosts: 'Inyandiko zose',
    totalShops: 'Amaduka yose',
    totalPlaces: 'Aho hantu yose',
    totalBusinessIdeas: 'Ibitekerezo by\'ubucuruzi',
    totalMalls: 'Amaduka manini',
    totalReports: 'Imenyesha zose',
    activeSubscriptions: 'Kubyishyuza bikora',
    expiredSubscriptions: 'Kubyishyuza byashize',
    blockedUsers: 'Abakoresha bahagaritswe',
    revenue: 'Amafaranga yinjira',
    totalRevenue: 'Amafaranga yose yinjira',
    addUpdate: 'Ongeraho ikindi',
    fundsAvailable: 'Yinjiye kuri urubuga',
    platformOverview: 'Incamake y’urubuga',
    capacity: 'Ibintu byose',
    activeLabel: 'Bikora',
    removedLabel: 'Byahagaritswe',
    onTrack: 'Urubuga rukora neza',
    offTrack: 'Hari ibintu byahagaritswe bikeneye kwitabwaho',
    activityTrends: 'Aho ibintu bigenda',
    trendOfRevenue: 'Uko amafaranga agenda',
    contentTab: 'Ibirimo',
    subsTab: 'Kwishyura',
    contentBreakdown: 'Ibiranga ibirimo',
    allCategories: 'Ibyiciro byose',
    noChartData: 'Nta makuru ahagije yo kwerekana igishushanyo.',
    latestActivity: 'Ibyabaye vuba',
    showAll: 'Byose',
    noActivity: 'Nta bikorwa bwa vuba',
    ofTotal: 'kuri',
    logout: 'Sohoka',
    notProvided: 'Ntaboneka',
    ok: 'Sawa',
    success: 'Byakunze',
    error: 'Ikibazo',
    payments: 'Ishyura ryose',
    paidSubscriptions: 'Kubyishyuza byishyuwe',
    plan: 'Gahunda',
    amount: 'Amafaranga',
    date: 'Itariki',
    status: 'Imyanya',
    user: 'Umukoresha',
    noPayments: 'Nta mafaranga yishyuwe.',
    viewAllPayments: 'Reba byose',
  },
};

// ---------- Donut chart ----------
const Donut = ({ data, size = 176, strokeWidth = 22, centerLabel, centerSubLabel, trackColor }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const gap = total > 0 ? circumference * 0.012 : 0;
  let accumulated = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {total > 0 && data.map((d, i) => {
          if (d.value <= 0) return null;
          const segLength = Math.max((d.value / total) * circumference - gap, 0);
          const dashArray = `${segLength} ${circumference - segLength}`;
          const dashOffset = -accumulated;
          accumulated += (d.value / total) * circumference;
          return (
            <Circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              stroke={d.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              fill="none"
              rotation="-90"
              origin={`${center}, ${center}`}
            />
          );
        })}
      </Svg>
      <View style={StyleSheet.absoluteFillObject}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {centerLabel ? <Text style={[styles.donutCenterValue, { color: useTheme().theme.text }]}>{centerLabel}</Text> : null}
          {centerSubLabel ? <Text style={[styles.donutCenterSub, { color: useTheme().theme.textSecondary }]}>{centerSubLabel}</Text> : null}
        </View>
      </View>
    </View>
  );
};

// ---------- Payment Item ----------
const PaymentItem = ({ payment, theme, t }) => (
  <View style={[styles.paymentItem, { borderBottomColor: theme.border }]}>
    <View style={styles.paymentRow}>
      <View style={styles.paymentLeft}>
        <Text style={[styles.paymentPlan, { color: theme.text }]}>{payment.planName || payment.plan}</Text>
        <Text style={[styles.paymentUser, { color: theme.textSecondary }]}>{payment.userName || payment.userPhone || t.user}</Text>
      </View>
      <View style={styles.paymentRight}>
        <Text style={[styles.paymentAmount, { color: theme.accent }]}>
          {payment.amount} {payment.currency || 'RWF'}
        </Text>
        <Text style={[styles.paymentDate, { color: theme.textSecondary }]}>
          {new Date(payment.paymentDate || payment.date).toLocaleDateString()}
        </Text>
      </View>
    </View>
    <View style={styles.paymentStatusRow}>
      <View style={[styles.paymentStatusBadge, { backgroundColor: payment.status === 'success' ? '#4CAF50' : '#ff3b30' }]}>
        <Text style={styles.paymentStatusText}>{payment.status}</Text>
      </View>
    </View>
  </View>
);

// ---------- Main Component ----------
const AdminDashboardScreen = ({ navigation, language }) => {
  const { theme, isDarkMode } = useTheme();
  const t = translations[language] || translations.English;

  const [breakdownTab, setBreakdownTab] = useState('content');

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPosts: 0,
    totalShops: 0,
    totalPlaces: 0,
    totalBusinessIdeas: 0,
    totalMalls: 0,
    totalReports: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
    blockedUsers: 0,
    revenue: 0,
    revenueHistory: [],
    paidSubscriptions: 0,
    payments: [],
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getToken = async () => AsyncStorage.getItem('adminToken');

  const fetchDashboardData = useCallback(async () => {
    setRefreshing(true);
    try {
      const token = await getToken();
      if (!token) {
        navigation.replace('AdminLogin');
        return;
      }

      // 1. Stats
      try {
        const statsRes = await axios.get(`${BASE_URL}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (statsRes.data.success) {
          const data = statsRes.data.stats || {};
          setStats(prev => ({
            ...prev,
            ...data,
            revenue: Number(data.revenue) || 0,
            revenueHistory: data.revenueHistory || [],
            paidSubscriptions: data.paidSubscriptions || 0,
          }));
        }
      } catch (e) {
        console.warn('Stats fetch failed.');
      }

      // 2. All Payments
      try {
        const paymentsRes = await axios.get(`${BASE_URL}/api/admin/payments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (paymentsRes.data.success) {
          setStats(prev => ({
            ...prev,
            payments: paymentsRes.data.payments || [],
          }));
        }
      } catch (e) {
        console.warn('Payments fetch failed.');
        // fallback: try to extract payments from stats if available (if backend returns them)
        // but we'll keep empty array.
      }

      // 3. Public places (count + malls)
      try {
        const placesRes = await axios.get(`${BASE_URL}/api/places`);
        if (placesRes.data && Array.isArray(placesRes.data.places)) {
          const places = placesRes.data.places;
          const mallCount = places.filter(p => p.category && p.category.toLowerCase().includes('mall')).length;
          setStats(prev => ({ ...prev, totalPlaces: places.length, totalMalls: mallCount }));
        }
      } catch (e) {
        console.warn('Places fetch failed.');
      }

      // 4. Business ideas (public)
      try {
        const bizRes = await axios.get(`${BASE_URL}/api/business-ideas`);
        if (bizRes.data && Array.isArray(bizRes.data.businessIdeas)) {
          setStats(prev => ({ ...prev, totalBusinessIdeas: bizRes.data.businessIdeas.length }));
        }
      } catch (e) {
        console.warn('Business ideas fetch failed.');
      }

      // 5. Admin shops (ensure admin count matches)
      try {
        const shopsRes = await axios.get(`${BASE_URL}/api/admin/shops`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (shopsRes.data && Array.isArray(shopsRes.data.shops)) {
          setStats(prev => ({ ...prev, totalShops: shopsRes.data.shops.length }));
        }
      } catch (e) {
        // ignore if fails — stats endpoint may already contain shop counts
      }
    } catch (error) {
      console.error('Fetch dashboard data error:', error);
      if (error.response?.status === 401) navigation.replace('AdminLogin');
    } finally {
      setRefreshing(false);
      setStatsLoading(false);
    }
  }, [navigation]);

  useFocusEffect(useCallback(() => { fetchDashboardData(); }, [fetchDashboardData]));

  // Chart config
  const chartBaseConfig = useMemo(() => ({
    backgroundGradientFrom: theme.background,
    backgroundGradientTo: theme.background,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(${isDarkMode ? '200,200,200' : '107,114,128'}, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(${isDarkMode ? '150,150,160' : '150,150,160'}, ${opacity})`,
    propsForBackgroundLines: { stroke: theme.border, strokeDasharray: '0' },
    propsForLabels: { fontSize: 10 },
    propsForDots: { r: '3', strokeWidth: '2', stroke: theme.accent },
  }), [theme, isDarkMode]);

  // Render dashboard
  const renderDashboard = () => {
    if (statsLoading) {
      return (
        <View style={styles.statsLoadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      );
    }

    const capacityTotal = stats.totalUsers + stats.totalPosts + stats.totalShops + (stats.totalPlaces || 0) + (stats.totalBusinessIdeas || 0);
    const activeTotal = Math.max(capacityTotal - stats.blockedUsers, 0);
    const activePct = capacityTotal > 0 ? Math.min(activeTotal / capacityTotal, 1) : 0;
    const isHealthy = stats.blockedUsers <= Math.max(capacityTotal * 0.1, 1);

    const revenueHistory = Array.isArray(stats.revenueHistory) ? stats.revenueHistory : [];
    const hasRevenueData = revenueHistory.length > 1;
    const lineData = hasRevenueData ? {
      labels: revenueHistory.map(r => r.label),
      datasets: [{ data: revenueHistory.map(r => Number(r.value) || 0) }],
    } : null;

    const chartColors = [theme.accent, theme.text, theme.textSecondary, theme.border, theme.background];
    const contentData = [
      { label: 'Users', value: stats.totalUsers, color: chartColors[0] },
      { label: 'Posts', value: stats.totalPosts, color: chartColors[1] },
      { label: 'Shops', value: stats.totalShops, color: chartColors[2] },
      { label: t.totalPlaces, value: stats.totalPlaces || 0, color: chartColors[3] },
      { label: t.totalBusinessIdeas, value: stats.totalBusinessIdeas || 0, color: chartColors[4] },
      { label: 'Reports', value: stats.totalReports, color: chartColors[0] },
    ];
    const subsData = [
      { label: t.activeSubscriptions, value: stats.activeSubscriptions, color: chartColors[2] },
      { label: t.expiredSubscriptions, value: stats.expiredSubscriptions, color: chartColors[1] },
      { label: t.blockedUsers, value: stats.blockedUsers, color: chartColors[0] },
    ];
    const donutData = breakdownTab === 'content' ? contentData : subsData;
    const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

    const payments = stats.payments || [];

    return (
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchDashboardData} tintColor={theme.accent} />}
      >
        {/* Hero */}
        <LinearGradient
          colors={isDarkMode ? [theme.background, theme.textSecondary, theme.text] : ['#e5e7eb', '#9ca3af', '#4b5563']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroDecorCircleLg} />
          <View style={styles.heroDecorCircleSm} />
          <Text style={styles.heroLabel}>{t.totalUsers}</Text>
          <Text style={styles.heroAmount}>{stats.totalUsers}</Text>
          <Text style={styles.heroSub}>{t.platformOverview}</Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatChip}>
              <Ionicons name="people" size={16} color="#fff" />
              <Text style={styles.heroStatValue}>{stats.totalUsers}</Text>
              <Text style={styles.heroStatLabel}>{t.totalUsers}</Text>
            </View>
            <View style={styles.heroStatChip}>
              <Ionicons name="storefront-outline" size={16} color="#fff" />
              <Text style={styles.heroStatValue}>{stats.totalShops}</Text>
              <Text style={styles.heroStatLabel}>{t.totalShops}</Text>
            </View>
            <View style={styles.heroStatChip}>
              <Ionicons name="flag" size={16} color="#fff" />
              <Text style={styles.heroStatValue}>{stats.totalReports}</Text>
              <Text style={styles.heroStatLabel}>{t.totalReports}</Text>
            </View>
            <View style={styles.heroStatChip}>
              <Ionicons name="business" size={16} color="#fff" />
              <Text style={styles.heroStatValue}>{stats.totalPlaces}</Text>
              <Text style={styles.heroStatLabel}>{t.totalPlaces}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Overview */}
        <View style={[styles.overviewCard, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}>
          <View style={styles.overviewHeaderRow}>
            <Text style={[styles.overviewTitle, { color: theme.text }]}>{t.platformOverview}</Text>
            <Ionicons name="arrow-forward-circle" size={18} color={theme.textSecondary} />
          </View>
          <View style={styles.overviewNumbersRow}>
            <View>
              <Text style={[styles.overviewNumLabel, { color: theme.textSecondary }]}>{t.capacity}</Text>
              <Text style={[styles.overviewNumValue, { color: theme.text }]}>{capacityTotal}</Text>
            </View>
            <View>
              <Text style={[styles.overviewNumLabel, { color: theme.textSecondary }]}>{t.activeLabel}</Text>
              <Text style={[styles.overviewNumValue, { color: theme.text }]}>{activeTotal}</Text>
            </View>
            <View>
              <Text style={[styles.overviewNumLabel, { color: theme.textSecondary }]}>{t.removedLabel}</Text>
              <Text style={[styles.overviewNumValue, { color: theme.text }]}>{stats.blockedUsers}</Text>
            </View>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <View style={[styles.progressFill, { width: `${activePct * 100}%`, backgroundColor: theme.accent }]} />
          </View>
          <View style={styles.overviewFooterRow}>
            <Ionicons
              name={isHealthy ? 'checkmark-circle' : 'alert-circle'}
              size={14}
              color={isHealthy ? theme.accent : theme.text}
            />
            <Text style={[styles.overviewFooterText, { color: isHealthy ? theme.accent : theme.text }]}>
              {isHealthy ? t.onTrack : t.offTrack}
            </Text>
          </View>
        </View>

        {/* Trend chart */}
        <View style={[styles.trendCard, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}>
          <Text style={[styles.trendTitle, { color: theme.text }]}>{t.activityTrends}</Text>
          <Text style={[styles.trendSubtitle, { color: theme.textSecondary }]}>{t.trendOfRevenue}</Text>
          {hasRevenueData ? (
            <LineChart
              data={lineData}
              width={CHART_WIDTH}
              height={190}
              bezier
              withInnerLines={true}
              withOuterLines={false}
              withVerticalLabels={true}
              withHorizontalLabels={false}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={chartBaseConfig}
              style={styles.chartStyle}
            />
          ) : (
            <Text style={[styles.noChartText, { color: theme.textSecondary }]}>{t.noChartData}</Text>
          )}
        </View>

        {/* Donut breakdown */}
        <View style={[styles.donutCard, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}>
          <Text style={[styles.trendTitle, { color: theme.text }]}>{t.contentBreakdown}</Text>
          <View style={[styles.segmentedControl, { backgroundColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.segmentBtn, breakdownTab === 'content' && { backgroundColor: theme.background }]}
              onPress={() => setBreakdownTab('content')}
            >
              <Text style={[styles.segmentText, { color: breakdownTab === 'content' ? theme.text : theme.textSecondary }]}>{t.contentTab}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, breakdownTab === 'subs' && { backgroundColor: theme.background }]}
              onPress={() => setBreakdownTab('subs')}
            >
              <Text style={[styles.segmentText, { color: breakdownTab === 'subs' ? theme.text : theme.textSecondary }]}>{t.subsTab}</Text>
            </TouchableOpacity>
          </View>

          {donutTotal > 0 ? (
            <>
              <View style={{ alignItems: 'center', marginVertical: 12 }}>
                <Donut
                  data={donutData}
                  centerLabel={`${donutTotal}`}
                  centerSubLabel={t.allCategories}
                  trackColor={theme.border}
                />
              </View>
              <View style={{ marginTop: 8 }}>
                {donutData.filter(d => d.value > 0).map((d, idx) => {
                  const pct = donutTotal > 0 ? Math.round((d.value / donutTotal) * 100) : 0;
                  return (
                    <View key={idx} style={styles.legendRow}>
                      <View style={styles.legendTopRow}>
                        <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                        <Text style={[styles.legendPct, { color: theme.text }]}>{pct}%</Text>
                        <Text style={[styles.legendLabel, { color: theme.text }]}>{d.label}</Text>
                      </View>
                      <View style={[styles.legendTrack, { backgroundColor: theme.border }]}>
                        <View style={[styles.legendFill, { width: `${pct}%`, backgroundColor: d.color }]} />
                      </View>
                      <Text style={[styles.legendCount, { color: theme.textSecondary }]}>{d.value} {t.ofTotal} {donutTotal}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={[styles.noChartData, { color: theme.textSecondary }]}>{t.noChartData}</Text>
          )}
        </View>

        {/* NEW: All Payments – full list */}
        <View style={[styles.paymentCard, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}>
          <View style={styles.overviewHeaderRow}>
            <Text style={[styles.overviewTitle, { color: theme.text }]}>{t.payments}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AdminPayments')}>
              <Text style={[styles.viewAllText, { color: theme.accent }]}>{t.viewAllPayments}</Text>
            </TouchableOpacity>
          </View>
          {payments.length === 0 ? (
            <Text style={[styles.noChartText, { color: theme.textSecondary }]}>{t.noPayments}</Text>
          ) : (
            <>
              {payments.map((payment, index) => (
                <PaymentItem key={index} payment={payment} theme={theme} t={t} />
              ))}
            </>
          )}
        </View>
      </ScrollView>
    );
  };

  // Main render
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
       <View style={styles.topBarActions}>
          <TouchableOpacity onPress={() => navigation.navigate('AdminUser')} style={styles.topBarBtn}>
            <Ionicons name="people-outline" size={28} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Locate', { adminView: true })} style={styles.topBarBtn}>
            <Ionicons name="map-outline" size={28} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Locate', { adminView: true, showMallShops: true })} style={styles.topBarBtn}>
            <Ionicons name="storefront-outline" size={28} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('AdminPosts')} style={styles.topBarBtn}>
            <Ionicons name="document-text-outline" size={28} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('AdminReports')} style={styles.topBarBtn}>
            <Ionicons name="flag-outline" size={28} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('AdminBusinessAdd')} style={styles.topBarBtn}>
            <Ionicons name="briefcase-outline" size={28} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('AddUpdate', { isAdmin: true })} style={styles.topBarBtn}>
            <Ionicons name="add-circle-outline" size={28} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              await AsyncStorage.removeItem('adminToken');
              navigation.replace('AdminLogin');
            }}
            style={styles.topBarBtn}
          >
            <Ionicons name="log-out-outline" size={26} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1, paddingTop: 0 }}>
        {renderDashboard()}
      </View>
    </SafeAreaView>
  );
};

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  topBarTitle: { fontSize: 18, fontWeight: '700' },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBarBtn: { padding: 4 },

  statsLoadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },

  heroCard: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    padding: 16,
    overflow: 'hidden',
  },
  heroDecorCircleLg: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -60,
    right: -40,
  },
  heroDecorCircleSm: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -30,
    left: -20,
  },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  heroAmount: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 2 },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2, marginBottom: 12 },
  heroStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -4 },
  heroStatChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  heroStatValue: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 },
  heroStatLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 1 },

  overviewCard: {
    marginHorizontal: 0,
    marginTop: -20,
    borderRadius: 0,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  overviewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  overviewTitle: { fontSize: 16, fontWeight: '700' },
  overviewNumbersRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  overviewNumLabel: { fontSize: 11, marginBottom: 4 },
  overviewNumValue: { fontSize: 18, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 4 },
  overviewFooterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  overviewFooterText: { fontSize: 12, fontWeight: '600' },

  trendCard: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  trendTitle: { fontSize: 16, fontWeight: '700' },
  trendSubtitle: { fontSize: 12, marginTop: 2, marginBottom: 8 },
  chartStyle: { borderRadius: 12, marginLeft: -12 },
  noChartText: { fontSize: 13, paddingVertical: 30, textAlign: 'center' },

  donutCard: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginTop: 10,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentText: { fontSize: 12, fontWeight: '600' },
  donutCenterValue: { fontSize: 22, fontWeight: '800' },
  donutCenterSub: { fontSize: 11, marginTop: 2 },
  legendRow: { marginBottom: 12 },
  legendTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendPct: { fontSize: 13, fontWeight: '700', marginRight: 6 },
  legendLabel: { fontSize: 13, fontWeight: '600' },
  legendTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  legendFill: { height: 4, borderRadius: 2 },
  legendCount: { fontSize: 11, marginTop: 4 },

  paymentCard: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 8,
  },
  viewAllText: { fontSize: 14, fontWeight: '600' },
  paymentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLeft: { flex: 1 },
  paymentPlan: { fontSize: 16, fontWeight: '600' },
  paymentUser: { fontSize: 12, marginTop: 2 },
  paymentRight: { alignItems: 'flex-end' },
  paymentAmount: { fontSize: 16, fontWeight: '700' },
  paymentDate: { fontSize: 11, marginTop: 2 },
  paymentStatusRow: { marginTop: 4, alignItems: 'flex-start' },
  paymentStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
  },
  paymentStatusText: { color: '#fff', fontSize: 10, fontWeight: '600' },
});

export default AdminDashboardScreen;