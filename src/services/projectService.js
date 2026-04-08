import Project from '../models/Project.js';
import Lyrics from '../models/Lyrics.js';
import Upload from '../models/Upload.js';

const ANON_EXPIRY_DAYS = 7;

/**
 * Create a new project with its associated lyrics document.
 * @param {object} data - Project data from the client
 * @param {string|null} userId - Authenticated user ID or null for anonymous
 * @returns {{ projectId: string, url: string }}
 */
export async function createProject(data, userId) {
  const { title, uploadId, lyrics, state, metadata, readOnly } = data;

  const projectData = {
    userId: userId || null,
    title: title || '',
    uploadId: uploadId || null,
    state: state || {},
    metadata: metadata || {},
    readOnly: readOnly ?? true,
    type: userId ? 'saved' : 'temporary',
  };

  if (!userId) {
    projectData.expiresAt = new Date(Date.now() + ANON_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  }

  const project = await Project.create(projectData);

  // Create separate lyrics document
  const lyricsData = {
    projectId: project.projectId,
    editorMode: lyrics?.editorMode || 'lrc',
    lines: lyrics?.lines || [],
  };
  const lyricsDoc = await Lyrics.create(lyricsData);

  // Link lyrics to project
  project.lyricsId = lyricsDoc._id;
  await project.save();

  return {
    projectId: project.projectId,
    url: `/s/${project.projectId}`,
  };
}

/**
 * List projects for an authenticated user.
 * @param {string} userId
 * @returns {object[]} Array of project summaries
 */
export async function listProjects(userId) {
  const projects = await Project.find({ userId, deletedAt: null })
    .select('projectId title metadata uploadId readOnly createdAt updatedAt')
    .populate('uploadId', 'source fileName youtubeUrl cloudinaryUrl duration title')
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  // Batch-fetch lyrics metadata for all projects
  const projectIds = projects.map((s) => s.projectId);
  const lyricsMetadata = await Lyrics.find({ projectId: { $in: projectIds } })
    .select('projectId editorMode lines')
    .lean();

  const lyricsMap = new Map();
  for (const l of lyricsMetadata) {
    lyricsMap.set(l.projectId, l);
  }

  return projects.map((s) => {
    const lyrics = lyricsMap.get(s.projectId);
    const upload = s.uploadId;
    let uploadObj = null;
    if (upload && typeof upload === 'object') {
      uploadObj = { ...upload, id: upload._id.toString() };
      delete uploadObj._id;
    }
    return {
      projectId: s.projectId,
      title: s.title,
      metadata: s.metadata || {},
      upload: uploadObj,
      editorMode: lyrics?.editorMode || 'lrc',
      lineCount: lyrics?.lines?.length || 0,
      readOnly: s.readOnly,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  });
}

/**
 * Get a project by projectId, assembling lyrics from the Lyrics collection.
 * @param {string} projectId
 * @returns {object|null} Public project object with lyrics inlined
 */
export async function getProject(projectId) {
  const project = await Project.findOne({ projectId, deletedAt: null })
    .populate('uploadId', 'source fileName youtubeUrl cloudinaryUrl duration title');
  if (!project) return null;

  const lyrics = await Lyrics.findOne({ projectId });

  const pub = project.toPublic();
  const rawUpload = pub.uploadId;
  if (rawUpload && typeof rawUpload === 'object') {
    pub.upload = { ...rawUpload, id: rawUpload._id?.toString?.() || rawUpload.id };
    delete pub.upload._id;
  } else {
    pub.upload = null;
  }
  delete pub.uploadId;
  
  pub.lyrics = lyrics
    ? { editorMode: lyrics.editorMode, language: lyrics.language || null, lines: lyrics.lines }
    : { editorMode: 'lrc', language: null, lines: [] };

  return pub;
}

/**
 * Full update (PUT) of a project.
 * Optimized to build response from update results instead of refetching.
 * @param {string} projectId
 * @param {object} data - Update payload
 * @param {string|null} userId - Authenticated user ID
 * @returns {{ project: object }|{ error: string, status: number }}
 */
export async function updateProject(projectId, data, userId) {
  const project = await Project.findOne({ projectId, deletedAt: null });
  if (!project) return { error: 'Project not found', status: 404 };

  if (project.userId && !project.isOwnedBy(userId)) {
    return { error: 'Not authorized to edit this project', status: 403 };
  }

  const { title, uploadId, lyrics, state, metadata, readOnly } = data;

  // Update project fields
  const projectUpdate = {};
  if (title !== undefined) projectUpdate.title = title;
  if (uploadId !== undefined) projectUpdate.uploadId = uploadId;
  if (state !== undefined) projectUpdate.state = state;
  if (metadata !== undefined) projectUpdate.metadata = metadata;
  if (readOnly !== undefined) projectUpdate.readOnly = readOnly;

  // Claim anonymous project
  if (!project.userId && userId) {
    projectUpdate.userId = userId;
    projectUpdate.expiresAt = null;
    projectUpdate.type = 'saved';
  }

  projectUpdate.lastEditedBy = userId || null;

  // Update project and get updated document
  const updatedProject = await Project.findOneAndUpdate(
    { projectId },
    { $set: projectUpdate, $inc: { version: 1 } },
    { new: true }
  ).populate('uploadId', 'source fileName youtubeUrl cloudinaryUrl duration title spotifyTrackId artist thumbnailUrl');

  // Update lyrics in separate collection
  let updatedLyrics;
  if (lyrics !== undefined) {
    const lyricsUpdate = {};
    if (lyrics.editorMode !== undefined) lyricsUpdate.editorMode = lyrics.editorMode;
    if (lyrics.language !== undefined) lyricsUpdate.language = lyrics.language;
    if (lyrics.lines !== undefined) lyricsUpdate.lines = lyrics.lines;

    updatedLyrics = await Lyrics.findOneAndUpdate(
      { projectId },
      { $set: lyricsUpdate, $inc: { version: 1 } },
      { upsert: true, new: true }
    );
  } else {
    updatedLyrics = await Lyrics.findOne({ projectId });
  }

  // Build response from updated documents (avoiding refetch)
  const pub = updatedProject.toPublic();
  const rawUpload = pub.uploadId;
  if (rawUpload && typeof rawUpload === 'object') {
    pub.upload = { ...rawUpload, id: rawUpload._id?.toString?.() || rawUpload.id };
    delete pub.upload._id;
  } else {
    pub.upload = null;
  }
  delete pub.uploadId;
  
  pub.lyrics = updatedLyrics
    ? { editorMode: updatedLyrics.editorMode, language: updatedLyrics.language || null, lines: updatedLyrics.lines }
    : { editorMode: 'lrc', language: null, lines: [] };

  return { project: pub };
}

/**
 * Partial update (PATCH) of a project with fine-grained lyrics support.
 * Optimized to avoid refetching when possible.
 *
 * Supports:
 * - Top-level fields: title, audio, state, readOnly
 * - Full lyrics replace: lyrics.lines, lyrics.editorMode
 * - Single line update: lyrics.lineIndex + lyrics.line
 * - Word timing update: lyrics.lineIndex + lyrics.wordIndex + lyrics.word
 * - Version-based conflict detection
 *
 * @param {string} projectId
 * @param {object} data - Patch payload
 * @param {string|null} userId
 * @returns {{ project: object }|{ error: string, status: number }}
 */
export async function patchProject(projectId, data, userId) {
  const project = await Project.findOne({ projectId, deletedAt: null });
  if (!project) return { error: 'Project not found', status: 404 };

  if (project.userId && !project.isOwnedBy(userId)) {
    return { error: 'Not authorized to edit this project', status: 403 };
  }

  // Version check for optimistic locking
  if (data.version !== undefined && data.version !== project.version) {
    return { error: 'Version conflict — reload and retry', status: 409 };
  }

  const projectUpdate = {};
  const allowed = ['title', 'uploadId', 'state', 'metadata', 'readOnly'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      projectUpdate[key] = data[key];
    }
  }

  // Claim anonymous project
  if (!project.userId && userId) {
    projectUpdate.userId = userId;
    projectUpdate.expiresAt = null;
    projectUpdate.type = 'saved';
  }

  projectUpdate.lastEditedBy = userId || null;

  const hasProjectUpdate = Object.keys(projectUpdate).length > 1; // > 1 because lastEditedBy always set
  
  // Update project if needed
  let updatedProject = project;
  if (hasProjectUpdate) {
    updatedProject = await Project.findOneAndUpdate(
      { projectId },
      { $set: projectUpdate, $inc: { version: 1 } },
      { new: true }
    ).populate('uploadId', 'source fileName youtubeUrl cloudinaryUrl duration title spotifyTrackId artist thumbnailUrl');
  }

  // Handle lyrics updates
  let updatedLyrics;
  if (data.lyrics !== undefined) {
    await patchLyrics(projectId, data.lyrics);
    updatedLyrics = await Lyrics.findOne({ projectId });
  } else {
    updatedLyrics = await Lyrics.findOne({ projectId });
  }

  // Build response from updated documents
  const pub = updatedProject.toPublic();
  const rawUpload = pub.uploadId;
  if (rawUpload && typeof rawUpload === 'object') {
    pub.upload = { ...rawUpload, id: rawUpload._id?.toString?.() || rawUpload.id };
    delete pub.upload._id;
  } else {
    pub.upload = null;
  }
  delete pub.uploadId;
  
  pub.lyrics = updatedLyrics
    ? { editorMode: updatedLyrics.editorMode, language: updatedLyrics.language || null, lines: updatedLyrics.lines }
    : { editorMode: 'lrc', language: null, lines: [] };

  return { project: pub };
}

/**
 * Fine-grained lyrics patching.
 * Supports full replace, single line update, and word timing update.
 */
async function patchLyrics(projectId, lyricsData) {
  // Single line update (most efficient for autosave)
  if (lyricsData.lineIndex !== undefined && lyricsData.line !== undefined) {
    const update = {};
    for (const [key, value] of Object.entries(lyricsData.line)) {
      update[`lines.${lyricsData.lineIndex}.${key}`] = value;
    }
    await Lyrics.updateOne(
      { projectId },
      { $set: update, $inc: { version: 1 } }
    );
    return;
  }

  // Word timing update (most efficient for word-level sync)
  if (
    lyricsData.lineIndex !== undefined &&
    lyricsData.wordIndex !== undefined &&
    lyricsData.word !== undefined
  ) {
    const update = {};
    for (const [key, value] of Object.entries(lyricsData.word)) {
      update[`lines.${lyricsData.lineIndex}.words.${lyricsData.wordIndex}.${key}`] = value;
    }
    await Lyrics.updateOne(
      { projectId },
      { $set: update, $inc: { version: 1 } }
    );
    return;
  }

  // Full lyrics update
  const lyricsUpdate = {};
  if (lyricsData.editorMode !== undefined) lyricsUpdate.editorMode = lyricsData.editorMode;
  if (lyricsData.language !== undefined) lyricsUpdate.language = lyricsData.language;
  if (lyricsData.lines !== undefined) lyricsUpdate.lines = lyricsData.lines;

  if (Object.keys(lyricsUpdate).length > 0) {
    await Lyrics.updateOne(
      { projectId },
      { $set: lyricsUpdate, $inc: { version: 1 } },
      { upsert: true }
    );
  }
}

/**
 * Delete a project (soft delete).
 * @param {string} projectId
 * @param {string} userId
 * @returns {{ error?: string, status?: number }}
 */
export async function deleteProject(projectId, userId) {
  const project = await Project.findOne({ projectId, deletedAt: null });
  if (!project) return { error: 'Project not found', status: 404 };

  if (!project.isOwnedBy(userId)) {
    return { error: 'Not authorized to delete this project', status: 403 };
  }

  // Soft delete project and its lyrics
  project.deletedAt = new Date();
  await project.save();
  await Lyrics.deleteOne({ projectId });

  return {};
}
