import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: false,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_-]+$/,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    avatarPublicId: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    bannedUntil: {
      type: Date,
      default: null,
    },
    banReason: {
      type: String,
      default: null,
      maxlength: 500,
    },
    banAppeal: {
      type: String,
      default: null,
      maxlength: 1000,
    },
    appealAt: {
      type: Date,
      default: null,
    },
    appealResolvedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    appealStatus: {
      type: String,
      enum: ['none', 'pending', 'rejected'],
      default: 'none',
    },
    showUnbanMessage: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    spotify: {
      spotifyId: { type: String, default: null },
      accessToken: { type: String, default: null },
      refreshToken: { type: String, default: null },
      expiresAt: { type: Date, default: null },
      isPremium: { type: Boolean, default: false },
      profilePictureUrl: { type: String, default: null },
    },
    lastIp: {
      type: String,
      default: null,
    },
    deviceIds: {
      type: [String],
      default: [],
      index: true,
    },
  },
  { timestamps: true }
);

// At least one identifier required
userSchema.pre('validate', function (next) {
  if (!this.username && !this.email) {
    return next(new Error('Either username or email is required'));
  }
  next();
});

userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
};

// Never leak sensitive fields
userSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  obj.id = obj._id.toString();
  delete obj._id;
  // Strip Spotify tokens — expose only connection status
  if (obj.spotify) {
    obj.spotify = {
      connected: !!obj.spotify.spotifyId,
      spotifyId: obj.spotify.spotifyId || null,
      isPremium: obj.spotify.isPremium || false,
      profilePictureUrl: obj.spotify.profilePictureUrl || null,
    };
  }
  return obj;
};

/**
 * Checks if the user's ban has expired.
 * If expired, it resets the ban fields and returns true (unbanned).
 * Returns false if still banned or was never banned.
 */
userSchema.methods.checkBanStatus = async function () {
  if (!this.isBanned) return false;
  
  if (this.bannedUntil && this.bannedUntil <= new Date()) {
    this.isBanned = false;
    this.bannedAt = null;
    this.bannedUntil = null;
    this.banReason = null;
    this.banAppeal = null;
    this.appealAt = null;
    this.appealStatus = 'none';
    this.showUnbanMessage = true; // Signal to frontend that user was unbanned
    await this.save();
    return true;
  }
  
  return false;
};

export default mongoose.model('User', userSchema);
