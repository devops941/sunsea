import React from "react";
import { useSocket } from "../providers/SocketProvider";
import { useAppDispatch } from "./reduxHooks";

interface SocketActions<T> {
  created?: (payload: T) => any;
  updated?: (payload: T) => any;
  deleted?: (payload: any) => any;
}

export const useSocketSync = <T,>(moduleName: string, actions: SocketActions<T>) => {
  const dispatch = useAppDispatch();
  const { socket } = useSocket();

  React.useEffect(() => {
    if (!socket) return;

    const handleCreated = (payload: T) => {
      if (actions.created) dispatch(actions.created(payload));
    };

    const handleUpdated = (payload: T) => {
      if (actions.updated) dispatch(actions.updated(payload));
    };

    const handleDeleted = (payload: any) => {
      // payload might be { id: number } or just the id depending on the backend
      const id = payload?.id !== undefined ? payload.id : payload;
      if (actions.deleted) dispatch(actions.deleted(id));
    };

    socket.on(`${moduleName}:created`, handleCreated);
    socket.on(`${moduleName}:updated`, handleUpdated);
    socket.on(`${moduleName}:deleted`, handleDeleted);

    return () => {
      socket.off(`${moduleName}:created`, handleCreated);
      socket.off(`${moduleName}:updated`, handleUpdated);
      socket.off(`${moduleName}:deleted`, handleDeleted);
    };
  // We stringify the function references or omit them to prevent infinite loops if they aren't wrapped in useCallback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, dispatch, moduleName]);
};
