import { createVideoPlayer } from 'expo-video';

const MAX_PRELOADED_VIDEOS = 5;
const MAX_AGE_MS = 5 * 60 * 1000;

class VideoPreloader {
  constructor() {
    this.preloadedVideos = new Map();
    this.activePlayers = new Set();
    this.activeVideoKey = null;
  }

  safePausePlayer(player) {
    if (!player || typeof player.pause !== 'function') return;
    try {
      player.pause();
    } catch (error) {
      // expo-video may throw when a player was already released during teardown.
      // Ignore stale-player cleanup errors to avoid crashing the UI while unmounting.
    }
  }

  safeReleasePlayer(player) {
    if (!player || typeof player.release !== 'function') return;
    try {
      player.release();
    } catch (error) {
      // Ignore stale native refs during teardown.
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
    for (const entry of this.preloadedVideos.values()) this.safePausePlayer(entry.player);
  }

  preloadVideo(videoUrl, videoKey) {
    if (!videoUrl || !videoKey || this.preloadedVideos.has(videoKey)) return;

    try {
      const player = createVideoPlayer(videoUrl);
      player.loop = true;
      player.muted = true;
      player.timeUpdateEventInterval = 0;
      this.preloadedVideos.set(videoKey, { player, url: videoUrl, timestamp: Date.now() });
      this.cleanupOldVideos();
    } catch (error) {
      console.warn('Video preload failed:', error);
    }
  }

  removeVideo(videoKey) {
    const entry = this.preloadedVideos.get(videoKey);
    if (entry?.player) {
      this.safePausePlayer(entry.player);
      this.safeReleasePlayer(entry.player);
    }
    this.preloadedVideos.delete(videoKey);
  }

  cleanupOldVideos() {
    const now = Date.now();
    for (const [key, entry] of this.preloadedVideos) {
      if (now - entry.timestamp > MAX_AGE_MS || key !== this.activeVideoKey) {
        entry.expired = now - entry.timestamp > MAX_AGE_MS;
      }
    }

    const candidates = Array.from(this.preloadedVideos.entries())
      .filter(([key, entry]) => key !== this.activeVideoKey && (entry.expired || this.preloadedVideos.size > MAX_PRELOADED_VIDEOS))
      .sort((first, second) => first[1].timestamp - second[1].timestamp);
    const removeCount = Math.max(0, this.preloadedVideos.size - MAX_PRELOADED_VIDEOS);
    candidates.slice(0, removeCount || candidates.filter(([, entry]) => entry.expired).length)
      .forEach(([key]) => this.removeVideo(key));
  }

  clearAll() {
    for (const key of this.preloadedVideos.keys()) this.removeVideo(key);
    this.pauseAll();
    this.activeVideoKey = null;
  }
}

export const videoPreloader = new VideoPreloader();