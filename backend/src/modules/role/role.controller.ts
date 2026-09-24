import { Request, Response } from "express";
import * as roleService from "./role.service";
import { getIO } from "../../socket/socket";

export const createRole = async (
  req: Request,
  res: Response
) => {
  const userId = (req as any).user?.userId || ((req as any).user?.id ? `admin_${(req as any).user.id}` : ((req as any).admin?.id ? `admin_${(req as any).admin.id}` : undefined));
  const role = await roleService.createRole({
    ...req.body,
    userId,
  });
  getIO().emit("role:created", role);

  return res.status(201).json({
    success: true,
    message: "Role created successfully",
    data: role,
  });
};

export const getAllRoles = async (
  req: Request,
  res: Response
) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const search = req.query.search ? String(req.query.search) : undefined;
  const sortBy = req.query.sortBy ? String(req.query.sortBy) : undefined;
  const sortOrder = req.query.sortOrder === "asc" || req.query.sortOrder === "desc" ? (req.query.sortOrder as "asc" | "desc") : undefined;

  const { roles, total } = await roleService.getAllRoles(page, limit, search, sortBy, sortOrder);

  return res.status(200).json({
    success: true,
    data: roles,
    meta: {
      total,
      page: page || 1,
      limit: limit || total,
    }
  });
};

export const getRoleById = async (
  req: Request,
  res: Response
) => {
  const roleId = Number(
    String(req.params.id)
  );

  const role =
    await roleService.getRoleById(
      roleId
    );

  return res.status(200).json({
    success: true,
    data: role,
  });
};

export const updateRole = async (
  req: Request,
  res: Response
) => {
  const roleId = Number(
    String(req.params.id)
  );
  const userId = (req as any).user?.userId || ((req as any).user?.id ? `admin_${(req as any).user.id}` : ((req as any).admin?.id ? `admin_${(req as any).admin.id}` : undefined));

  const role =
    await roleService.updateRole(
      roleId,
      {
        ...req.body,
        userId,
      }
    );
  getIO().emit("role:updated", role);

  return res.status(200).json({
    success: true,
    message: "Role updated successfully",
    data: role,
  });
};

export const deleteRole = async (
  req: Request,
  res: Response
) => {
  const roleId = Number(
    String(req.params.id)
  );
  const userId = (req as any).user?.userId || ((req as any).user?.id ? `admin_${(req as any).user.id}` : ((req as any).admin?.id ? `admin_${(req as any).admin.id}` : undefined));

  await roleService.deleteRole(
    roleId,
    userId
  );
  getIO().emit("role:deleted", { id: roleId });

  return res.status(200).json({
    success: true,
    message: "Role deleted successfully",
  });
};      