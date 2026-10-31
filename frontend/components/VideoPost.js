import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, ActivityIndicator, Linking, StyleSheet, Dimensions, Animated } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Ionicons } from '@expo/vector-icons';
import VideoPlayerControls from './VideoPlayerControls';
import { videoPreloader } from './VideoPreloader';
import VideoBackground from './VideoBackground';
import { requestVideoBackground } from '../services/videoBackgroundService';
import { getImageUri, normalizeImageSource } from '../utils/imageUrl';

const MIN_VIDEO_HEIGHT = 200;
const MAX_VIDEO_HEIGHT = 750;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const safePlayerAction = (player, methodName, ...args) => {
  if (!player || typeof player[methodName] !== 'function') return false;

  try {
    return player[methodName](...args);
  } catch {
    return false;
  }
};

const VideoPost = ({ 
  videoUrl, 
  videoId,
  videoThumbnail, 
  videoLink, 
  videoDuration = 0, 
  videoSizeBytes = 0,
  theme,
  containerHeight = null,
  isVisible = false,
  muted = true,
  onMuteChange,
  progressColor = '#fff',
  centerControlSize = 48,
  contentFit = 'cover',
  showPlaybackControls = true,
  showTopMute,
  showBottomMute,
  controlsAlwaysVisible = false,
  centerControlOnPauseOnly = false,
  onVideoPress,
}) => {
  const thumbnailUri = getImageUri(videoThumbnail);
  const [duration, setDuration] = useState(Number(videoDuration) || 0);
  const [ready, setReady] = useState(false);
  const [coverImage, setCoverImage] = useState(thumbnailUri);
  const [videoSize, setVideoSize] = useState({ width: 9, height: 16 });
  const [background, setBackground] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlayNotice, setAutoPlayNotice] = useState(0);
  const manualOverride = useRef(null);
  
  useEffect(() => {
    let isMounted = true;

    const generateCover = async () => {
      if (!videoUrl) return;

      if (thumbnailUri) {
        setCoverImage(thumbnailUri);
        return;
      }

      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUrl, {
          time: 3000,
          quality: 0.8,
        });
        if (isMounted) setCoverImage(uri);
      } catch (firstError) {
        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(videoUrl, {
            time: 1000,
            quality: 0.5,
          });
          if (isMounted) setCoverImage(uri);
        } catch (secondError) {
          console.log('Video cover generation failed:', secondError || firstError);
        }
      }
    };

    generateCover();

    return () => {
      isMounted = false;
    };
  }, [videoUrl, thumbnailUri]);
  
  const initialVideoHeight = containerHeight || Math.min(
    MAX_VIDEO_HEIGHT,
    Math.max(MIN_VIDEO_HEIGHT, SCREEN_WIDTH * (16 / 9)),
  );
  
  const videoHeightAnimation = useRef(new Animated.Value(initialVideoHeight)).current;
  const player = useVideoPlayer(videoUrl, (instance) => {
    instance.loop = true;
    instance.muted = muted;
    instance.timeUpdateEventInterval = 0.25;
  });

  useEffect(() => {
    let active = true;
    setBackground(null);
    if (!videoUrl || duration <= 0) return () => { active = false; };

    requestVideoBackground({
      uri: videoUrl,
      cacheKey: videoId,
      duration,
      width: videoSize.width,
      height: videoSize.height,
      size: videoSizeBytes,
      thumbnailUri,
    }).then(result => {
      if (active) setBackground(result);
    }).catch(error => {
      console.warn('Could not prepare the video background:', error.name || 'Unknown error');
    });

    return () => { active = false; };
  }, [videoUrl, videoId, thumbnailUri, videoDuration, duration, videoSize, videoSizeBytes]);

  // Sync mute state with prop
  useEffect(() => {
    if (player) {
      player.muted = muted;
    }
  }, [player, muted]);

  useEffect(() => {
    videoPreloader.registerPlayer(player);
    return () => videoPreloader.unregisterPlayer(player);
  }, [player]);

  // Auto-play/pause based on visibility and manual override
  useEffect(() => {
    if (!player || !ready) return;
    
    if (isVisible && manualOverride.current !== false) {
      // Play the video when it becomes visible
      safePlayerAction(player, 'play');
      setAutoPlayNotice(value => value + 1);
    } else if (!isVisible) {
      // Pause immediately when video is not visible (regardless of manual override)
      safePlayerAction(player, 'pause');
    }
  }, [player, ready, isVisible]);

  // Set up event listeners
  useEffect(() => {
    if (!player) return undefined;
    const statusSubscription = player.addListener('statusChange', ({ status }) => {
      setReady(status === 'readyToPlay');
    });
    const playingSubscription = player.addListener('playingChange', ({ isPlaying }) => {
      setIsPlaying(isPlaying);
      if (isPlaying) videoPreloader.pauseOtherPlayers(player);
    });
    const trackSubscription = player.addListener('videoTrackChange', ({ videoTrack }) => {
      const width = videoTrack?.size?.width;
      const height = videoTrack?.size?.height;
      if (width > 0 && height > 0) setVideoSize({ width, height });
    });
    const durationSubscription = player.addListener('timeUpdate', ({ duration: currentDuration }) => {
      if (currentDuration > 0) setDuration(currentDuration);
    });
    return () => {
      statusSubscription.remove();
      playingSubscription.remove();
      trackSubscription.remove();
      durationSubscription.remove();
    };
  }, [player]);

  // Dynamic height calculation
  useEffect(() => {
    if (containerHeight) {
      Animated.timing(videoHeightAnimation, {
        toValue: containerHeight,
        duration: 220,
        useNativeDriver: false,
      }).start();
      return;
    }

    const nextHeight = Math.min(
      MAX_VIDEO_HEIGHT,
      Math.max(MIN_VIDEO_HEIGHT, SCREEN_WIDTH * (videoSize.height / videoSize.width)),
    );
    Animated.timing(videoHeightAnimation, {
      toValue: nextHeight,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [videoSize, videoHeightAnimation, containerHeight]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!player) return;

      safePlayerAction(player, 'pause');
      videoPreloader.unregisterPlayer(player);
    };
  }, [player]);

  if (!videoUrl) return null;
  
  return (
    <Animated.View style={[styles.container, { height: videoHeightAnimation }]}>
      {videoLink ? (
        <Text style={[styles.link, { color: theme.accent }]} numberOfLines={1} onPress={() => Linking.openURL(videoLink)}>
          <Ionicons name="link-outline" size={14} /> {videoLink}
        </Text>
      ) : null}
      
      <View style={[
        styles.playerFrame, 
        { 
          height: '100%',
          backgroundColor: theme.mediaLoadingBackground,
        }
      ]}>
        <VideoBackground
          frameUri={background?.frameUri || coverImage}
          duration={background?.duration}
          active={isVisible && isPlaying}
        />

        {!ready && coverImage ? (
          <Image
            source={normalizeImageSource({ uri: coverImage })}
            style={[styles.coverImage, { backgroundColor: theme.mediaLoadingBackground }]}
            resizeMode="cover"
          />
        ) : null}

        {!ready && (
          <View style={styles.loadingIndicator} pointerEvents="none">
            <ActivityIndicator
              color={theme.accent || '#4a865c'}
              size="large"
            />
          </View>
        )}
        
        <VideoView 
          player={player} 
          style={[styles.video, background?.frameUri ? styles.videoWithBackground : null]}
          contentFit={contentFit}
          nativeControls={false} 
        />
        
        <VideoPlayerControls
          player={player}
          duration={duration}
          theme={theme}
          playbackNotice={autoPlayNotice}
          onManualPlayback={(willPlay) => {
            manualOverride.current = willPlay;
          }}
          muted={muted}
          onMuteChange={onMuteChange}
          progressColor={progressColor}
          centerControlSize={centerControlSize}
          showPlaybackControls={showPlaybackControls}
          showTopMute={showTopMute}
          showBottomMute={showBottomMute}
          controlsAlwaysVisible={controlsAlwaysVisible}
          centerControlOnPauseOnly={centerControlOnPauseOnly}
          onVideoPress={onVideoPress}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { 
    width: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  link: { 
    fontSize: 12, 
    paddingHorizontal: 12, 
    paddingVertical: 7,
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    color: '#fff',
    maxWidth: '80%',
  },
  playerFrame: {
    width: '100%',
    maxWidth: SCREEN_WIDTH,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
    backgroundColor: 'transparent',
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    zIndex: 0,
    backgroundColor: 'transparent',
  },
  loadingIndicator: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: { 
    width: '100%', 
    height: '100%',
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  videoWithBackground: {
    opacity: 0.96,
  },
});

export default VideoPost;