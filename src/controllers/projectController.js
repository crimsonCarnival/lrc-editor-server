import * as projectService from '../services/projectService.js';

/**
 * POST /projects — create a new project.
 */
export async function create(request, reply) {
  const result = await projectService.createProject(request.body, request.userId);
  return reply.code(201).send(result);
}

/**
 * GET /projects — list user's projects.
 */
export async function list(request, reply) {
  const projects = await projectService.listProjects(request.userId);
  return reply.send({ projects });
}

/**
 * GET /projects/:id — get a single project.
 */
export async function get(request, reply) {
  const project = await projectService.getProject(request.params.id);
  if (!project) {
    return reply.code(404).send({ error: 'Project not found' });
  }
  return reply.send({ project });
}

/**
 * PUT /projects/:id — full project update.
 */
export async function update(request, reply) {
  const result = await projectService.updateProject(
    request.params.id,
    request.body,
    request.userId
  );
  if (result.error) {
    return reply.code(result.status).send({ error: result.error });
  }
  return reply.send(result);
}

/**
 * PATCH /projects/:id — partial project update.
 */
export async function patch(request, reply) {
  const result = await projectService.patchProject(
    request.params.id,
    request.body,
    request.userId
  );
  if (result.error) {
    return reply.code(result.status).send({ error: result.error });
  }
  return reply.send(result);
}

/**
 * DELETE /projects/:id — delete a project.
 */
export async function remove(request, reply) {
  const result = await projectService.deleteProject(request.params.id, request.userId);
  if (result.error) {
    return reply.code(result.status).send({ error: result.error });
  }
  return reply.code(204).send();
}
