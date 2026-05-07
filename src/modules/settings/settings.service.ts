import Settings, { type ISettingsMethods } from './settings.model.js';

const SETTINGS_CATEGORIES = ['playback', 'editor', 'export', 'interface', 'shortcuts', 'import', 'advanced'];

export async function getSettings(userId: string): Promise<Record<string, unknown>> {
  const doc = await Settings.findOne({ userId });
  if (!doc) return {};
  return (doc as unknown as ISettingsMethods).toPublic() as Record<string, unknown>;
}

export async function replaceSettings(userId: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const update: Record<string, unknown> = {};
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
  return (doc as unknown as ISettingsMethods).toPublic() as Record<string, unknown>;
}

export async function patchSettings(userId: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const update: Record<string, unknown> = {};

  const flatten = (obj: Record<string, unknown>, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (!prefix && !SETTINGS_CATEGORIES.includes(key)) continue;

      if (value && typeof value === 'object' && !Array.isArray(value) && prefix) {
        flatten(value as Record<string, unknown>, path);
      } else {
        update[path] = value;
      }
    }
  };

  flatten(body);

  if (Object.keys(update).length === 0) {
    const existing = await Settings.findOne({ userId });
    return existing ? ((existing as unknown as ISettingsMethods).toPublic() as Record<string, unknown>) : {};
  }

  const doc = await Settings.findOneAndUpdate(
    { userId },
    { $set: update },
    { new: true, upsert: true, runValidators: true }
  );
  return (doc as unknown as ISettingsMethods).toPublic() as Record<string, unknown>;
}

export async function resetSettings(userId: string): Promise<void> {
  await Settings.deleteOne({ userId });
}