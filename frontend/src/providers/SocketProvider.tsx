import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Get base URL without /api path (e.g. http://localhost:5000)
    const baseUrl = import.meta.env.VITE_IMAGE_URL || import.meta.env.VITE_API_URL?.replace('/api', '') || "http://localhost:5000";

    // Initialize Socket.io connection
    const socketInstance = io(baseUrl, {
      extraHeaders: {
        "Bypass-Tunnel-Reminder": "true", // Bypasses localtunnel warning page
        "ngrok-skip-browser-warning": "true", // Bypasses ngrok warning page
      }
    });

    socketInstance.on("connect", () => {
      console.log("🟢 Socket connected:", socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      console.log("🔴 Socket disconnected");
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
