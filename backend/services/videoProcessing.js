const { execFile } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const sharp = require('sharp');

const execFileAsync = promisify(execFile);
const MAX_THUMBNAIL_BYTES = 3 * 1024 * 1024;
const MAX_POST_VIDEO_DURATION_SECONDS = 120;
const UNSUPPORTED_VIDEO_MESSAGE = 'Unsupported video. Please select a valid video with a readable duration.';

const runMediaCommand = (command, args, timeout) => execFileAsync(command, args, {
  timeout,
  maxBuffer: 1024 * 1024,
  windowsHide: true,
});

const unsupportedVideoError = () => {
  const error = new Error(UNSUPPORTED_VIDEO_MESSAGE);
  error.statusCode = 400;
  return error;
};

const readVideoDuration = async videoPath => {
  try {
    const { stdout } = await runMediaCommand(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,duration',
      '-of', 'json',
      videoPath,
    ], 15000);
    const metadata = JSON.parse(stdout);
    const videoStream = metadata.streams?.find(stream => stream.codec_type === 'video');
    const duration = [videoStream?.duration, metadata.format?.duration]
      .map(value => value == null ? Number.NaN : Number(value))
      .find(value => Number.isFinite(value) && value > 0);
    if (!videoStream || duration === undefined) {
      throw unsupportedVideoError();
    }
    return duration;
  } catch (error) {
    if (error.statusCode === 400) throw error;
    const processingError = unsupportedVideoError();
    processingError.cause = error;
    throw processingError;
  }
};

const extractCandidateFrames = async (videoPath, outputPattern, duration) => {
  await runMediaCommand(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', videoPath,
    '-map', '0:v:0',
    '-frames:v', '5',
    '-vf', `fps=5/${duration},scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease`,
    '-q:v', '3',
    outputPattern,
  ], 45000);
};

const extractFallbackFrame = async (videoPath, framePath) => {
  await runMediaCommand(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', videoPath,
    '-map', '0:v:0',
    '-frames:v', '1',
    '-vf', "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease",
    '-q:v', '3',
    framePath,
  ], 45000);
  const stat = await fs.stat(framePath);
  if (!stat.isFile() || stat.size === 0) throw new Error('No frame was extracted.');
};

const trimVideo = async (videoPath, outputPath) => {
  try {
    await runMediaCommand(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', videoPath,
      '-t', String(MAX_POST_VIDEO_DURATION_SECONDS),
      '-map', '0:v:0',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ], 120000);
    const duration = await readVideoDuration(outputPath);
    if (duration > MAX_POST_VIDEO_DURATION_SECONDS) {
      throw new Error(`Trimmed video duration exceeds ${MAX_POST_VIDEO_DURATION_SECONDS} seconds.`);
    }
    return duration;
  } catch (cause) {
    const error = new Error('Could not trim the selected video to the 2-minute limit. Please select another video.');
    error.statusCode = 422;
    error.cause = cause;
    throw error;
  }
};

const scoreFrame = async framePath => {
  const { channels } = await sharp(framePath)
    .resize({ width: 64, height: 64, fit: 'inside' })
    .removeAlpha()
    .stats();
  const [red, green, blue] = channels;
  const brightness = red.mean * 0.2126 + green.mean * 0.7152 + blue.mean * 0.0722;
  const contrast = red.stdev * 0.2126 + green.stdev * 0.7152 + blue.stdev * 0.0722;
  return {
    usable: brightness >= 10 && brightness <= 248 && contrast >= 7,
    score: contrast - Math.abs(brightness - 128) * 0.025,
  };
};

const createThumbnail = async framePath => {
  for (const [width, quality] of [[1280, 80], [960, 72], [640, 62]]) {
    const buffer = await sharp(framePath)
      .rotate()
      .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true, progressive: true })
      .toBuffer();
    if (buffer.length <= MAX_THUMBNAIL_BYTES) return buffer;
  }
  throw new Error('Could not compress the generated video cover to the upload size limit.');
};

const processVideoBuffer = async buffer => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw unsupportedVideoError();
  if (!ffmpegPath || !ffprobePath) throw new Error('FFmpeg and FFprobe are required for video uploads.');

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shaaka-video-'));
  try {
    const videoPath = path.join(tempDir, 'upload.video');
    await fs.writeFile(videoPath, buffer);
    console.info('[Video] Metadata extraction started.');
    let duration;
    try {
      duration = await readVideoDuration(videoPath);
    } catch (error) {
      const causeMessage = error.cause?.stderr?.trim().split(/\r?\n/).pop();
      console.error('[Video] Metadata extraction failed:', causeMessage || error.message);
      throw error;
    }
    console.info('[Video] Metadata extraction completed. Duration (seconds):', duration);
    let processedVideoPath = videoPath;
    let processedDuration = duration;
    let wasTrimmed = false;
    if (duration > MAX_POST_VIDEO_DURATION_SECONDS) {
      processedVideoPath = path.join(tempDir, 'trimmed.mp4');
      processedDuration = await trimVideo(videoPath, processedVideoPath);
      wasTrimmed = true;
      console.info('[Video] Video trimmed to duration (seconds):', processedDuration);
    }
    const candidates = [];
    const candidateDirectory = path.join(tempDir, 'candidates');
    await fs.mkdir(candidateDirectory);
    try {
      await extractCandidateFrames(
        processedVideoPath,
        path.join(candidateDirectory, 'candidate-%02d.jpg'),
        processedDuration.toFixed(3)
      );
      const frameNames = (await fs.readdir(candidateDirectory))
        .filter(name => /^candidate-\d+\.jpg$/.test(name))
        .sort();
      for (const frameName of frameNames) {
        const framePath = path.join(candidateDirectory, frameName);
        const stat = await fs.stat(framePath);
        if (stat.size > 0) candidates.push({ framePath, ...(await scoreFrame(framePath)) });
      }
    } catch (error) {
      console.warn('[Video] Could not extract candidate cover frames:', error.message);
    }

    if (candidates.length === 0) {
      const fallbackPath = path.join(tempDir, 'fallback.jpg');
      try {
        await extractFallbackFrame(processedVideoPath, fallbackPath);
        candidates.push({ framePath: fallbackPath, usable: false, score: 0 });
      } catch (error) {
        const processingError = new Error('Could not generate a cover image for this video.');
        processingError.statusCode = 422;
        throw processingError;
      }
    }

    const usableCandidates = candidates.filter(candidate => candidate.usable);
    const framesToRank = usableCandidates.length ? usableCandidates : candidates;
    framesToRank.sort((left, right) => right.score - left.score);
    const thumbnailBuffer = await createThumbnail(framesToRank[0].framePath);
    return {
      duration: processedDuration,
      thumbnailBuffer,
      videoBuffer: wasTrimmed ? await fs.readFile(processedVideoPath) : buffer,
      mimeType: wasTrimmed ? 'video/mp4' : undefined,
      wasTrimmed,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

module.exports = {
  MAX_POST_VIDEO_DURATION_SECONDS,
  processVideoBuffer,
  readVideoDuration,
};
