import React, { useEffect, useRef, useState } from 'react';
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

const getImageUri = image => {
  if (typeof image === 'string') return image || null;
  if (image && typeof image === 'object') return image.uri || image.url || null;
  return null;
};

export const getPostCoverUri = post => {
  if (!post) return null;
  const videoUrl = getVideoUrl(post);
  const savedVideoCover =
    getImageUri(post.videoThumbnail) ||
    getImageUri(post.video?.thumbnail) ||
    getImageUri(post.thumbnailUrl);
  const videoCover = videoUrl ? getCloudinaryCover(videoUrl) : null;
  const streetCover =
    getImageUri(post.streetImage) ||
    getImageUri(post.street) ||
    getImageUri(post.images?.street) ||
    getImageUri(post.images?.streetImage);
  const imageCover =
    getImageUri(post.imageUrl) ||
    getImageUri(post.image) ||
    getImageUri(post.postImage) ||
    getImageUri(post.houseImages?.find(Boolean)) ||
    getImageUri(post.images?.frontImage) ||
    getImageUri(post.images?.front) ||
    getImageUri(post.images?.cover) ||
    getImageUri(post.logo) ||
    getImageUri(post.coverImage) ||
    getImageUri(post.frontImage);
  const isPlaceOrShop = post.contextType === 'place' || post.contextType === 'shop';
  return isPlaceOrShop
    ? streetCover || imageCover
    : savedVideoCover || videoCover || imageCover || streetCover;
};

const PostCoverImage = ({ post, style, iconSize = 28, placeholderIcon }) => {
  const videoUrl = getVideoUrl(post || {});
  const staticCover = getPostCoverUri(post);
  const [generatedCover, setGeneratedCover] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retryTimerRef = useRef(null);
  const isVideo = Boolean(videoUrl);

  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setImageLoaded(false);
    setImageFailed(false);
    setRetryAttempt(0);
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

  useEffect(() => () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  const cover = staticCover || generatedCover;
  const showPlaceholder = !cover || !imageLoaded || imageFailed;
  const retryCoverLoad = () => {
    setImageFailed(true);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setImageLoaded(false);
      setImageFailed(false);
      setRetryAttempt(attempt => attempt + 1);
    }, 2000);
  };

  return (
    <View style={[styles.container, style]}>
      {cover && !imageFailed && (
        <Image
          key={`${cover}-${retryAttempt}`}
          source={{ uri: cover }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          onLoad={() => setImageLoaded(true)}
          onError={retryCoverLoad}
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