import { FFprobeKit, ReturnCode } from 'ffmpeg-kit-react-native';

export const getVideoMetaData = async (uri) => {
  const session = await FFprobeKit.getMediaInformation(uri);
  if (!ReturnCode.isSuccess(await session.getReturnCode())) {
    throw new Error('Unable to read video metadata.');
  }

  const mediaInfo = session.getMediaInformation();
  const videoStream = mediaInfo?.getStreams().find(stream => stream.getType() === 'video');
  if (!mediaInfo || !videoStream) {
    throw new Error('Unable to read video metadata.');
  }

  const format = mediaInfo.getFormat();
  return {
    width: videoStream.getWidth(),
    height: videoStream.getHeight(),
    duration: mediaInfo.getDuration(),
    extension: format?.split(',')[0],
  };
};
