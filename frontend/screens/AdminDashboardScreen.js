// screens/AdminDashboardScreen.js
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import Svg, { Circle } from 'react-native-svg';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';

const { width } = Dimensions.get('window');

// Layout tokens (8px grid)
const H_PADDING = 16;
const CARD_RADIUS = 16;
const CARD_GAP = 12;
const CARD_PADDING = 16;
const CHART_WIDTH = width - H_PADDING * 2 - CARD_PADDING * 2;

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
    liveChat: 'Live Chat',
    liveChatDescription: 'Open customer conversations and reply in real time.',
    passwordAccess: 'Password',
    quickAccess: 'Quick access',
    platformActivity: 'Platform activity',
    postsLast30Days: 'Posts created in the selected period',
    noPostActivity: 'No post activity in this period.',
    monthly: 'Monthly',
    weekly: 'Weekly',
    today: 'Today',
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
    liveChat: 'Ikiganiro ako kanya',
    liveChatDescription: 'Fungura ibiganiro by’abakiriya ubasubize ako kanya.',
    passwordAccess: 'Ijambo banga',
    quickAccess: 'Aho uhera vuba',
    platformActivity: 'Ibikorwa bya porogaramu',
    postsLast30Days: 'Inyandiko zakozwe mu gihe cyatoranyijwe',
    noPostActivity: 'Nta nyandiko zakozwe muri iki gihe.',
    monthly: 'Ukwezi',
    weekly: 'Icyumweru',
    today: 'Uyu munsi',
  },
};

// ---------- Skeleton ----------
const Skeleton = ({ theme, style }) => {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ backgroundColor: theme.border, borderRadius: 8, opacity }, style]}
    />
  );
};

const DashboardSkeleton = ({ theme }) => (
  <View style={styles.skeletonWrap}>
    {/* Hero */}
    <Skeleton theme={theme} style={styles.skelHero} />
    {/* Overview */}
    <Skeleton theme={theme} style={styles.skelCard} />
    {/* Trend */}
    <Skeleton theme={theme} style={styles.skelChart} />
    {/* Donut */}
    <Skeleton theme={theme} style={styles.skelCard} />
  </View>
);

