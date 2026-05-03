import User from '../models/User.js';
import BannedIp from '../models/BannedIp.js';
import Project from '../models/Project.js';
import Upload from '../models/Upload.js';
import AdminLog from '../models/AdminLog.js';

export async function listUsers(query = {}) {
  const { page = 1, limit = 50, search = '', role = '', status = '' } = query;
  
  const filter = {};
  if (search) {
    filter.$or = [
      { username: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') }
    ];
  }

  if (role) filter.role = role;
  if (status) {
    if (status === 'banned') filter.isBanned = true;
    if (status === 'active') filter.isBanned = false;
    if (status === 'deleted') filter.isDeleted = true;
    if (status === 'verified') filter.isVerified = true;
    if (status === 'premium') {
      filter['spotify.isPremium'] = true;
    }
  }
  
  const total = await User.countDocuments(filter);
  const usersRaw = await User.find(filter)
    .select('-passwordHash')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();
    
  // Add resource counts
  const users = await Promise.all(usersRaw.map(async u => {
    const projectCount = await Project.countDocuments({ owner: u._id });
    const uploadCount = await Upload.countDocuments({ uploader: u._id });
    return { 
      ...u, 
      id: u._id.toString(),
      projectCount,
      uploadCount
    };
  }));
    
  return { users, total, page: Number(page), limit: Number(limit) };
}

export async function getStats() {
  const totalUsers = await User.countDocuments();
  const bannedUsers = await User.countDocuments({ isBanned: true });
  const pendingAppeals = await User.countDocuments({ appealStatus: 'pending' });
  const deletedUsers = await User.countDocuments({ isDeleted: true });
  
  // "Active" defined as users who logged in/refreshed in the last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const activeUsers = await User.countDocuments({ updatedAt: { $gte: yesterday } });

  return {
    totalUsers,
    bannedUsers,
    pendingAppeals,
    deletedUsers,
    activeUsers
  };
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

  if (adminId) {
    const admin = await User.findById(adminId);
    await logAdminAction({
      adminId,
      adminName: admin?.username || 'System',
      action: banStatus ? 'ban_user' : 'unban_user',
      targetId: user._id,
      targetName: user.username,
      details: banStatus ? `Reason: ${reason}${banIp ? ' (IP Banned)' : ''}` : 'Appeal approved / Manual unban'
    });
  }

  return { success: true, user: user.toPublic() };
}

/**
 * Reject a user's ban appeal without unbanning them.
 */
export async function rejectAppeal(userId, adminId = null) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };

  user.appealStatus = 'rejected';
  user.appealAt = null;
  user.appealResolvedAt = new Date();
  
  await user.save();

  if (adminId) {
    const admin = await User.findById(adminId);
    await logAdminAction({
      adminId,
      adminName: admin?.username || 'System',
      action: 'reject_appeal',
      targetId: user._id,
      targetName: user.username,
      details: 'Ban appeal rejected'
    });
  }

  return { success: true, user: user.toPublic() };
}

export async function changeUserRole(userId, newRole, adminId = null) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };
  if (!['user', 'admin'].includes(newRole)) return { error: 'Invalid role', status: 400 };
  
  user.role = newRole;
  await user.save();

  if (adminId) {
    const admin = await User.findById(adminId);
    await logAdminAction({
      adminId,
      adminName: admin?.username || 'System',
      action: 'change_role',
      targetId: user._id,
      targetName: user.username,
      details: `New role: ${newRole}`
    });
  }

  return { success: true, user: user.toPublic() };
}

export async function deleteUser(userId, adminId = null) {
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

  if (adminId) {
    const admin = await User.findById(adminId);
    await logAdminAction({
      adminId,
      adminName: admin?.username || 'System',
      action: 'delete_user',
      targetId: user._id,
      targetName: user.username,
      details: 'Soft deletion'
    });
  }

  return { success: true };
}

/**
 * Reactivate a soft-deleted user.
 */
export async function reactivateUser(userId, adminId = null) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };
  
  user.isDeleted = false;
  user.deletedAt = null;
  
  await user.save();

  if (adminId) {
    const admin = await User.findById(adminId);
    await logAdminAction({
      adminId,
      adminName: admin?.username || 'System',
      action: 'reactivate_user',
      targetId: user._id,
      targetName: user.username,
      details: 'Account reactivated'
    });
  }

  return { success: true, user: user.toPublic() };
}

/**
 * IP Blocklist Management
 */
export async function listBannedIps() {
  const ips = await BannedIp.find().sort({ createdAt: -1 }).lean();
  return ips.map(ip => ({ ...ip, id: ip._id.toString() }));
}

export async function blockIp(ip, reason, adminId) {
  const existing = await BannedIp.findOne({ ip });
  if (existing) return { error: 'IP already banned', status: 409 };

  const bannedIp = await BannedIp.create({
    ip,
    reason,
    bannedBy: adminId
  });
  return { success: true, bannedIp };
}

export async function unblockIp(ipId) {
  await BannedIp.findByIdAndDelete(ipId);
  return { success: true };
}

/**
 * Audit Logs
 */
export async function listAdminLogs(query = {}) {
  const { page = 1, limit = 100 } = query;
  const logs = await AdminLog.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .populate('adminId', 'username email')
    .lean();
  return { logs, page, limit };
}

export async function logAdminAction({ adminId, adminName, action, targetId, targetName, details, ip }) {
  await AdminLog.create({
    adminId,
    adminName,
    action,
    targetId,
    targetName,
    details,
    ip
  });
}
