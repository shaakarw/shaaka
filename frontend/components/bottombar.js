import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabMode } from '../context/TabModeContext';

const BAR_ROUTES = ['WelcomeHome', 'Search', 'BuyPost', 'Locate', 'AddShop', 'Message', 'AddPost', 'Settings'];

const BottomBar = ({ state, navigation, theme, stackRouteName }) => {
  const { tabMode } = useTabMode();
  const insets = useSafeAreaInsets();
  const currentRoute = stackRouteName
    ? { name: stackRouteName, key: stackRouteName }
    : state.routes[state.index];
  const currentBuyPostTab = currentRoute?.name === 'BuyPost' ? currentRoute?.params?.activeTab || 'ushaka' : null;

  if (!currentRoute || !BAR_ROUTES.includes(currentRoute.name)) return null;
  if (currentRoute.name === 'BuyPost' && !['ushaka', 'videos'].includes(currentBuyPostTab)) return null;

  const alwaysVisible = ['WelcomeHome', 'Message'];
  const conditionalTabs = tabMode === 'shopMode' ? ['Search', 'BuyPost'] : ['Locate', 'AddShop'];
  const visibleTabNames = [...alwaysVisible, ...conditionalTabs];
  const order = tabMode === 'shopMode'
    ? ['WelcomeHome', 'Search', 'BuyPost', 'Message']
    : ['WelcomeHome', 'Locate', 'AddShop', 'Message'];
  const visibleRoutes = order
    .filter(name => visibleTabNames.includes(name))
    .map(name => stackRouteName ? { name, key: name } : state.routes.find(route => route.name === name))
    .filter(Boolean);

  const getIcon = (routeName, isFocused) => {
    switch (routeName) {
      case 'WelcomeHome': return isFocused ? 'home' : 'home-outline';
      case 'Search': return isFocused ? 'search' : 'search-outline';
      case 'BuyPost': return isFocused ? 'cart' : 'cart-outline';
      case 'Locate': return isFocused ? 'map' : 'map-outline';
      case 'AddShop': return isFocused ? 'add-circle' : 'add-circle-outline';
      case 'Message': return isFocused ? 'chatbubble' : 'chatbubble-outline';
      default: return 'ellipse-outline';
    }
  };

  const renderTab = route => {
    const originalIndex = stackRouteName ? -1 : state.routes.findIndex(item => item.key === route.key);
    const isFocused = !stackRouteName && state.index === originalIndex;
    const onPress = () => {
      try {
        if (stackRouteName) {
          navigation.navigate('Main', { screen: route.name });
          return;
        }
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
      } catch (error) {
        console.error('Tab press error:', error);
      }
    };
    return (
      <TouchableOpacity key={route.key} onPress={onPress} activeOpacity={0.7} style={styles.tabItem} accessibilityRole="button" accessibilityState={{ selected: isFocused }}>
        <Ionicons name={getIcon(route.name, isFocused)} size={24} color={isFocused ? theme.more : theme.textSecondary} />
      </TouchableOpacity>
    );
  };

  const handleCreatePress = () => {
    try {
      if (stackRouteName) return;
      if (tabMode === 'locateMode') {
        navigation.navigate('Settings');
        return;
      }
      navigation.navigate(currentRoute.name === 'Locate' ? 'AddShop' : 'AddPost');
    } catch (error) {
      console.error('Create press error:', error);
    }
  };

  const midIndex = Math.floor(visibleRoutes.length / 2);
  const settingsShortcut = (
    <TouchableOpacity
      onPress={handleCreatePress}
      activeOpacity={0.8}
      style={styles.tabItem}
      accessibilityRole="button"
      accessibilityLabel="Open settings"
    >
      <View style={styles.settingsShortcutCircle}>
  <Ionicons
    name="settings-outline"
    size={22}
    color={theme.more}
  />
</View>

    </TouchableOpacity>
  );

  return (
    <View style={[styles.tabBar, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
      {tabMode === 'locateMode' ? (
        <>
          {visibleRoutes.map(renderTab)}
          {settingsShortcut}
        </>
      ) : (
        <>
          {visibleRoutes.slice(0, midIndex).map(renderTab)}
          <TouchableOpacity onPress={handleCreatePress} activeOpacity={1} style={styles.tabItem} accessibilityRole="button" accessibilityLabel="Create post">
            <Ionicons name="add" size={40} color="#47ae87" />
          </TouchableOpacity>
          {visibleRoutes.slice(midIndex).map(renderTab)}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 10, paddingHorizontal: 6, borderTopWidth: StyleSheet.hairlineWidth, shadowColor: '#00000000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 8, zIndex: 20 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  settingsShortcutCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 0, borderColor: '#47ae87', alignItems: 'center', justifyContent: 'center' },
});

export default BottomBar;
