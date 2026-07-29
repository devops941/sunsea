import React from "react";
import { useSocket } from "../providers/SocketProvider";
import { useAppDispatch } from "./reduxHooks";

interface SocketActions<T> {
  created?: (payload: T) => any;
  updated?: (payload: T) => any;
  deleted?: (payload: any) => any;
}

export const useSocketSync = <T,>(
  moduleName: string, 
  actions?: SocketActions<T>,
  onAnyEvent?: () => void
) => {
  const dispatch = useAppDispatch();
  const { socket } = useSocket();

  const actionsRef = React.useRef(actions);
  const onAnyEventRef = React.useRef(onAnyEvent);

  React.useEffect(() => {
    actionsRef.current = actions;
    onAnyEventRef.current = onAnyEvent;
  }, [actions, onAnyEvent]);

  React.useEffect(() => {
    if (!socket) return;

    const handleCreated = (payload: T) => {
      if (actionsRef.current?.created) dispatch(actionsRef.current.created(payload));
      if (onAnyEventRef.current) onAnyEventRef.current();
    };

    const handleUpdated = (payload: T) => {
      if (actionsRef.current?.updated) dispatch(actionsRef.current.updated(payload));
      if (onAnyEventRef.current) onAnyEventRef.current();
    };

    const handleDeleted = (payload: any) => {
      const id = payload?.id !== undefined ? payload.id : payload;
      if (actionsRef.current?.deleted) dispatch(actionsRef.current.deleted(id));
      if (onAnyEventRef.current) onAnyEventRef.current();
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
