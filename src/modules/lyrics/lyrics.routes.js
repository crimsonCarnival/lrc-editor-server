/**
 * Lyrics routes — registers /lyrics/* and /editor/* endpoints.
 *
 * Both prefixes operate on the same domain (structured lyric line arrays)
 * and are handled by a single merged controller. Old URL prefixes are preserved
 * for backward compatibility with the frontend API client.
 *
 * Registration in server.js:
 *   app.register(lyricsRoutes, { prefix: '/lyrics' });
 *   app.register(lyricsRoutes, { prefix: '/editor' });
 */
import * as lyricsController from './lyrics.controller.js';
import {
  parseSchema,
  compileLrcSchema,
  compileSrtSchema,
  inferEndTimesSchema,
  markSchema,
  bulkShiftSchema,
  globalOffsetSchema,
  clearAllSchema,
  clearLineSchema,
  detectDuplicatesSchema,
} from './lyrics.schema.js';

export default async function lyricsRoutes(fastify) {
  // ─── Parse / Compile (prefix: /lyrics) ───────────────────────────
  fastify.post('/parse', { schema: parseSchema }, lyricsController.parse);
  fastify.post('/compile/lrc', { schema: compileLrcSchema }, lyricsController.compileLrc);
  fastify.post('/compile/srt', { schema: compileSrtSchema }, lyricsController.compileSrt);
  fastify.post('/infer-end-times', { schema: inferEndTimesSchema }, lyricsController.inferEnd);

  // ─── Editor operations (prefix: /editor) ─────────────────────────
  fastify.post('/mark', { schema: markSchema }, lyricsController.mark);
  fastify.post('/bulk-shift', { schema: bulkShiftSchema }, lyricsController.bulkShift);
  fastify.post('/global-offset', { schema: globalOffsetSchema }, lyricsController.globalOffset);
  fastify.post('/clear-all', { schema: clearAllSchema }, lyricsController.clearAll);
  fastify.post('/clear-line', { schema: clearLineSchema }, lyricsController.clearLine);
  fastify.post('/detect-duplicates', { schema: detectDuplicatesSchema }, lyricsController.detectDuplicates);
}
