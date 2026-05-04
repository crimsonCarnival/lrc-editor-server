import { v2 as cloudinary } from 'cloudinary';
import { stripHtml } from '../utils/sanitize.js';
import Upload from '../models/Upload.js';
import Project from '../models/Project.js';
import { fetchYouTubeTitle, fetchYouTubeMetadata } from '../utils/youtube.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'webm', 'mp4'];
const UPLOAD_FOLDER = 'lyrics-syncer/audio';

/**
 * Check if Cloudinary is configured.
 */
export function isCloudinaryConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Generate a signed upload signature for audio files.
 * @param {{ fileName: string, fileSize: number }} data
 * @param {string} userId - Authenticated user ID
 * @returns {{ signature, timestamp, cloudName, apiKey, folder, resourceType }|{ error: string, status: number }}
 */
export function generateAudioSignature(data, userId) {
  if (!isCloudinaryConfigured()) {
    return { error: 'Upload service not configured', status: 503 };
  }

  const { fileName, fileSize } = data;
  const sanitizedName = stripHtml(fileName);
  const ext = sanitizedName.split('.').pop()?.toLowerCase();

  if (!ext || !ALLOWED_AUDIO_EXTENSIONS.includes(ext)) {
    return {
      error: `Invalid file type. Allowed: ${ALLOWED_AUDIO_EXTENSIONS.join(', ')}`,
      status: 400,
    };
  }

  if (fileSize > MAX_FILE_SIZE) {
    return { error: `File too large. Max: ${MAX_FILE_SIZE / 1024 / 1024} MB`, status: 400 };
  }

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const timestamp = Math.round(Date.now() / 1000);
  const userFolder = `${UPLOAD_FOLDER}/${userId}`;
  const params = { timestamp, folder: userFolder };
  const signature = cloudinary.utils.api_sign_request(params, apiSecret);

  return {
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder: userFolder,
    resourceType: 'video',
  };
}

/**
 * Generate signed upload signature for avatar images.
 * @param {string} userId - Authenticated user ID
 */
export function generateAvatarSignature(userId) {
  if (!isCloudinaryConfigured()) {
    return { error: 'Upload service not configured', status: 503 };
  }

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const timestamp = Math.round(Date.now() / 1000);
  const userFolder = `lyrics-syncer/avatars/${userId}`;
  const params = {
    timestamp,
    folder: userFolder,
  };
  const signature = cloudinary.utils.api_sign_request(params, apiSecret);

  return {
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder: userFolder,
    resourceType: 'image',
  };
}



/**
 * List a user's uploaded media with pagination support.
 * @param {string} userId
 * @param {object} options - Pagination options
 * @param {number} options.limit - Max items to return (default: 50, max: 100)
 * @param {number} options.offset - Number of items to skip (default: 0)
 * @returns {{ uploads: object[], total: number, hasMore: boolean }}
 */
export async function listMedia(userId, { limit = 50, offset = 0 } = {}) {
  // Clamp limit to reasonable bounds
  const clampedLimit = Math.min(Math.max(1, limit), 100);
  const clampedOffset = Math.max(0, offset);

  // Get total count for pagination metadata
  const total = await Upload.countDocuments({ userId });

  const uploads = await Upload.find({ userId })
    .sort({ updatedAt: -1 })
    .skip(clampedOffset)
    .limit(clampedLimit)
    .lean();

  return {
    uploads: uploads.map((u) => ({
      id: u._id.toString(),
      source: u.source,
      cloudinaryUrl: u.cloudinaryUrl,
      publicId: u.publicId,
      youtubeUrl: u.youtubeUrl,
      spotifyTrackId: u.spotifyTrackId,
      artist: u.artist,
      fileName: u.fileName,
      title: u.title,
      duration: u.duration,
      createdAt: u.createdAt,
    })),
    total,
    hasMore: clampedOffset + uploads.length < total,
  };
}

/**
 * Create or upsert a media upload record.
 * @param {string} userId
 * @param {object} data
 * @returns {object} Public upload object
 */
