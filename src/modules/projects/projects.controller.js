import * as projectService from './projects.service.js';

/**
 * POST /projects — create a new project.
 */
export async function create(req, res) {
  const result = await projectService.createProject(req.body, req.userId);
  return res.code(201).send(result);
}

/**
 * GET /projects — list user's projects.
 */
export async function list(req, res) {
  const projects = await projectService.listProjects(req.userId);
  return res.send({ projects });
}

/**
 * GET /projects/:id — get a single project.
 */
export async function get(req, res) {
  const project = await projectService.getProject(req.params.id);
  if (!project) {
    return res.code(404).send({ error: 'Project not found' });
  }
  return res.send({ project });
}

/**
 * PUT /projects/:id — full project update.
 */
export async function update(req, res) {
  const result = await projectService.updateProject(
    req.params.id,
    req.body,
    req.userId
  );
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.send(result);
}

/**
 * PATCH /projects/:id — partial project update.
 */
export async function patch(req, res) {
  const result = await projectService.patchProject(
    req.params.id,
    req.body,
    req.userId
  );
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.send(result);
}

/**
 * DELETE /projects/:id — delete a project.
 */
export async function remove(req, res) {
  const result = await projectService.deleteProject(req.params.id, req.userId);
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.code(204).send();
}

/**
 * GET /projects/share/:id — get a project for public sharing (read-only).
 */
export async function getShare(req, res) {
  const project = await projectService.getShareProject(req.params.id);
  if (!project) {
    return res.code(404).send({ error: 'Project not found' });
  }
  return res.send({ project });
}

/**
 * POST /projects/clone/:id — clone a project (requires authentication).
 */
export async function clone(req, res) {
  const result = await projectService.cloneProject(req.params.id, req.userId);
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.code(201).send(result);
}
