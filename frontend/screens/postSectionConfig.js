export const POST_SECTIONS = {
  feed: {
    key: 'ushaka',
    route: 'Feed',
  },
  myPosts: {
    key: 'utanga',
    route: 'MyPosts',
  },
  videos: {
    key: 'videos',
    route: 'Videos',
  },
  saved: {
    key: 'saved',
    route: 'SavedPosts',
  },
};

export const POST_SECTION_KEYS = Object.values(POST_SECTIONS).map(section => section.key);

export const hasVideoContent = (post) => {
  if (!post || typeof post !== 'object') return false;
  const mediaValues = [
    post.videoUrl,
    post.videoHlsUrl,
    post.video?.url,
    post.video?.mp4,
    post.videoLink,
    post.mediaUrl,
    post.media?.url,
    post.fileUrl,
  ];
  return mediaValues.some(value => typeof value === 'string' && value.trim().length > 0);
};

export const getPostsForSection = ({ sectionKey, feedPosts, myPosts, savedPosts }) => {
  if (sectionKey === POST_SECTIONS.myPosts.key) return myPosts;
  if (sectionKey === POST_SECTIONS.saved.key) return savedPosts;
  if (sectionKey === POST_SECTIONS.videos.key) {
    return feedPosts.filter(hasVideoContent);
  }
  return feedPosts;
};
