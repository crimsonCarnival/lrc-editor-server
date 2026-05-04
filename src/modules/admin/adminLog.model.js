import mongoose from 'mongoose';

const adminLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    adminName: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true, // e.g., 'ban_user', 'unban_user', 'change_role', 'delete_user'
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    targetName: {
      type: String,
      default: null,
    },
    details: {
      type: String,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('AdminLog', adminLogSchema);
