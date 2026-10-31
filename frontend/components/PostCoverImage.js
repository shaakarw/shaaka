import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { getPostCoverUri, getPostVideoUrl } from '../utils/postMedia';
import { normalizeImageSource } from '../utils/imageUrl';


const PostCoverImage = ({ post, style, iconSize = 28, placeholderIcon }) => {
  const videoUrl = getPostVideoUrl(post || {});
  const staticCover = getPostCoverUri(post);
  const [generatedCover, setGeneratedCover] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const isVideo = Boolean(videoUrl);

  useEffect(() => {
    setImageLoaded(false);
    let active = true;
    if (!isVideo || staticCover) {
      setGeneratedCover(null);
      return () => {
        active = false;
      };
    }

    VideoThumbnails.getThumbnailAsync(videoUrl, { time: 1000, quality: 0.7 })
      .then(({ uri }) => {
        if (active) setGeneratedCover(uri);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [isVideo, staticCover, videoUrl]);

  const cover = staticCover || generatedCover;
  const showPlaceholder = !cover || !imageLoaded;

  return (
    <View style={[styles.container, style]}>
      {cover && (
        <Image
          source={normalizeImageSource({ uri: cover })}


          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(false)}
        />
      )}
      {showPlaceholder && (
        <View style={styles.placeholder}>
          <Ionicons
            name={placeholderIcon || (isVideo ? 'videocam-outline' : 'image-outline')}
            size={iconSize}
            color="#fff"
          />
        </View>
      )}
      {isVideo && (
        <View style={styles.playIndicator}>
          <Ionicons name="play" size={14} color="#fff" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#292929',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#292929',
  },
  playIndicator: {
    position: 'absolute',
    right: 7,
    bottom: 7,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
});

export default PostCoverImage;