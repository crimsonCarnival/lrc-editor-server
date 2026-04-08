import mongoose from 'mongoose';
import { stripHtml, sanitizeUrl } from '../utils/sanitize.js';

const textSetter = (v) => (typeof v === 'string' ? stripHtml(v) : v);
const urlSetter = (v) => sanitizeUrl(v);

const uploadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['cloudinary', 'youtube', 'spotify'],
      required: true,
    },
    // Cloudinary fields
    cloudinaryUrl: { type: String, default: null, maxlength: 500, set: urlSetter },
    publicId: { type: String, default: null, maxlength: 500 },
    // YouTube fields
    youtubeUrl: { type: String, default: null, maxlength: 500, set: urlSetter },
    // Spotify fields
    spotifyTrackId: { type: String, default: null, maxlength: 100 },
    artist: { type: String, default: null, maxlength: 500, set: textSetter },
    thumbnailUrl: { type: String, default: null, maxlength: 500, set: urlSetter },
    // Common
    fileName: { type: String, default: '', maxlength: 500, set: textSetter },
    title: { type: String, default: '', maxlength: 500, set: textSetter },
    duration: { type: Number, default: null },
  },
  { timestamps: true }
);

// Compound indexes for uniqueness and query performance
uploadSchema.index({ userId: 1, source: 1, cloudinaryUrl: 1 }, { sparse: true });
uploadSchema.index({ userId: 1, source: 1, youtubeUrl: 1 }, { sparse: true });
uploadSchema.index({ userId: 1, source: 1, spotifyTrackId: 1 }, { sparse: true });
uploadSchema.index({ userId: 1, updatedAt: -1 }); // For listing user's uploads sorted by latest
uploadSchema.index({ publicId: 1 }, { sparse: true }); // For Cloudinary cleanup

uploadSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.__v;
  obj.id = obj._id.toString();
  delete obj._id;
  return obj;
};

export default mongoose.model('Upload', uploadSchema);
