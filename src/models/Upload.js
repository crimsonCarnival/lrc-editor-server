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
    // Common
    fileName: { type: String, default: '', maxlength: 500, set: textSetter },
    title: { type: String, default: '', maxlength: 500, set: textSetter },
    duration: { type: Number, default: null },
  },
  { timestamps: true }
);

// One entry per unique media per user
uploadSchema.index({ userId: 1, source: 1, cloudinaryUrl: 1 }, { sparse: true });
uploadSchema.index({ userId: 1, source: 1, youtubeUrl: 1 }, { sparse: true });
uploadSchema.index({ userId: 1, spotifyTrackId: 1 }, { sparse: true });
uploadSchema.index({ userId: 1, youtubeUrl: 1 }, { sparse: true });
uploadSchema.index({ publicId: 1 }, { sparse: true });

uploadSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.__v;
  obj.id = obj._id.toString();
  delete obj._id;
  return obj;
};

export default mongoose.model('Upload', uploadSchema);
