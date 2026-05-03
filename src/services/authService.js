import User from '../models/User.js';
import BannedIp from '../models/BannedIp.js';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Register a new user.
 * @param {{ username?: string, email?: string, password: string }} data
 * @param {{ signAccess: Function, signRefresh: Function }} jwt
 * @param {string} ip
 * @returns {{ user, accessToken, refreshToken }|{ error: string, status: number }}
 */
export async function register(data, jwt, ip) {
  // Check if IP is banned
  const ipBanned = await BannedIp.findOne({ ip });
  if (ipBanned) {
    return { error: 'Registration restricted from this network.', status: 403 };
  }
  const { username, email, password } = data;

  const query = [];
  if (username) query.push({ username: username });
  if (email) query.push({ email: email.toLowerCase() });
  const existing = await User.findOne({ $or: query });
  if (existing) {
    if (existing.isBanned) {
      return { error: 'Registration failed. This account or email is restricted.', status: 403 };
    }
    return { error: 'Username or email already taken', status: 409 };
  }

  // Double check if any banned user had this IP
  if (ip) {
    const bannedByIp = await User.findOne({ lastIp: ip, isBanned: true }).lean();
    if (bannedByIp) {
      return { error: 'Registration failed. This network is restricted due to previous violations.', status: 403 };
    }
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    ...(username ? { username } : {}),
    ...(email ? { email: email.toLowerCase() } : {}),
    passwordHash,
    lastIp: ip,
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
 * @param {string} ip
 * @returns {{ user, accessToken, refreshToken }|{ error: string, status: number }}
 */
export async function login(data, jwt, ip) {
  // Check if IP is banned
  const ipBanned = await BannedIp.findOne({ ip });
  if (ipBanned) {
    return { error: 'Access restricted from this network.', status: 403 };
  }
  const { identifier, password } = data;
  const normalised = identifier.toLowerCase().trim();

  const user = await User.findOne({
    $or: [{ username: identifier.trim() }, { email: normalised }],
  });
  if (!user || !(await user.verifyPassword(password))) {
    return { error: 'Invalid credentials', status: 401 };
  }

  await user.checkBanStatus();

  if (user.isDeleted) {
    return { error: 'Account has been deleted', status: 403 };
  }

  user.lastIp = ip;
  await user.save();

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
 * @param {string} ip
 * @returns {{ accessToken, refreshToken }|{ error: string, status: number }}
 */
export async function refresh(refreshToken, jwt, ip) {
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

  if (ip) {
    user.lastIp = ip;
    await user.save();
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
 * @param {string} ip
 * @returns {{ user }|{ error: string, status: number }}
 */
export async function getProfile(userId, ip) {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) return { error: 'User not found', status: 404 };
  
  if (ip) {
    user.lastIp = ip;
    await user.save();
  }

  await user.checkBanStatus();
  
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

/**
 * Submit an appeal for a banned user.
 */
export async function submitAppeal(userId, appealText) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };
  if (!user.isBanned) return { error: 'User is not banned', status: 400 };

  user.banAppeal = appealText.slice(0, 1000);
  user.appealStatus = 'pending';
  user.appealAt = new Date();
  await user.save();

  return { user: user.toPublic() };
}

/**
 * Clear the unban welcome message flag.
 */
export async function clearUnbanMessage(userId) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };

  user.showUnbanMessage = false;
  await user.save();

  return { success: true };
}
