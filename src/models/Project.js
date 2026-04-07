import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import { stripHtml, sanitizeUrl } from '../utils/sanitize.js';

const textSetter = (v) => (typeof v === 'string' ? stripHtml(v) : v);
const urlSetter = (v) => sanitizeUrl(v);

// --- Subdocument: Audio (fallback for projects without an Upload reference) ---
const audioSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ['local', 'youtube', 'spotify'],
      default: 'local',
    },
    cloudinaryUrl: { type: String, default: null, maxlength: 500, set: urlSetter },
    publicId: { type: String, default: null, maxlength: 500 },
    youtubeUrl: { type: String, default: null, maxlength: 500, set: urlSetter },
    spotifyTrackId: {
      type: String,
      default: null,
      maxlength: 100,
      match: /^[a-zA-Z0-9]+$/,
    },
    duration: { type: Number, default: null },
    fileName: { type: String, default: null, maxlength: 500, set: textSetter },
  },
  { _id: false }
);

// --- Subdocument: Editor State ---
const stateSchema = new mongoose.Schema(
  {
    syncMode: { type: Boolean, default: false },
    activeLineIndex: { type: Number, default: 0 },
    playbackPosition: { type: Number, default: 0 },
    playbackSpeed: { type: Number, default: 1 },
  },
  { _id: false }
);

// --- Main: Project ---
const projectSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
      unique: true,
      default: () => nanoid(10),
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
      sparse: true,
    },
    title: { type: String, default: '', maxlength: 500, set: textSetter },

    // Audio: prefer audioId (ref Upload), fall back to embedded audio
    audioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Upload',
      default: null,
    },
    audio: { type: audioSchema, default: () => ({}) },

    // Lyrics stored in separate Lyrics collection, linked by lyricsId
    lyricsId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lyrics',
      default: null,
    },

    state: { type: stateSchema, default: () => ({}) },
    type: {
      type: String,
      enum: ['temporary', 'saved'],
      default: 'temporary',
    },
    readOnly: { type: Boolean, default: true },

    // Optimistic locking
    version: { type: Number, default: 1 },

    // Soft delete
    deletedAt: { type: Date, default: null },

    // Collaboration metadata
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// TTL index — MongoDB auto-deletes documents when expiresAt is reached
projectSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Soft-delete filter: exclude deleted projects by default
projectSchema.index({ deletedAt: 1 });

// Methods
projectSchema.methods.isOwnedBy = function (userId) {
  if (!this.userId || !userId) return false;
  return this.userId.toString() === userId.toString();
};

projectSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.__v;
  delete obj._id;
  return obj;
};

export default mongoose.model('Project', projectSchema);
