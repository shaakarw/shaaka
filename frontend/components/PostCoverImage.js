import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';

const getVideoUrl = post => {
  const video = post.videoUrl || post.video?.url || post.video || post.mediaUrl;
  return typeof video === 'string' ? video : '';
};

const getCloudinaryCover = videoUrl => {
  if (!videoUrl.includes('res.cloudinary.com')) return null;
  const [url] = videoUrl.split('?');
  const uploadPath = '/video/upload/';
  if (!url.includes(uploadPath)) return null;
  return url.replace(uploadPath, `${uploadPath}so_1/`).replace(/\.[^/.]+$/, '.jpg');
};

const PostCoverImage = ({ post, style, iconSize = 28 }) => {
  const videoUrl = getVideoUrl(post || {});
  const imageUrl = post?.houseImages?.[0] || post?.imageUrl;
  const savedVideoCover = post?.videoThumbnail || post?.video?.thumbnail || post?.thumbnailUrl;
  const staticCover = savedVideoCover || imageUrl || (videoUrl ? getCloudinaryCover(videoUrl) : null);
  const [generatedCover, setGeneratedCover] = useState(null);
  const isVideo = Boolean(videoUrl);

  useEffect(() => {
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

  return (
    <View style={[styles.container, style]}>
      {cover ? (
        <Image source={{ uri: cover }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name={isVideo ? 'videocam-outline' : 'image-outline'} size={iconSize} color="#777" />
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
    backgroundColor: '#e5e5e5',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
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