import { Request, Response } from "express";

import * as rolePermissionService from "./role-permission.service";

export const assignPermissions = async (
  req: Request,
  res: Response
) => {
  const {
    roleId,
    permissionIds,
  } = req.body;

  await rolePermissionService.assignPermissionsToRole(
    Number(String(roleId)),
    permissionIds.map(
      (id: string | number) =>
        Number(String(id))
    )
  );

  return res.status(200).json({
    success: true,
    message:
      "Permissions assigned successfully",
  });
};

export const getRolePermissions = async (
  req: Request,
  res: Response
) => {
  const roleId = Number(
    String(req.params.roleId)
  );

  const role =
    await rolePermissionService.getRolePermissions(
      roleId
    );

  return res.status(200).json({
    success: true,
    data: role,
  });
};

export const removePermission = async (
  req: Request,
  res: Response
) => {
  const {
    roleId,
    permissionId,
  } = req.body;

  await rolePermissionService.removePermissionFromRole(
    Number(String(roleId)),
    Number(String(permissionId))
  );

  return res.status(200).json({
    success: true,
    message:
      "Permission removed successfully",
  });
};