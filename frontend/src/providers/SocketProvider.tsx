import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import AccountsRealtimeSync from "./AccountsRealtimeSync";
import AccountsPrefetcher from "./AccountsPrefetcher";

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
      {/* Global accounts cache invalidator — active regardless of which page is
          mounted, so a save on any page instantly makes every other accounts
          page's cache stale. Next visit fetches fresh data with no flicker. */}
      <AccountsRealtimeSync />
      {/* One-shot cache warmer for every accounts list/report page. Fires
          after login so navigating to any /accounts route is a cache HIT. */}
      <AccountsPrefetcher />
      {children}
    </SocketContext.Provider>
  );
};
