import * as adminService from '../services/adminService.js';

export async function getUsers(req, res) {
  const result = await adminService.listUsers(req.query);
  return res.send(result);
}

export async function banUser(req, res) {
  const { reason, bannedUntil, banIp, banDevice } = req.body;
  const result = await adminService.toggleBan(req.params.id, true, reason, bannedUntil, banIp, banDevice, req.userId);
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

export async function getStats(_, res) {
  const result = await adminService.getStats();
  return res.send(result);
}

export async function getBannedIps(_, res) {
  const result = await adminService.listBannedIps();
  return res.send(result);
}

export async function blockIp(req, res) {
  const { ip, reason } = req.body;
  const result = await adminService.blockIp(ip, reason, req.userId);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

export async function unblockIp(req, res) {
  const result = await adminService.unblockIp(req.params.id);
  return res.send(result);
}

export async function getAuditLogs(req, res) {
  const result = await adminService.listAdminLogs(req.query);
  return res.send(result);
}


export async function getBannedDevices(_, res) {
  const result = await adminService.listBannedDevices();
  return res.send(result);
}

export async function blockDevice(req, res) {
  const { deviceId, reason } = req.body;
  const result = await adminService.blockDevice(deviceId, reason, req.userId);
  if (result.error) return res.code(result.status).send({ error: result.error });
  return res.send(result);
}

export async function unblockDevice(req, res) {
  const result = await adminService.unblockDevice(req.params.id);
  return res.send(result);
}
