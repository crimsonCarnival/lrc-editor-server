import User from '../models/User.js';
import BannedIp from '../models/BannedIp.js';
import Project from '../models/Project.js';
import Upload from '../models/Upload.js';

export async function listUsers(query = {}) {
  const { page = 1, limit = 50, search = '' } = query;
  
  const filter = {};
  if (search) {
    filter.$or = [
      { username: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') }
    ];
  }
  
  const total = await User.countDocuments(filter);
  const usersRaw = await User.find(filter)
    .select('-passwordHash')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();
    
  const users = usersRaw.map(u => ({ ...u, id: u._id.toString() }));
    
  return { users, total, page: Number(page), limit: Number(limit) };
}

export async function toggleBan(userId, banStatus, reason = null, bannedUntil = null, banIp = false, adminId = null) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };
  if (user.role === 'admin') return { error: 'Cannot ban an admin', status: 403 };
  
  user.isBanned = banStatus;
  if (banStatus) {
    user.bannedAt = new Date();
    user.banReason = reason;
    user.bannedUntil = bannedUntil ? new Date(bannedUntil) : null;

    if (banIp && user.lastIp) {
      const isLoopback = user.lastIp === '127.0.0.1' || user.lastIp === '::1' || user.lastIp === '::ffff:127.0.0.1';
      
      if (!isLoopback) {
        await BannedIp.findOneAndUpdate(
          { ip: user.lastIp },
          { 
            ip: user.lastIp, 
            reason: `Associated with banned user: ${user.username}`,
            userId: user._id,
            bannedBy: adminId
          },
          { upsert: true }
        );
      }
    }
  } else {
    user.bannedAt = null;
    user.banReason = null;
    user.banAppeal = null;
    user.appealAt = null;
    user.appealStatus = 'none';
    user.bannedUntil = null;
    user.appealResolvedAt = new Date();
    user.showUnbanMessage = true;
  }
  
  await user.save();
  return { success: true, user: user.toPublic() };
}

/**
 * Reject a user's ban appeal without unbanning them.
 */
export async function rejectAppeal(userId) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };

  user.appealStatus = 'rejected';
  user.appealAt = null;
  user.appealResolvedAt = new Date();
  
  await user.save();
  return { success: true, user: user.toPublic() };
}

export async function changeUserRole(userId, newRole) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };
  if (!['user', 'admin'].includes(newRole)) return { error: 'Invalid role', status: 400 };
  
  user.role = newRole;
  await user.save();
  return { success: true, user: user.toPublic() };
}

export async function deleteUser(userId) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };
  if (user.role === 'admin') return { error: 'Cannot delete an admin', status: 403 };
  
  // Soft delete and logically disable
  user.deletedAt = new Date();
  user.isDeleted = true;
  user.bannedUntil = null;
  user.banReason = null;
  user.banAppeal = null;
  user.appealAt = null;
  user.appealStatus = 'none';
  
  await user.save();
  return { success: true };
}

/**
 * Reactivate a soft-deleted user.
 */
export async function reactivateUser(userId) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };
  
  user.isDeleted = false;
  user.deletedAt = null;
  
  await user.save();
  return { success: true, user: user.toPublic() };
}
