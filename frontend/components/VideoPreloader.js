import { Image } from 'react-native';

const MAX_PRELOADED_THUMBNAILS = 4;
const MAX_AGE_MS = 5 * 60 * 1000;

class VideoPreloader {
  constructor() {
    this.preloadedThumbnails = new Map();
    this.activePlayers = new Set();
    this.activeVideoKey = null;
  }

  safePausePlayer(player) {
    if (!player || typeof player.pause !== 'function') return;
    try {
      player.pause();
    } catch (error) {
      if (__DEV__) console.warn('Unable to pause an inactive video player:', error);
    }
  }

  registerPlayer(player) {
    if (player) this.activePlayers.add(player);
  }

  unregisterPlayer(player) {
    this.activePlayers.delete(player);
  }

  pauseOtherPlayers(currentPlayer) {
    for (const player of this.activePlayers) {
      if (player !== currentPlayer) this.safePausePlayer(player);
    }
  }

  pauseAll() {
    for (const player of this.activePlayers) this.safePausePlayer(player);
  }

  preloadThumbnail(thumbnailUrl, videoKey) {
    if (typeof thumbnailUrl !== 'string' || !thumbnailUrl || !videoKey ||
      this.preloadedThumbnails.has(videoKey)) return;

    const entry = { url: thumbnailUrl, timestamp: Date.now() };
    this.preloadedThumbnails.set(videoKey, entry);
    try {
      Image.prefetch(thumbnailUrl).catch(error => {
        if (this.preloadedThumbnails.get(videoKey) === entry) {
          this.preloadedThumbnails.delete(videoKey);
        }
        if (__DEV__) console.warn('Video thumbnail preload failed:', error);
      });
    } catch (error) {
      this.preloadedThumbnails.delete(videoKey);
      if (__DEV__) console.warn('Video thumbnail preload failed:', error);
    }
    this.cleanupOldThumbnails();
  }

  cleanupOldThumbnails() {
    const now = Date.now();
    for (const [key, entry] of this.preloadedThumbnails) {
      if (now - entry.timestamp > MAX_AGE_MS) this.preloadedThumbnails.delete(key);
    }

    while (this.preloadedThumbnails.size > MAX_PRELOADED_THUMBNAILS) {
      const oldestKey = this.preloadedThumbnails.keys().next().value;
      this.preloadedThumbnails.delete(oldestKey);
    }
  }

  clearAll() {
    this.pauseAll();
    this.preloadedThumbnails.clear();
    this.activeVideoKey = null;
  }
}

export const videoPreloader = new VideoPreloader();