export async function createMedia(userId, data) {
  const { source, cloudinaryUrl, publicId, youtubeUrl, spotifyTrackId, artist, fileName, title, duration } = data;

  const query = { userId, source };
  
  // Strict URL Validation
  if (source === 'youtube' && youtubeUrl) {
    const ytPattern = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|watch\?.+&v=)|youtu\.be\/)([^&?/\s]{11})/;
    const isId = /^[a-zA-Z0-9_-]{11}$/.test(youtubeUrl);
    if (!ytPattern.test(youtubeUrl) && !isId) {
      throw new Error('Invalid YouTube URL');
    }
    query.youtubeUrl = youtubeUrl;
  } else if (source === 'cloudinary' && cloudinaryUrl) {
    // Validate the CDN URL comes from res.cloudinary.com
    if (!cloudinaryUrl.startsWith('https://res.cloudinary.com/')) {
      throw new Error('Cloudinary URL must come from res.cloudinary.com');
    }
    // Validate it belongs to OUR Cloudinary account (prevents linking foreign accounts)
    const ourCloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (ourCloudName && !cloudinaryUrl.includes(`/${ourCloudName}/`)) {
      throw new Error('CDN URL does not belong to this application\'s Cloudinary account');
    }
    // NOTE: Cloudinary strips the file extension from public_id, so audio files
    // uploaded as 'video' resource type may have .mp4 extension in the URL.
    // We validate the extension from fileName only when it's clearly an audio/media file.
    if (fileName) {
      const fileExt = fileName.split('.').pop()?.toLowerCase();
      // Only reject if the extension is something clearly non-audio (e.g. .exe, .js)
      // Empty or missing extension is allowed (Cloudinary strips them from publicId-based names)
      if (fileExt && fileExt.length <= 5 && !ALLOWED_AUDIO_EXTENSIONS.includes(fileExt)) {
        throw new Error('Invalid audio file type');
      }
    }
    // Only validate publicId ownership when a publicId is actually provided
    if (publicId) {
      if (!publicId.startsWith(`${UPLOAD_FOLDER}/${userId}/`) && !publicId.startsWith(UPLOAD_FOLDER + '/')) {
        throw new Error('Invalid Cloudinary public ID');
      }
    }
    query.cloudinaryUrl = cloudinaryUrl;
  } else if (source === 'spotify' && spotifyTrackId) {
    query.spotifyTrackId = spotifyTrackId;
  }

  // Fetch YouTube title and duration if not provided
  let finalTitle = title || fileName || '';
  let finalDuration = duration || null;
  if (source === 'youtube' && youtubeUrl && (!title || !duration)) {
    const metadata = await fetchYouTubeMetadata(youtubeUrl);
    if (metadata) {
      if (!title && metadata.title) finalTitle = metadata.title;
      if (!duration && metadata.duration) finalDuration = metadata.duration;
    }
  }

  const upload = await Upload.findOneAndUpdate(
    query,
    {
      userId,
      source,
      cloudinaryUrl: cloudinaryUrl || null,
      publicId: publicId || null,
      youtubeUrl: youtubeUrl || null,
      spotifyTrackId: spotifyTrackId || null,
      artist: artist || null,
      fileName: fileName || '',
      title: finalTitle,
      duration: finalDuration,
    },
    { upsert: true, new: true }
  );

  return upload.toPublic();
}

/**
 * Delete a media upload.
 * @param {string} uploadId
 * @param {string} userId
 * @param {object} logger - Fastify logger
 * @returns {{ error?: string, status?: number }}
 */
export async function deleteMedia(uploadId, userId, logger) {
  const upload = await Upload.findById(uploadId);
  if (!upload) return { error: 'Upload not found', status: 404 };
  if (upload.userId.toString() !== userId) return { error: 'Not authorized', status: 403 };

  // Delete from Cloudinary if applicable
  if (upload.source === 'cloudinary' && upload.publicId && isCloudinaryConfigured()) {
    try {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      await cloudinary.uploader.destroy(upload.publicId, { resource_type: 'video' });
      logger.info({ publicId: upload.publicId }, 'Cloudinary asset deleted');
    } catch (err) {
      logger.warn({ err, publicId: upload.publicId }, 'Failed to delete Cloudinary asset');
    }
  }

  await upload.deleteOne();
  return {};
}

/**
 * Update a media upload (e.g., title).
 * @param {string} uploadId
 * @param {string} userId
 * @param {object} updates - Fields to update
 * @returns {object|{ error: string, status: number }}
 */
export async function updateMedia(uploadId, userId, updates) {
  const upload = await Upload.findById(uploadId);
  if (!upload) return { error: 'Upload not found', status: 404 };
  if (upload.userId.toString() !== userId) return { error: 'Not authorized', status: 403 };

  // Only allow updating specific fields
  const allowedFields = ['title', 'fileName', 'duration'];
  const updateData = {};
  
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateData[field] = updates[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { error: 'No valid fields to update', status: 400 };
  }

  const updated = await Upload.findByIdAndUpdate(
    uploadId,
    { $set: updateData },
    { new: true }
  );

  return updated.toPublic();
}

/**
 * Get a specific media upload and its associated projects.
 * @param {string} uploadId
 * @param {string} userId
 * @returns {object|{ error: string, status: number }}
 */
export async function getMedia(uploadId, userId) {
  const upload = await Upload.findById(uploadId);
  if (!upload) return { error: 'Upload not found', status: 404 };
  if (upload.userId.toString() !== userId) return { error: 'Not authorized', status: 403 };

  const projects = await Project.find({ uploadId }).select('projectId title updatedAt').lean();

  return {
    ...upload.toPublic(),
    projects: projects.map(p => ({
      projectId: p.projectId,
      title: p.title || 'Untitled',
      updatedAt: p.updatedAt
    }))
  };
}

