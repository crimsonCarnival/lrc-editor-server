import * as adminService from '../services/adminService.js';
import { requestLog } from '../plugins/requestLogger.js';

export async function getUsers(req, res) {
  const result = await adminService.listUsers(req.query);
  return res.send(result);
}

export async function banUser(req, res) {
  const { reason, bannedUntil, banIp } = req.body;
  const result = await adminService.toggleBan(req.params.id, true, reason, bannedUntil, banIp, req.userId);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

export async function unbanUser(req, res) {
  const result = await adminService.toggleBan(req.params.id, false);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

export async function rejectAppeal(req, res) {
  const result = await adminService.rejectAppeal(req.params.id);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

export async function changeRole(req, res) {
  const result = await adminService.changeUserRole(req.params.id, req.body.role);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

export async function deleteUser(req, res) {
  const result = await adminService.deleteUser(req.params.id);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

export async function reactivateUser(req, res) {
  const result = await adminService.reactivateUser(req.params.id);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

export async function getLogs(_, res) {
  return res.send({ logs: requestLog.toArray() });
}
