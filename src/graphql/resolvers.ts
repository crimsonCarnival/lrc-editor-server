import { MercuriusContext } from 'mercurius';
import User from '../db/user.model.js';
import Project from '../modules/projects/project.model.js';
import Lyrics from '../modules/lyrics/lyrics.model.js';
import Upload from '../modules/uploads/upload.model.js';
import Settings from '../modules/settings/settings.model.js';

interface Context extends MercuriusContext {
  userId?: string | null;
}

export const resolvers = {
  Query: {
    health: async () => ({
      status: 'ok',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
    }),
    me: async (_root: any, _args: any, context: Context) => {
      if (!context.userId) return null;
      const user = await User.findById(context.userId);
      return user?.toPublic();
    },
    project: async (_root: any, { id }: { id: string }) => {
      return Project.findById(id);
    },
    projects: async (_root: any, { limit = 20, offset = 0 }: { limit?: number; offset?: number }, context: Context) => {
      if (!context.userId) return [];
      return Project.find({ userId: context.userId })
        .sort({ updatedAt: -1 })
        .skip(offset)
        .limit(limit);
    },
    upload: async (_root: any, { id }: { id: string }) => {
      return Upload.findById(id);
    },
  },

  Mutation: {
    createProject: async (_root: any, { input }: { input: any }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      const project = new Project({
        ...input,
        userId: context.userId,
      });
      await project.save();
      return project;
    },
    deleteProject: async (_root: any, { id }: { id: string }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      const result = await Project.deleteOne({ _id: id, userId: context.userId });
      return result.deletedCount === 1;
    },
    updateProject: async (_root: any, { id, input }: { id: string; input: any }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      return Project.findOneAndUpdate(
        { _id: id, userId: context.userId },
        { $set: input },
        { new: true }
      );
    },
    updateLyrics: async (_root: any, { projectId, input }: { projectId: string; input: any }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      // Verify ownership through the project
      const project = await Project.findOne({ projectId, userId: context.userId });
      if (!project) throw new Error('Project not found or access denied');
      
      return Lyrics.findOneAndUpdate(
        { projectId },
        { $set: input },
        { new: true, upsert: true }
      );
    },
    updateProfile: async (_root: any, { input }: { input: any }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      const user = await User.findByIdAndUpdate(
        context.userId,
        { $set: input },
        { new: true }
      );
      return user?.toPublic();
    },
    updateSettings: async (_root: any, { input }: { input: any }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      return Settings.findOneAndUpdate(
        { userId: context.userId },
        { $set: input },
        { new: true, upsert: true }
      );
    },
  },

  // Field Resolvers for Relationships
  Project: {
    user: async (project: any) => {
      return User.findById(project.userId);
    },
    upload: async (project: any) => {
      return Upload.findById(project.uploadId);
    },
    lyrics: async (project: any) => {
      return Lyrics.findById(project.lyricsId);
    },
  },

  User: {
    projects: async (user: any) => {
      return Project.find({ userId: user.id });
    },
    uploads: async (user: any) => {
      return Upload.find({ userId: user.id });
    },
    settings: async (user: any) => {
      return Settings.findOne({ userId: user.id });
    },
  },

  Upload: {
    user: async (upload: any) => {
      return User.findById(upload.userId);
    },
  },
};

