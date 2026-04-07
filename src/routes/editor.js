/**
 * Routes for editor operations: mark, shift, clear, detect duplicates.
 * Delegates to editorController, which calls pure service functions.
 */

import * as editorController from '../controllers/editorController.js';
import { linesArray } from '../schemas/validation.js';

// --- Schemas ---

const markSchema = {
  body: {
    type: 'object',
    properties: {
      lines: linesArray,
      activeLineIndex: { type: 'integer', minimum: 0 },
      time: { type: 'number', minimum: 0 },
      editorMode: { type: 'string', enum: ['lrc', 'srt', 'words'] },
      activeWordIndex: { type: 'integer', minimum: 0 },
      stampTarget: { type: 'string', enum: ['main', 'secondary'] },
      awaitingEndMark: { type: ['integer', 'null'] },
      focusedTimestamp: {
        type: ['object', 'null'],
        properties: {
          lineIndex: { type: 'integer', minimum: 0 },
          type: { type: 'string', enum: ['start', 'end', 'word'] },
          wordIndex: { type: 'integer', minimum: 0 },
        },
      },
      settings: {
        type: 'object',
        properties: {
          autoAdvance: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              skipBlank: { type: 'boolean' },
            },
          },
          srt: {
            type: 'object',
            properties: {
              snapToNextLine: { type: 'boolean' },
              minSubtitleGap: { type: 'number' },
            },
          },
        },
      },
    },
    required: ['lines', 'activeLineIndex', 'time', 'editorMode', 'settings'],
  },
};

const bulkShiftSchema = {
  body: {
    type: 'object',
    properties: {
      lines: linesArray,
      selectedIndices: { type: 'array', items: { type: 'integer', minimum: 0 } },
      delta: { type: 'number' },
    },
    required: ['lines', 'selectedIndices', 'delta'],
  },
};

const globalOffsetSchema = {
  body: {
    type: 'object',
    properties: {
      lines: linesArray,
      delta: { type: 'number' },
    },
    required: ['lines', 'delta'],
  },
};

const clearAllSchema = {
  body: {
    type: 'object',
    properties: {
      lines: linesArray,
      isSrt: { type: 'boolean' },
      isWords: { type: 'boolean' },
    },
    required: ['lines'],
  },
};

const clearLineSchema = {
  body: {
    type: 'object',
    properties: {
      lines: linesArray,
      index: { type: 'integer', minimum: 0 },
      isSrt: { type: 'boolean' },
      isWords: { type: 'boolean' },
    },
    required: ['lines', 'index'],
  },
};

const detectDuplicatesSchema = {
  body: {
    type: 'object',
    properties: {
      lines: linesArray,
      threshold: { type: 'number', minimum: 0 },
    },
    required: ['lines'],
  },
};

export default async function editorRoutes(fastify) {
  fastify.post('/mark', { schema: markSchema }, editorController.mark);
  fastify.post('/bulk-shift', { schema: bulkShiftSchema }, editorController.bulkShift);
  fastify.post('/global-offset', { schema: globalOffsetSchema }, editorController.globalOffset);
  fastify.post('/clear-all', { schema: clearAllSchema }, editorController.clearAll);
  fastify.post('/clear-line', { schema: clearLineSchema }, editorController.clearLine);
  fastify.post('/detect-duplicates', { schema: detectDuplicatesSchema }, editorController.detectDuplicates);
}
