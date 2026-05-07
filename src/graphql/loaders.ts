import { MercuriusLoaders } from 'mercurius';
import User from '../db/user.model.js';
import Upload from '../modules/uploads/upload.model.js';
import Lyrics from '../modules/lyrics/lyrics.model.js';

export const loaders: MercuriusLoaders = {
  Project: {
    user: {
      loader: async (queries: Array<{ obj: any }>, _context) => {
        const ids = queries.map(({ obj }) => obj.userId);
        const users = await User.find({ _id: { $in: ids } });
        return ids.map((id: any) => users.find((u: any) => u._id.toString() === id.toString()));
      },
    },
    upload: {
      loader: async (queries: Array<{ obj: any }>, _context) => {
        const ids = queries.map(({ obj }) => obj.uploadId);
        const uploads = await Upload.find({ _id: { $in: ids } });
        return ids.map((id: any) => uploads.find((u: any) => u._id.toString() === id?.toString()));
      },
    },
    lyrics: {
      loader: async (queries: Array<{ obj: any }>, _context) => {
        const ids = queries.map(({ obj }) => obj.lyricsId);
        const lyricsList = await Lyrics.find({ _id: { $in: ids } });
        return ids.map((id: any) => lyricsList.find((l: any) => l._id.toString() === id?.toString()));
      },
    },
  },
  Upload: {
    user: {
      loader: async (queries: Array<{ obj: any }>, _context) => {
        const ids = queries.map(({ obj }) => obj.userId);
        const users = await User.find({ _id: { $in: ids } });
        return ids.map((id: any) => users.find((u: any) => u._id.toString() === id.toString()));
      },
    },
  },
};

