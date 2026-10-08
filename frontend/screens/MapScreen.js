import { MapView, UrlTile } from '../components/MapViewLoader';
import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { networkStatus } from '../services/networkStatus';
import { offlineDatabase } from '../services/offlineDatabase';

const DEFAULT_REGION = {
  latitude: -1.9441,
  longitude: 30.0619,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapScreen() {
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [isOnline, setIsOnline] = useState(networkStatus.get().isOnline);

  useEffect(() => {
    offlineDatabase.getRecord('map', 'last-region').then(savedRegion => {
      if (savedRegion) setRegion(savedRegion);
    });
    return networkStatus.subscribe(status => setIsOnline(status.isOnline));
  }, []);

  const handleRegionChange = nextRegion => {
    setRegion(nextRegion);
    offlineDatabase.putRecord('map', 'last-region', nextRegion, { priority: 'high' });
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region} onRegionChangeComplete={handleRegionChange}>
        <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
      </MapView>
      {!isOnline && <View style={styles.banner}><Text style={styles.bannerText}>You're offline - showing saved map position</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  banner: { position: 'absolute', top: 10, left: 12, right: 12, padding: 8, backgroundColor: '#293b35', alignItems: 'center' },
  bannerText: { color: '#fff', fontSize: 12 },
});