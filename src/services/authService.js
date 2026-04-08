import User from '../models/User.js';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Register a new user.
 * @param {{ username?: string, email?: string, password: string }} data
 * @param {{ signAccess: Function, signRefresh: Function }} jwt
 * @returns {{ user, accessToken, refreshToken }|{ error: string, status: number }}
 */
export async function register(data, jwt) {
  const { username, email, password } = data;

  const query = [];
  if (username) query.push({ username: username.toLowerCase() });
  if (email) query.push({ email: email.toLowerCase() });
  const existing = await User.findOne({ $or: query }).lean();
  if (existing) {
    return { error: 'Username or email already taken', status: 409 };
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    ...(username ? { username: username.toLowerCase() } : {}),
    ...(email ? { email: email.toLowerCase() } : {}),
    passwordHash,
  });

  const tokenPayload = { sub: user._id.toString() };
  return {
    user: user.toPublic(),
    accessToken: jwt.signAccess(tokenPayload),
    refreshToken: jwt.signRefresh(tokenPayload),
  };
}

/**
 * Authenticate a user by username/email + password.
 * @param {{ identifier: string, password: string }} data
 * @param {{ signAccess: Function, signRefresh: Function }} jwt
 * @returns {{ user, accessToken, refreshToken }|{ error: string, status: number }}
 */
export async function login(data, jwt) {
  const { identifier, password } = data;
  const normalised = identifier.toLowerCase().trim();

  const user = await User.findOne({
    $or: [{ username: normalised }, { email: normalised }],
  });
  if (!user || !(await user.verifyPassword(password))) {
    return { error: 'Invalid credentials', status: 401 };
  }

  const tokenPayload = { sub: user._id.toString() };
  return {
    user: user.toPublic(),
    accessToken: jwt.signAccess(tokenPayload),
    refreshToken: jwt.signRefresh(tokenPayload),
  };
}

/**
 * Refresh an access token using a valid refresh token.
 * @param {string} refreshToken
 * @param {{ verifyToken: Function, signAccess: Function, signRefresh: Function }} jwt
 * @returns {{ accessToken, refreshToken }|{ error: string, status: number }}
 */
export async function refresh(refreshToken, jwt) {
  let decoded;
  try {
    decoded = jwt.verifyToken(refreshToken);
  } catch {
    return { error: 'Invalid or expired refresh token', status: 401 };
  }

  const user = await User.findById(decoded.sub);
  if (!user) {
    return { error: 'User not found', status: 401 };
  }

  const tokenPayload = { sub: user._id.toString() };
  return {
    accessToken: jwt.signAccess(tokenPayload),
    refreshToken: jwt.signRefresh(tokenPayload),
  };
}

/**
 * Get current user profile.
 * @param {string} userId
 * @returns {{ user }|{ error: string, status: number }}
 */
export async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };
  return { user: user.toPublic() };
}

/**
 * Update user profile (avatar).
 * @param {string} userId
 * @param {{ avatarUrl?: string|null, avatarPublicId?: string|null }} data
 * @param {object} logger - Fastify logger
 * @returns {{ user }|{ error: string, status: number }}
 */
export async function updateProfile(userId, data, logger) {
  const { avatarUrl, avatarPublicId } = data;
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };

  // Delete old avatar from Cloudinary if replacing
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (avatarUrl !== undefined && user.avatarPublicId && cloudName && apiKey && apiSecret) {
    try {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      await cloudinary.uploader.destroy(user.avatarPublicId, { resource_type: 'image' });
      logger.info({ publicId: user.avatarPublicId }, 'Old avatar deleted from Cloudinary');
    } catch (err) {
      logger.warn({ err, publicId: user.avatarPublicId }, 'Failed to delete old avatar');
    }
  }

  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  if (avatarPublicId !== undefined) user.avatarPublicId = avatarPublicId;

  await user.save();
  return { user: user.toPublic() };
}
