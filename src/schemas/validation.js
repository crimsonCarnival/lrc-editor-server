/**
 * Shared JSON Schema fragments for Fastify request validation.
 * Used across route definitions to avoid duplication.
 */

export const lineItemSchema = {
  type: 'object',
  properties: {
    text: { type: 'string', maxLength: 2000 },
    timestamp: { type: ['number', 'null'] },
    endTime: { type: ['number', 'null'] },
    secondary: { type: 'string', maxLength: 2000 },
    translation: { type: 'string', maxLength: 2000 },
    id: { type: 'string', maxLength: 50 },
    words: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string', maxLength: 500 },
          time: { type: ['number', 'null'] },
          reading: { type: 'string', maxLength: 500 },
        },
      },
    },
    secondaryWords: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string', maxLength: 500 },
          time: { type: ['number', 'null'] },
        },
      },
    },
  },
};

export const linesArray = { type: 'array', items: lineItemSchema, maxItems: 5000 };

export const audioSchema = {
  type: 'object',
  properties: {
    source: { type: 'string', enum: ['local', 'youtube', 'spotify'] },
    cloudinaryUrl: { type: ['string', 'null'], maxLength: 500, pattern: '^https?://' },
    publicId: { type: ['string', 'null'], maxLength: 500 },
    youtubeUrl: { type: ['string', 'null'], maxLength: 500, pattern: '^https?://' },
    spotifyTrackId: { type: ['string', 'null'], maxLength: 100, pattern: '^[a-zA-Z0-9]+$' },
    duration: { type: ['number', 'null'] },
    fileName: { type: ['string', 'null'], maxLength: 500 },
  },
  additionalProperties: false,
};

export const stateSchema = {
  type: 'object',
  properties: {
    syncMode: { type: 'boolean' },
    activeLineIndex: { type: 'integer', minimum: 0 },
    playbackPosition: { type: 'number', minimum: 0 },
    playbackSpeed: { type: 'number', minimum: 0.05, maximum: 10 },
  },
  additionalProperties: false,
};

export const lyricsSchema = {
  type: 'object',
  properties: {
    editorMode: { type: 'string', enum: ['lrc', 'srt', 'words'] },
    lines: linesArray,
    // Partial update fields (PATCH)
    lineIndex: { type: 'integer', minimum: 0 },
    line: { type: 'object' },
    wordIndex: { type: 'integer', minimum: 0 },
    word: { type: 'object' },
  },
  additionalProperties: false,
};

export const projectIdParam = {
  type: 'object',
  properties: { id: { type: 'string', minLength: 1, maxLength: 21 } },
  required: ['id'],
};

export const settingsBodySchema = {
  type: 'object',
  properties: {
    playback: { type: 'object' },
    editor: { type: 'object' },
    export: { type: 'object' },
    interface: { type: 'object' },
    shortcuts: { type: 'object' },
    import: { type: 'object' },
    advanced: { type: 'object' },
  },
  additionalProperties: false,
};
