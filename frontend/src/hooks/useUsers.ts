import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchUsers, createUser, toggleUserStatus } from "../features/user/userSlice";
import type { CreateUserDto } from "../features/user/types";

export const useUsers = () => {
  const dispatch = useAppDispatch();
  const { users, loading, error } = useAppSelector((state) => state.users);

  const loadUsers = useCallback(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  const addUser = useCallback(
    async (data: CreateUserDto) => {
      return await dispatch(createUser(data)).unwrap();
    },
    [dispatch]
  );

  const changeUserStatus = useCallback(
    async (id: string, isActive: boolean) => {
      return await dispatch(toggleUserStatus({ id, isActive })).unwrap();
    },
    [dispatch]
  );

  return {
    users,
    loading,
    error,
    loadUsers,
    addUser,
    changeUserStatus,
  };
};
