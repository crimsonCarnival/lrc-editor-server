import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import { stripHtml } from '../utils/sanitize.js';

const textSetter = (v) => (typeof v === 'string' ? stripHtml(v) : v);

// --- Subdocument: Editor State ---
const stateSchema = new mongoose.Schema(
  {
    syncMode: { type: Boolean, default: false },
    activeLineIndex: { type: Number, default: 0 },
    playbackPosition: { type: Number, default: 0 },
    playbackSpeed: { type: Number, default: 1 },
    saveTime: { type: String, default: null, maxlength: 64 },
    timezone: { type: String, default: null, maxlength: 100 },
    utcOffset: { type: String, default: null, maxlength: 6 },
  },
  { _id: false }
);

// --- Subdocument: Metadata ---
const metadataSchema = new mongoose.Schema(
  {
    description: { type: String, default: '', maxlength: 2000, set: textSetter },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (v) => v.length <= 20,
        message: 'Maximum 20 tags allowed',
      },
      set: (v) => (Array.isArray(v) ? v.map((t) => (typeof t === 'string' ? stripHtml(t).slice(0, 50) : t)) : v),
    },
    coverUrl: { type: String, default: '', maxlength: 2048 },
    coverPublicId: { type: String, default: '', maxlength: 500 },
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

    // Audio reference to Upload collection (required)
    uploadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Upload',
      default: null,
      index: true,
    },

    // Lyrics stored in separate Lyrics collection, linked by lyricsId
    lyricsId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lyrics',
      default: null,
    },

    state: { type: stateSchema, default: () => ({}) },
    metadata: { type: metadataSchema, default: () => ({}) },
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
// Supports list query: by owner + not deleted, sorted by recent updates
projectSchema.index({ userId: 1, deletedAt: 1, updatedAt: -1 });

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
