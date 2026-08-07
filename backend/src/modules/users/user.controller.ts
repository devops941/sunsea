import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";

import { userService } from "./user.service";

export const getProfile = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {

    const userId = req.user?.userId as string;

    const user =
      await userService.getProfile(
        userId
      );

    res.status(200).json(
      new ApiResponse(
        "Profile fetched successfully",
        user
      )
    );
    return;
  }
);

export const createUser = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {

    const user =
      await userService.create(
        req.body
      );

    res.status(201).json(
      new ApiResponse(
        "User created successfully",
        user
      )
    );

    return;
  }
);


export const updateProfile = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {

    const userId = req.user?.userId as string;

    const user =
      await userService.updateProfile(
        userId,
        req.body
      );

    res.status(200).json(
      new ApiResponse(
        "Profile updated successfully",
        user
      )
    );
    return;
  }
);

export const getAllUsers = asyncHandler(
  async (
    _req: Request,
    res: Response
  ) => {

    const users =
      await userService.getAllUsers();

    res.status(200).json(
      new ApiResponse(
        "Users fetched successfully",
        users
      )
    );
    return;
  }
);

export const getUserById = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {

    const id = String(req.params.id);

    const user =
      await userService.getUserById(
        id
      );
    res.status(200).json(
      new ApiResponse(
        "User fetched successfully",
        user
      )
    );
    return;
  }
);

export const updateUserStatus = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {

    const id = String(req.params.id);

    const { isActive } = req.body;

    const user =
      await userService.updateUserStatus(
        id,
        isActive
      );

    res.status(200).json(
      new ApiResponse(
        "User status updated successfully",
        user
      )
    );
    return;
  }
);

export const checkUsername = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {
    const username = String(req.params.username);

    const result =
      await userService.checkUsernameAvailable(
        username
      );

    res.status(200).json(
      new ApiResponse(
        result.available
          ? "Username is available"
          : "Username is already taken",
        result
      )
    );
    return;
  }
);