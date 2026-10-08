import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { networkStatus } from '../services/networkStatus';
import { syncManager } from '../services/syncManager';
import { startupPrefetch } from '../services/startupPrefetch';
import { offlineDatabase } from '../services/offlineDatabase';

export default function OfflineBanner() {
  const [online, setOnline] = useState(networkStatus.get().isOnline);
  const [syncing, setSyncing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ completed: 0, total: 4 });
  const [usage, setUsage] = useState({ usedBytes: 0, limitBytes: 300 * 1024 * 1024 });
  const [prefetchMessage, setPrefetchMessage] = useState('');

  useEffect(() => {
    const unsubscribeNetwork = networkStatus.subscribe(status => setOnline(status.isOnline));
    const unsubscribeSync = syncManager.subscribe(event => setSyncing(event.status === 'syncing'));
    const unsubscribePrefetch = startupPrefetch.subscribe(event => {
      setDownloading(event.status === 'downloading');
      setDownloadProgress({ completed: event.completed || 0, total: event.total || 4 });
      if (event.usage) setUsage(event.usage);
      if (event.status === 'complete' && event.downloaded === 0 && online) {
        setPrefetchMessage('Unable to download data - check connection');
      } else if (event.status === 'downloading') {
        setPrefetchMessage('');
      }
      offlineDatabase.getUsage().then(setUsage).catch(() => {});
    });
    offlineDatabase.getUsage().then(setUsage).catch(() => {});
    const unsubscribeUsage = offlineDatabase.subscribeUsage(setUsage);
    return () => {
      unsubscribeNetwork();
      unsubscribeSync();
      unsubscribePrefetch();
      unsubscribeUsage();
    };
  }, []);

  const usedMb = Math.max(0, usage.usedBytes / (1024 * 1024)).toFixed(0);
  const limitMb = Math.round(usage.limitBytes / (1024 * 1024));
  if (!downloading && !syncing && online) return null;

  const statusText = downloading
    ? `Updating data ${downloadProgress.completed}/${downloadProgress.total} · ${usedMb}/${limitMb} MB`
    : syncing
      ? `Syncing data · ${usedMb}/${limitMb} MB`
      : "You're offline - showing saved data";
  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.text}>{statusText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', right: 0, top: 97, zIndex: 100, paddingHorizontal: 10, paddingVertical: 6, borderBottomLeftRadius:20, backgroundColor: 'rgba(41, 59, 53, 0.21)', alignItems: 'center', elevation: 0 },
  text: { color: '#fff', fontSize: 10 },
});
