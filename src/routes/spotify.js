import * as spotifyController from '../controllers/spotifyController.js';

const resolveSchema = {
  body: {
    type: 'object',
    properties: {
      url: { type: 'string', minLength: 1, maxLength: 500 },
    },
    required: ['url'],
  },
};

const callbackQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      code: { type: 'string', maxLength: 2000 },
      state: { type: 'string', maxLength: 2000 },
      error: { type: 'string', maxLength: 500 },
    },
  },
};

const uploadSchema = {
  body: {
    type: 'object',
    properties: {
      url: { type: 'string', minLength: 1, maxLength: 500 },
    },
    required: ['url'],
  },
};

const searchSchema = {
  querystring: {
    type: 'object',
    properties: {
      q: { type: 'string', minLength: 1, maxLength: 200 },
      limit: { type: 'integer', minimum: 1, maximum: 10 },
      offset: { type: 'integer', minimum: 0 },
    },
    required: ['q'],
  },
};

const paginationSchema = {
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 50 },
      offset: { type: 'integer', minimum: 0 },
    },
  },
};

const topTracksSchema = {
  querystring: {
    type: 'object',
    properties: {
      time_range: { type: 'string', enum: ['short_term', 'medium_term', 'long_term'] },
      limit: { type: 'integer', minimum: 1, maximum: 50 },
      offset: { type: 'integer', minimum: 0 },
    },
  },
};

const playlistIdParam = {
  params: {
    type: 'object',
    properties: {
      playlistId: { type: 'string', minLength: 1, maxLength: 100 },
    },
    required: ['playlistId'],
  },
};

const urisBodySchema = {
  body: {
    type: 'object',
    properties: {
      uris: { type: 'array', items: { type: 'string', maxLength: 200 }, minItems: 1, maxItems: 50 },
    },
    required: ['uris'],
  },
};

const createPlaylistSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string', maxLength: 300 },
      public: { type: 'boolean' },
    },
    required: ['name'],
  },
};

const transferPlaybackSchema = {
  body: {
    type: 'object',
    properties: {
      deviceId: { type: 'string', minLength: 1, maxLength: 200 },
      play: { type: 'boolean' },
    },
    required: ['deviceId'],
  },
};

const addToQueueSchema = {
  body: {
    type: 'object',
    properties: {
      uri: { type: 'string', minLength: 1, maxLength: 200 },
      deviceId: { type: 'string', maxLength: 200 },
    },
    required: ['uri'],
  },
};

const addToPlaylistSchema = {
  ...playlistIdParam,
  body: {
    type: 'object',
    properties: {
      uris: { type: 'array', items: { type: 'string', maxLength: 200 }, minItems: 1, maxItems: 100 },
    },
    required: ['uris'],
  },
};

const playlistTracksSchema = {
  ...playlistIdParam,
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 50 },
      offset: { type: 'integer', minimum: 0 },
    },
  },
};

const urisQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      uris: { type: 'string', minLength: 1, maxLength: 5000 },
    },
    required: ['uris'],
  },
};

const limitOnlySchema = {
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 50 },
    },
  },
};

export default async function spotifyRoutes(fastify) {
  // Anonymous resolve (client credentials)
  fastify.post(
    '/resolve',
    {
      schema: resolveSchema,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    spotifyController.resolve
  );

  // OAuth flow — authorize requires auth (to embed userId in state)
  fastify.get(
    '/auth/url',
    { preHandler: [fastify.requireActiveUser] },
    spotifyController.authorize
  );

  // Callback — Spotify redirects here. No auth needed (userId is in signed state).
  fastify.get(
    '/auth/callback',
    { schema: callbackQuerySchema },
    spotifyController.callback
  );

  // Token for Web Playback SDK
  fastify.get(
    '/token',
    { preHandler: [fastify.requireActiveUser] },
    spotifyController.getToken
  );

  // Disconnect
  fastify.post(
    '/disconnect',
    { preHandler: [fastify.requireActiveUser] },
    spotifyController.disconnect
  );

  // Create upload from Spotify URL
  fastify.post(
    '/upload',
    {
      schema: uploadSchema,
      preHandler: [fastify.requireActiveUser],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    spotifyController.createUpload
  );

  // ——— Search ———
  fastify.get(
    '/search',
    {
      schema: searchSchema,
      preHandler: [fastify.requireActiveUser],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    spotifyController.searchTracks
  );

  // ——— Library ———
  fastify.get(
    '/saved-tracks',
    {
      schema: paginationSchema,
      preHandler: [fastify.requireActiveUser],
    },
    spotifyController.savedTracks
  );

  fastify.get(
    '/recently-played',
    {
      schema: limitOnlySchema,
      preHandler: [fastify.requireActiveUser],
    },
    spotifyController.recentlyPlayed
  );

  fastify.get(
    '/top-tracks',
    {
      schema: topTracksSchema,
      preHandler: [fastify.requireActiveUser],
    },
    spotifyController.topTracks
  );

  // ——— Library save/remove/check ———
  fastify.put(
    '/library',
    {
      schema: urisBodySchema,
      preHandler: [fastify.requireActiveUser],
    },
    spotifyController.saveToLibrary
  );

  fastify.delete(
    '/library',
    {
      schema: urisBodySchema,
      preHandler: [fastify.requireActiveUser],
    },
    spotifyController.removeFromLibrary
  );

  fastify.get(
    '/library/contains',
    {
      schema: urisQuerySchema,
      preHandler: [fastify.requireActiveUser],
    },
    spotifyController.checkLibrary
  );

  // ——— Playlists ———
  fastify.get(
    '/playlists',
    {
      schema: paginationSchema,
      preHandler: [fastify.requireActiveUser],
    },
    spotifyController.playlists
  );

  fastify.get(
    '/playlists/:playlistId/tracks',
    {
      schema: playlistTracksSchema,
      preHandler: [fastify.requireActiveUser],
    },
    spotifyController.playlistTracks
  );

  fastify.post(
    '/playlists',
    {
      schema: createPlaylistSchema,
      preHandler: [fastify.requireActiveUser],
    },
    spotifyController.createPlaylist
  );

  fastify.post(
    '/playlists/:playlistId/tracks',
    {
      schema: addToPlaylistSchema,
      preHandler: [fastify.requireActiveUser],
    },
    spotifyController.addToPlaylist
  );

  // ——— Player / Devices ———
  fastify.get(
    '/devices',
    { preHandler: [fastify.requireActiveUser] },
    spotifyController.devices
  );

  fastify.put(
    '/player/transfer',
    {
      schema: transferPlaybackSchema,
      preHandler: [fastify.requireActiveUser],
    },
    spotifyController.transferPlayback
  );

  fastify.get(
    '/player',
    { preHandler: [fastify.requireActiveUser] },
    spotifyController.playbackState
  );

  fastify.get(
    '/player/currently-playing',
    { preHandler: [fastify.requireActiveUser] },
    spotifyController.currentlyPlaying
  );

  fastify.post(
    '/player/queue',
    {
      schema: addToQueueSchema,
      preHandler: [fastify.requireActiveUser],
    },
    spotifyController.addToQueue
  );

  fastify.get(
    '/player/queue',
    { preHandler: [fastify.requireActiveUser] },
    spotifyController.getQueue
  );
}
