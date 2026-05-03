import User from '../models/User.js';
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

export async function toggleBan(userId, banStatus, reason = null) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };
  if (user.role === 'admin') return { error: 'Cannot ban an admin', status: 403 };
  
  user.isBanned = banStatus;
  if (banStatus) {
    user.bannedAt = new Date();
    user.banReason = reason;
  } else {
    user.bannedAt = null;
    user.banReason = null;
    user.banAppeal = null;
    user.appealAt = null;
    user.appealResolvedAt = new Date();
  }
  
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
  
  // Soft delete user
  user.deletedAt = new Date();
  await user.save();
  
  return { success: true };
}
