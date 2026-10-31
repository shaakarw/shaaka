import { getImageUri } from './imageUrl';

export const getPostVideoUrl = post => (
  getImageUri(post?.videoUrl)
  || getImageUri(post?.videoHlsUrl)
  || getImageUri(post?.videoUri)
  || getImageUri(post?.video?.url)
  || getImageUri(post?.video)
  || getImageUri(post?.mediaUrl)
  || ''
);

const getCloudinaryCover = videoUrl => {
  if (!videoUrl.includes('res.cloudinary.com')) return null;
  const [url] = videoUrl.split('?');
  const uploadPath = '/video/upload/';
  if (!url.includes(uploadPath)) return null;
  return url.replace(uploadPath, `${uploadPath}so_1/`).replace(/\.[^/.]+$/, '.jpg');
};

const firstImage = (...images) => images.map(getImageUri).find(Boolean) || null;

export const getPostImages = post => {
  if (!post) return [];
  const candidates = [
    post.imageUrl,
    post.image,
    post.postImage,
    post.images?.frontImage,
    post.images?.front,
    post.images?.cover,
    post.logo,
    post.coverImage,
    post.frontImage,
    ...(Array.isArray(post.houseImages) ? post.houseImages : []),
    ...(Array.isArray(post.images) ? post.images : []),
    ...(Array.isArray(post.imageUrls) ? post.imageUrls : []),
  ];
  const seen = new Set();
  return candidates.filter(candidate => {
    const uri = getImageUri(candidate);
    if (!uri || seen.has(uri)) return false;
    seen.add(uri);
    return true;
  });
};

export const getPostCoverUri = post => {
  if (!post) return null;
  const videoUrl = getPostVideoUrl(post);
  const savedVideoCover = firstImage(
    post.videoThumbnail,
    post.video?.thumbnail,
    post.thumbnailUrl,
    post.thumbnail,
    post.poster
  );
  const videoCover = videoUrl ? getCloudinaryCover(videoUrl) : null;
  const streetCover = firstImage(
    post.streetImage,
    post.street,
    post.images?.street,
    post.images?.streetImage
  );
  const imageCover = getImageUri(getPostImages(post)[0]);
  const isPlaceOrShop = post.contextType === 'place' || post.contextType === 'shop';
  return isPlaceOrShop
    ? streetCover || imageCover
    : savedVideoCover || videoCover || imageCover || streetCover;
};
