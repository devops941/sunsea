import { Request, Response } from "express";
import * as roleService from "./role.service";

export const createRole = async (
  req: Request,
  res: Response
) => {
  const role = await roleService.createRole(
    req.body
  );

  return res.status(201).json({
    success: true,
    message: "Role created successfully",
    data: role,
  });
};

export const getAllRoles = async (
  _req: Request,
  res: Response
) => {
  const roles =
    await roleService.getAllRoles();

  return res.status(200).json({
    success: true,
    data: roles,
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

  const role =
    await roleService.updateRole(
      roleId,
      req.body
    );

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

  await roleService.deleteRole(
    roleId
  );

  return res.status(200).json({
    success: true,
    message: "Role deleted successfully",
  });
};      