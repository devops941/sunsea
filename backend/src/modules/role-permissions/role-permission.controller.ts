import { Request, Response } from "express";
import { getIO } from "../../socket/socket";
import * as rolePermissionService from "./role-permission.service";

export const assignPermissions = async (
  req: Request,
  res: Response
) => {
  const {
    roleId,
    permissionIds,
  } = req.body;

  const userId = (req as any).user?.userId || ((req as any).user?.id ? `admin_${(req as any).user.id}` : ((req as any).admin?.id ? `admin_${(req as any).admin.id}` : undefined));

  await rolePermissionService.assignPermissionsToRole(
    Number(String(roleId)),
    permissionIds.map(
      (id: string | number) =>
        Number(String(id))
    ),
    userId
  );

  try {
    getIO().emit("rolePermission:updated", { roleId: Number(String(roleId)) });
  } catch (e) {
    console.error("Socket emit failed:", e);
  }

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

  const userId = (req as any).user?.userId || ((req as any).user?.id ? `admin_${(req as any).user.id}` : ((req as any).admin?.id ? `admin_${(req as any).admin.id}` : undefined));

  await rolePermissionService.removePermissionFromRole(
    Number(String(roleId)),
    Number(String(permissionId)),
    userId
  );

  try {
    getIO().emit("rolePermission:updated", { roleId: Number(String(roleId)) });
  } catch (e) {
    console.error("Socket emit failed:", e);
  }

  return res.status(200).json({
    success: true,
    message:
      "Permission removed successfully",
  });
};