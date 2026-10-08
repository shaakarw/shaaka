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

export const getPostsForSection = ({ sectionKey, feedPosts, myPosts, savedPosts }) => {
  if (sectionKey === POST_SECTIONS.myPosts.key) return myPosts;
  if (sectionKey === POST_SECTIONS.saved.key) return savedPosts;
  if (sectionKey === POST_SECTIONS.videos.key) return feedPosts.filter(post => post.videoUrl);
  return feedPosts;
};