// ---------- Donut chart ----------
const Donut = ({
  data,
  size = 176,
  strokeWidth = 22,
  centerLabel,
  centerSubLabel,
  trackColor,
  textColor,
  subTextColor,
}) => {
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
        {total > 0 &&
          data.map((d, i) => {
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
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.donutCenterWrap}>
          {centerLabel ? (
            <Text style={[styles.donutCenterValue, { color: textColor }]}>{centerLabel}</Text>
          ) : null}
          {centerSubLabel ? (
            <Text style={[styles.donutCenterSub, { color: subTextColor }]}>{centerSubLabel}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

// ---------- Section Header ----------
const SectionHeader = ({ title, actionLabel, onAction, theme }) => (
  <View style={styles.sectionHeader}>
    <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
    {actionLabel && onAction ? (
      <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={[styles.sectionAction, { color: theme.accent }]}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

// ---------- Main Component ----------
const AdminDashboardScreen = ({ navigation, language }) => {
  const { theme, isDarkMode } = useTheme();
  const t = translations[language] || translations.English;

  const [breakdownTab, setBreakdownTab] = useState('content');
  const [activityPeriod, setActivityPeriod] = useState('week');

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
    paidSubscriptions: 0,
    activityHistory: [],
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
          setStats((prev) => ({
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

      // 2. Public places (count + malls)
      try {
        const placesRes = await axios.get(`${BASE_URL}/api/places`);
        if (placesRes.data && Array.isArray(placesRes.data.places)) {
          const places = placesRes.data.places;
          const mallCount = places.filter(
            (p) => p.category && p.category.toLowerCase().includes('mall')
          ).length;
          setStats((prev) => ({ ...prev, totalPlaces: places.length, totalMalls: mallCount }));
        }
      } catch (e) {
        console.warn('Places fetch failed.');
      }

      // 3. Business ideas (public)
      try {
        const bizRes = await axios.get(`${BASE_URL}/api/business-ideas`);
        if (bizRes.data && Array.isArray(bizRes.data.businessIdeas)) {
          setStats((prev) => ({ ...prev, totalBusinessIdeas: bizRes.data.businessIdeas.length }));
        }
      } catch (e) {
        console.warn('Business ideas fetch failed.');
      }

      // 4. Admin shops (ensure admin count matches)
      try {
        const shopsRes = await axios.get(`${BASE_URL}/api/admin/shops`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (shopsRes.data && Array.isArray(shopsRes.data.shops)) {
          setStats((prev) => ({ ...prev, totalShops: shopsRes.data.shops.length }));
        }
      } catch (e) {
        // ignore — stats endpoint may already contain shop counts
      }
    } catch (error) {
      console.error('Fetch dashboard data error:', error);
      if (error.response?.status === 401) navigation.replace('AdminLogin');
    } finally {
      setRefreshing(false);
      setStatsLoading(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  const handleLogout = useCallback(async () => {
    await AsyncStorage.removeItem('adminToken');
    navigation.replace('AdminLogin');
  }, [navigation]);

  // Top bar actions — kept in an array so the row stays compact & scrollable
  const topActions = useMemo(
    () => [
      { key: 'users', icon: 'people-outline', label: 'Users', onPress: () => navigation.navigate('AdminUser') },
      {
        key: 'map',
        icon: 'map-outline',
        label: 'Map',
        onPress: () => navigation.navigate('Locate', { adminView: true }),
      },
      {
        key: 'shops',
        icon: 'storefront-outline',
        label: 'Shops',
        onPress: () => navigation.navigate('Locate', { adminView: true, showMallShops: true }),
      },
      { key: 'posts', icon: 'document-text-outline', label: 'Posts', onPress: () => navigation.navigate('AdminPosts') },
      { key: 'reports', icon: 'flag-outline', label: 'Reports', onPress: () => navigation.navigate('AdminReports') },
      { key: 'business', icon: 'briefcase-outline', label: 'Ideas', onPress: () => navigation.navigate('AdminBusinessAdd') },
      { key: 'chat', icon: 'chatbubbles-outline', label: t.liveChat, onPress: () => navigation.navigate('AdminLiveChat') },
      { key: 'password', icon: 'lock-closed-outline', label: t.passwordAccess, onPress: () => navigation.navigate('ChangePassword', { adminMode: true }) },
      {
        key: 'add',
        icon: 'add-circle-outline',
        label: 'Update',
        onPress: () => navigation.navigate('AddUpdate', { isAdmin: true }),
      },
      { key: 'logout', icon: 'log-out-outline', label: 'Log out', onPress: handleLogout },
    ],
    [navigation, handleLogout, t]
  );

  // Chart config
  const chartBaseConfig = useMemo(
    () => ({
      backgroundGradientFrom: theme.background,
      backgroundGradientTo: theme.background,
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(${isDarkMode ? '200,200,200' : '107,114,128'}, ${opacity})`,
      labelColor: (opacity = 1) =>
        `rgba(${isDarkMode ? '150,150,160' : '150,150,160'}, ${opacity})`,
      propsForBackgroundLines: { stroke: theme.border, strokeDasharray: '0' },
      propsForLabels: { fontSize: 10 },
      propsForDots: { r: '3', strokeWidth: '2', stroke: theme.accent },
    }),
    [theme, isDarkMode]
  );

  // ---------- Dashboard body ----------
  const renderDashboard = () => {
    if (statsLoading) return <ShaakaLoadingScreen message={t.loading} backgroundColor={theme.background} textColor={theme.text} />;

    const capacityTotal =
      stats.totalUsers +
      stats.totalPosts +
      stats.totalShops +
      (stats.totalPlaces || 0) +
      (stats.totalBusinessIdeas || 0);
    const activeTotal = Math.max(capacityTotal - stats.blockedUsers, 0);
    const activePct = capacityTotal > 0 ? Math.min(activeTotal / capacityTotal, 1) : 0;
    const isHealthy = stats.blockedUsers <= Math.max(capacityTotal * 0.1, 1);

    const activityHistory = Array.isArray(stats.activityHistory) ? stats.activityHistory : [];
    const activityWindow = activityPeriod === 'month' ? 30 : activityPeriod === 'today' ? 1 : 7;
    const visibleActivity = activityHistory.slice(-activityWindow);
    const hasActivityData = visibleActivity.some((entry) => Number(entry.value) > 0);
    const lineData = hasActivityData
      ? {
          labels: visibleActivity.map((entry, index) => {
            if (activityPeriod === 'today') return t.today;
            if (activityPeriod === 'month' && index % 5 !== 0) return '';
            return activityPeriod === 'month' && entry.date
              ? new Date(`${entry.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
              : entry.label;
          }),
          datasets: [{ data: visibleActivity.map((entry) => Number(entry.value) || 0) }],
        }
      : null;

    const chartColors = [theme.accent, theme.text, theme.textSecondary, theme.border, theme.background];

    const contentData = [
      { label: 'Users', value: stats.totalUsers, color: chartColors[0] },
      { label: 'Posts', value: stats.totalPosts, color: chartColors[1] },
      { label: 'Shops', value: stats.totalShops, color: chartColors[2] },
      { label: t.totalPlaces, value: stats.totalPlaces || 0, color: chartColors[3] },
      { label: t.totalBusinessIdeas, value: stats.totalBusinessIdeas || 0, color: '#47ae87' },
      { label: 'Reports', value: stats.totalReports, color: '#d87428' },
    ];

    const subsData = [
      { label: t.activeSubscriptions, value: stats.activeSubscriptions, color: chartColors[2] },
      { label: t.expiredSubscriptions, value: stats.expiredSubscriptions, color: chartColors[1] },
      { label: t.blockedUsers, value: stats.blockedUsers, color: chartColors[0] },
    ];

    const donutData = breakdownTab === 'content' ? contentData : subsData;
    const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

    const metricCards = [
      { key: 'users', label: t.totalUsers, value: stats.totalUsers, icon: 'people-outline', color: '#3f8f70' },
      { key: 'posts', label: t.totalPosts, value: stats.totalPosts, icon: 'document-text-outline', color: '#4082b7' },
      { key: 'shops', label: t.totalShops, value: stats.totalShops, icon: 'storefront-outline', color: '#d58a3a' },
      { key: 'reports', label: t.totalReports, value: stats.totalReports, icon: 'flag-outline', color: '#cf6679' },
    ];

    return (
      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchDashboardData}
            tintColor={theme.accent}
          />
        }
      >
        <View style={styles.metricGrid}>
          {metricCards.map((metric) => (
            <View key={metric.key} style={[styles.metricCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <View style={[styles.metricIcon, { backgroundColor: `${metric.color}18` }]}>
                <Ionicons name={metric.icon} size={20} color={metric.color} />
              </View>
              <Text style={[styles.metricValue, { color: theme.text }]}>{metric.value}</Text>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]} numberOfLines={1}>{metric.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.liveChatCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <View style={[styles.liveChatIcon, { backgroundColor: `${theme.accent}18` }]}>
            <Ionicons name="chatbubbles-outline" size={23} color={theme.accent} />
          </View>
          <View style={styles.liveChatCopy}>
            <Text style={[styles.liveChatTitle, { color: theme.text }]}>{t.liveChat}</Text>
            <Text style={[styles.liveChatSubtitle, { color: theme.textSecondary }]}>{t.liveChatDescription}</Text>
          </View>
          <TouchableOpacity
            style={[styles.liveChatButton, { backgroundColor: theme.accent }]}
            onPress={() => navigation.navigate('AdminLiveChat')}
            accessibilityRole="button"
            accessibilityLabel={t.liveChat}
          >
            <Ionicons name="arrow-forward" size={19} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.quickToolsHeader}>
          <Text style={[styles.quickToolsTitle, { color: theme.text }]}>{t.quickAccess}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickToolsRow}>
          {topActions.filter((action) => !['chat', 'logout'].includes(action.key)).map((action) => (
            <TouchableOpacity
              key={action.key}
              style={[styles.quickTool, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Ionicons name={action.icon} size={20} color={theme.accent} />
              <Text style={[styles.quickToolLabel, { color: theme.textSecondary }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Trend chart */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        >
          <SectionHeader title={t.platformActivity} theme={theme} />
          <Text style={[styles.trendSubtitle, { color: theme.textSecondary }]}>{t.postsLast30Days}</Text>
          <View style={[styles.periodControl, { backgroundColor: theme.border }]}>
            {[
              { key: 'month', label: t.monthly },
              { key: 'week', label: t.weekly },
              { key: 'today', label: t.today },
            ].map((period) => (
              <TouchableOpacity
                key={period.key}
                style={[styles.periodButton, activityPeriod === period.key && { backgroundColor: theme.cardBackground }]}
                onPress={() => setActivityPeriod(period.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: activityPeriod === period.key }}
              >
                <Text style={[styles.periodLabel, { color: activityPeriod === period.key ? theme.text : theme.textSecondary }]}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {hasActivityData ? (
            <LineChart
              data={lineData}
              width={CHART_WIDTH}
              height={190}
              bezier
              withInnerLines
              withOuterLines={false}
              withVerticalLabels
              withHorizontalLabels={false}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={chartBaseConfig}
              style={styles.chartStyle}
            />
          ) : (
            <Text style={[styles.noChartText, { color: theme.textSecondary }]}>
              {t.noPostActivity}
            </Text>
          )}
        </View>

        {/* Donut breakdown */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        >
          <SectionHeader title={t.contentBreakdown} theme={theme} />

          <View style={[styles.segmentedControl, { backgroundColor: theme.border }]}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                breakdownTab === 'content' && { backgroundColor: theme.background },
              ]}
              activeOpacity={0.8}
              onPress={() => setBreakdownTab('content')}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: breakdownTab === 'content' ? theme.text : theme.textSecondary },
                ]}
              >
                {t.contentTab}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                breakdownTab === 'subs' && { backgroundColor: theme.background },
              ]}
              activeOpacity={0.8}
              onPress={() => setBreakdownTab('subs')}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: breakdownTab === 'subs' ? theme.text : theme.textSecondary },
                ]}
              >
                {t.subsTab}
              </Text>
            </TouchableOpacity>
          </View>

          {donutTotal > 0 ? (
            <>
              <View style={styles.donutWrap}>
                <Donut
                  data={donutData}
                  centerLabel={`${donutTotal}`}
                  centerSubLabel={t.allCategories}
                  trackColor={theme.border}
                  textColor={theme.text}
                  subTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.legendWrap}>
                {donutData
                  .filter((d) => d.value > 0)
                  .map((d, idx) => {
                    const pct = donutTotal > 0 ? Math.round((d.value / donutTotal) * 100) : 0;
                    return (
                      <View key={idx} style={styles.legendRow}>
                        <View style={styles.legendTopRow}>
                          <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                          <Text style={[styles.legendPct, { color: theme.text }]}>{pct}%</Text>
                          <Text style={[styles.legendLabel, { color: theme.text }]} numberOfLines={1}>
                            {d.label}
                          </Text>
                        </View>
                        <View style={[styles.legendTrack, { backgroundColor: theme.border }]}>
                          <View
                            style={[styles.legendFill, { width: `${pct}%`, backgroundColor: d.color }]}
                          />
                        </View>
                        <Text style={[styles.legendCount, { color: theme.textSecondary }]}>
                          {d.value} {t.ofTotal} {donutTotal}
                        </Text>
                      </View>
                    );
                  })}
              </View>
            </>
          ) : (
            <Text style={[styles.noChartText, { color: theme.textSecondary }]}>
              {t.noChartData}
            </Text>
          )}
        </View>

      </ScrollView>
    );
  };

  // ---------- Main render ----------
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top bar */}
      <View
        style={[
          styles.topBar,
          { borderBottomColor: theme.border, backgroundColor: theme.background },
        ]}
      >
        <View style={styles.topBarHeading}>
          <Text style={[styles.topBarEyebrow, { color: theme.accent }]}>SHAaka / ADMIN</Text>
          <Text style={[styles.topBarTitle, { color: theme.text }]} numberOfLines={1}>Dashboard</Text>
        </View>
        <TouchableOpacity
          style={[styles.topBarBtn, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
          onPress={() => navigation.navigate('AdminLiveChat')}
          accessibilityRole="button"
          accessibilityLabel={t.liveChat}
        >
          <Ionicons name="chatbubbles-outline" size={22} color={theme.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.topBarBtn, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Ionicons name="log-out-outline" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.flex}>{renderDashboard()}</View>
    </SafeAreaView>
  );
};

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PADDING,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  topBarHeading: { flex: 1, marginRight: 12 },
  topBarEyebrow: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  topBarTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  topBarBtn: {
    width: 42,
    height: 42,
    marginLeft: 8,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scrollContent: { paddingBottom: 28, paddingTop: 6 },

  // Skeleton
  skeletonWrap: { paddingTop: CARD_GAP },
  skelHero: { height: 172, borderRadius: 20, marginHorizontal: H_PADDING },
  skelCard: {
    height: 150,
    borderRadius: CARD_RADIUS,
    marginHorizontal: H_PADDING,
    marginTop: CARD_GAP,
  },
  skelChart: {
    height: 240,
    borderRadius: CARD_RADIUS,
    marginHorizontal: H_PADDING,
    marginTop: CARD_GAP,
  },

  // Generic card
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    marginHorizontal: H_PADDING,
    marginTop: CARD_GAP,
    padding: CARD_PADDING,
  },
  cardLast: { marginBottom: 8 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionAction: { fontSize: 13, fontWeight: '600' },

  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: H_PADDING,
  },
  metricCard: {
    width: '48.5%',
    minHeight: 122,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  metricIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  metricLabel: { fontSize: 12, marginTop: 1 },
  liveChatCard: {
    marginHorizontal: H_PADDING,
    marginTop: CARD_GAP,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveChatIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  liveChatCopy: { flex: 1, marginHorizontal: 12 },
  liveChatTitle: { fontSize: 15, fontWeight: '700' },
  liveChatSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  liveChatButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  quickToolsHeader: { paddingHorizontal: H_PADDING, paddingTop: 18, paddingBottom: 8 },
  quickToolsTitle: { fontSize: 16, fontWeight: '700' },
  quickToolsRow: { paddingHorizontal: H_PADDING, gap: 8 },
  quickTool: { width: 72, height: 68, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickToolLabel: { fontSize: 10, fontWeight: '600', marginTop: 5 },

  // Hero
  heroCard: {
    marginHorizontal: H_PADDING,
    marginTop: CARD_GAP,
    borderRadius: 20,
    padding: CARD_PADDING,
    overflow: 'hidden',
  },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  heroAmount: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 2 },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2, marginBottom: 12 },
  heroStatsRow: { flexDirection: 'row', marginHorizontal: -4 },
  heroStatChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  heroStatValue: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    marginTop: 1,
    paddingHorizontal: 2,
  },

  // Overview
  overviewNumbersRow: { flexDirection: 'row', marginBottom: 12 },
  overviewNumCol: { flex: 1 },
  overviewNumLabel: { fontSize: 11, marginBottom: 4 },
  overviewNumValue: { fontSize: 18, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 4 },
  overviewFooterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  overviewFooterText: { fontSize: 12, fontWeight: '600' },

  // Trend
  trendSubtitle: { fontSize: 12, marginTop: -6, marginBottom: 8 },
  chartStyle: { borderRadius: 12, marginLeft: -8 },
  periodControl: { flexDirection: 'row', borderRadius: 8, padding: 3, marginBottom: 8, alignSelf: 'flex-start' },
  periodButton: { minWidth: 64, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  periodLabel: { fontSize: 11, fontWeight: '600' },

  // Donut
  donutWrap: { alignItems: 'center', marginVertical: 12 },
  donutCenterWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  donutCenterValue: { fontSize: 22, fontWeight: '800' },
  donutCenterSub: { fontSize: 11, marginTop: 2 },
  legendWrap: { marginTop: 8 },
  legendRow: { marginBottom: 12 },
  legendTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendPct: { fontSize: 13, fontWeight: '700', marginRight: 6 },
  legendLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  legendTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  legendFill: { height: 4, borderRadius: 2 },
  legendCount: { fontSize: 11, marginTop: 4 },

  // Segmented control
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentText: { fontSize: 12, fontWeight: '600' },

  // Payments
  paymentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLeft: { flex: 1, paddingRight: 12 },
  paymentPlan: { fontSize: 15, fontWeight: '600' },
  paymentUser: { fontSize: 12, marginTop: 2 },
  paymentRight: { alignItems: 'flex-end' },
  paymentAmount: { fontSize: 15, fontWeight: '700' },
  paymentDate: { fontSize: 11, marginTop: 2 },
  paymentStatusRow: { marginTop: 6, alignItems: 'flex-start' },
  paymentStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
  },
  paymentStatusText: { color: '#fff', fontSize: 10, fontWeight: '600' },

  noChartText: { fontSize: 13, paddingVertical: 24, textAlign: 'center' },
});

export default AdminDashboardScreen;