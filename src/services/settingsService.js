import Settings from '../models/Settings.js';

const SETTINGS_CATEGORIES = ['playback', 'editor', 'export', 'interface', 'shortcuts', 'import', 'advanced'];

/**
 * Get settings for a user.
 * @param {string} userId
 * @returns {object} Public settings object (empty {} if none saved)
 */
export async function getSettings(userId) {
  const doc = await Settings.findOne({ userId });
  if (!doc) return {};
  return doc.toPublic();
}

/**
 * Replace all settings (PUT).
 * @param {string} userId
 * @param {object} body
 * @returns {object} Updated public settings
 */
export async function replaceSettings(userId, body) {
  const update = {};
  for (const key of SETTINGS_CATEGORIES) {
    if (body[key] !== undefined) {
      update[key] = body[key];
    }
  }

  const doc = await Settings.findOneAndUpdate(
    { userId },
    { $set: update },
    { new: true, upsert: true, runValidators: true }
  );
  return doc.toPublic();
}

/**
 * Merge partial settings (PATCH) — deep-merges into existing sub-documents.
 * @param {string} userId
 * @param {object} body
 * @returns {object} Updated public settings
 */
export async function patchSettings(userId, body) {
  const update = {};
  for (const key of SETTINGS_CATEGORIES) {
    if (body[key] !== undefined) {
      // Use dot-notation so only the provided sub-keys are overwritten
      for (const [subKey, value] of Object.entries(body[key])) {
        update[`${key}.${subKey}`] = value;
      }
    }
  }

  if (Object.keys(update).length === 0) {
    const existing = await Settings.findOne({ userId });
    return existing ? existing.toPublic() : {};
  }

  const doc = await Settings.findOneAndUpdate(
    { userId },
    { $set: update },
    { new: true, upsert: true, runValidators: true }
  );
  return doc.toPublic();
}

/**
 * Reset settings to defaults (delete doc).
 * @param {string} userId
 */
export async function resetSettings(userId) {
  await Settings.deleteOne({ userId });
}
