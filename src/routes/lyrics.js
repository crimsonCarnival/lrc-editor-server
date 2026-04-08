/**
 * Routes for lyrics operations: parse, compile, infer end times.
 * Delegates to lyricsController.
 */

import * as lyricsController from '../controllers/lyricsController.js';
import { lineItemSchema } from '../schemas/validation.js';

// --- Validation schemas ---

const parseSchema = {
  body: {
    type: 'object',
    properties: {
      content: { type: 'string', maxLength: 5242880 }, // 5 MB
      filename: { type: 'string', minLength: 1, maxLength: 255 },
    },
    required: ['content', 'filename'],
  },
};

const compileLrcSchema = {
  body: {
    type: 'object',
    properties: {
      lines: { type: 'array', items: lineItemSchema, maxItems: 5000 },
      includeTranslations: { type: 'boolean' },
      precision: { type: 'string', enum: ['hundredths', 'thousandths'] },
      metadata: {
        type: 'object',
        properties: {
          ti: { type: 'string', maxLength: 500 },
          ar: { type: 'string', maxLength: 500 },
          al: { type: 'string', maxLength: 500 },
          lg: { type: 'string', maxLength: 50 },
        },
      },
      lineEndings: { type: 'string', enum: ['lf', 'crlf'] },
      includeSecondary: { type: 'boolean' },
      wordPrecision: { type: 'string', enum: ['hundredths', 'thousandths'] },
    },
    required: ['lines'],
  },
};

const compileSrtSchema = {
  body: {
    type: 'object',
    properties: {
      lines: { type: 'array', items: lineItemSchema, maxItems: 5000 },
      duration: { type: ['number', 'null'] },
      includeTranslations: { type: 'boolean' },
      lineEndings: { type: 'string', enum: ['lf', 'crlf'] },
      srtConfig: {
        type: 'object',
        properties: {
          minSubtitleGap: { type: 'number', minimum: 0 },
          defaultSubtitleDuration: { type: 'number', minimum: 0.1 },
        },
      },
      includeSecondary: { type: 'boolean' },
    },
    required: ['lines'],
  },
};

const inferEndTimesSchema = {
  body: {
    type: 'object',
    properties: {
      lines: { type: 'array', items: lineItemSchema, maxItems: 5000 },
      duration: { type: ['number', 'null'] },
      srtConfig: {
        type: 'object',
        properties: {
          minSubtitleGap: { type: 'number', minimum: 0 },
          defaultSubtitleDuration: { type: 'number', minimum: 0.1 },
        },
      },
    },
    required: ['lines'],
  },
};

export default async function lyricsRoutes(fastify) {
  fastify.post('/parse', { schema: parseSchema }, lyricsController.parse);
  fastify.post('/compile/lrc', { schema: compileLrcSchema }, lyricsController.compileLrc);
  fastify.post('/compile/srt', { schema: compileSrtSchema }, lyricsController.compileSrt);
  fastify.post('/infer-end-times', { schema: inferEndTimesSchema }, lyricsController.inferEnd);
}
