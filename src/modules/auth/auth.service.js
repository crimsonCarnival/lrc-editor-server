import User from '../../db/user.model.js';
import BannedIp from '../admin/bannedIp.model.js';
import BannedDevice from '../admin/bannedDevice.model.js';
import { v2 as cloudinary } from 'cloudinary';

async function checkDevice(deviceId, user = null) {
  if (!deviceId) return { error: null };

  const deviceBanned = await BannedDevice.findOne({ deviceId });
  if (deviceBanned) {
    return { error: 'Access restricted from this device due to previous violations.', status: 403 };
  }

  if (user) {
    if (!user.deviceIds.includes(deviceId)) {
      user.deviceIds.push(deviceId);
      await user.save();
    }
  }

  return { error: null };
}

/**
 * Register a new user.
 * @param {{ username?: string, email?: string, password: string }} data
 * @param {{ signAccess: Function, signRefresh: Function }} jwt
 * @param {string} ip
 * @returns {{ user, accessToken, refreshToken }|{ error: string, status: number }}
 */
export async function register(data, jwt, ip, deviceId) {
  // Parallelize IP and device ban checks
  const [ipBanned, deviceCheck] = await Promise.all([
    ip ? BannedIp.findOne({ ip }) : Promise.resolve(null),
    checkDevice(deviceId),
  ]);
  if (ipBanned) {
    return { error: 'Registration restricted from this network.', status: 403 };
  }
  if (deviceCheck.error) return deviceCheck;

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
    passwordHash,
    lastIp: ip,
    deviceIds: deviceId ? [deviceId] : [],
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
export async function login(data, jwt, ip, deviceId) {
  // Parallelize IP and device ban checks
  const [ipBanned, deviceCheck] = await Promise.all([
    ip ? BannedIp.findOne({ ip }) : Promise.resolve(null),
    checkDevice(deviceId),
  ]);
  if (ipBanned) {
    return { error: 'Access restricted from this network.', status: 403 };
  }
  if (deviceCheck.error) return deviceCheck;

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

  // checkDevice saves user internally when a new device is added.
  // We only need an extra save if the IP itself changed.
  const ipChanged = ip && user.lastIp !== ip;
  if (ipChanged) user.lastIp = ip;
  await checkDevice(deviceId, user); // Link device; saves if new device found
  if (ipChanged && !user.isModified()) await user.save(); // Extra save only when IP changed but no device was added

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
export async function refresh(refreshToken, jwt, ip, deviceId) {
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

  // Check device
  const deviceCheck = await checkDevice(deviceId, user);
  if (deviceCheck.error) return deviceCheck;

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
export async function getProfile(userId, ip, deviceId) {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) return { error: 'User not found', status: 404 };

  // Check device
  const deviceCheck = await checkDevice(deviceId, user);
  if (deviceCheck.error) return deviceCheck;

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

  if (avatarUrl !== undefined && avatarUrl !== null) {
    const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const urlLower = avatarUrl.toLowerCase();
    const isImage = ALLOWED_IMAGE_EXTENSIONS.some(ext => urlLower.endsWith(`.${ext}`) || urlLower.includes(`.${ext}?`)) ||
      (avatarUrl.includes('cloudinary.com') && avatarUrl.includes('/image/upload/'));

    if (!isImage) {
      return { error: 'Invalid image URL format. Only JPG, PNG, GIF, and WEBP are allowed.', status: 400 };
    }
  }

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
  if (avatarPublicId !== undefined) {
    if (avatarPublicId && !avatarPublicId.startsWith('lyrics-syncer/avatars/')) {
      return { error: 'Invalid Cloudinary public ID for avatar', status: 400 };
    }
    user.avatarPublicId = avatarPublicId;
  }

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
