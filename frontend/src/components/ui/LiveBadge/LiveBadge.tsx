import React, { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../../../providers/SocketProvider';

export interface LiveBadgeProps {
  /** Explicit override for live status. If omitted, uses real-time socket + network connectivity */
  isLive?: boolean;
  /** Custom label when live (defaults to "LIVE") */
  liveLabel?: string;
  /** Custom label when offline/disconnected (defaults to "OFFLINE") */
  offlineLabel?: string;
  /** Custom static label regardless of state */
  label?: string;
  /** Whether to show the text label alongside the blinking dot (default: true) */
  showLabel?: boolean;
  /** Size of the badge */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Optional click handler if using as an interactive button */
  onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLDivElement>) => void;
  /** Custom tooltip / title */
  tooltip?: string;
  /** Extra CSS classes */
  className?: string;
  /** Whether to render as an interactive button element */
  asButton?: boolean;
  /** Whether to pulse the dot when live (default: true) */
  pulse?: boolean;
}

export const LiveBadge: React.FC<LiveBadgeProps> = ({
  isLive: isLiveProp,
  liveLabel = 'LIVE',
  offlineLabel = 'OFFLINE',
  label,
  showLabel = true,
  size = 'sm',
  onClick,
  tooltip,
  className = '',
  asButton = false,
  pulse = true,
}) => {
  // Safe socket context retrieval
  const socketContext = useSocket();
  const socket = socketContext?.socket;
  const isContextConnected = socketContext?.isConnected ?? false;

  // Local connection state synchronized in real-time
  const [socketConnected, setSocketConnected] = useState<boolean>(
    Boolean(socket?.connected || isContextConnected)
  );

  // Network online state
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Sync with socketContext changes
  useEffect(() => {
    setSocketConnected(Boolean(socket?.connected || isContextConnected));
  }, [isContextConnected, socket?.connected]);

  // Real-time event listeners for socket and network without page reload
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSocketConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Direct socket event listeners for instant reactive state update
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    const onConnectError = () => setSocketConnected(false);

    if (socket) {
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      socket.on('reconnect', onConnect);
      socket.on('reconnect_attempt', onDisconnect);
      socket.on('reconnect_failed', onDisconnect);
      socket.on('reconnect_error', onDisconnect);
    }

    // Periodic heartbeat sync (every 3 seconds) to ensure state matches actual status
    const intervalId = setInterval(() => {
      const currentOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setIsOnline(currentOnline);
      if (socket) {
        setSocketConnected(Boolean(socket.connected && currentOnline));
      }
    }, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);

      if (socket) {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('connect_error', onConnectError);
        socket.off('reconnect', onConnect);
        socket.off('reconnect_attempt', onDisconnect);
        socket.off('reconnect_failed', onDisconnect);
        socket.off('reconnect_error', onDisconnect);
      }
    };
  }, [socket]);

  // Compute live state: prop override has highest priority, otherwise network + socket
  const activeLive = isLiveProp !== undefined 
    ? isLiveProp 
    : (isOnline && (socket ? socketConnected : true));

  // Size mappings
  const sizeStyles = {
    xs: {
      container: 'px-2 py-0.5 text-[10px] gap-1.5',
      dot: 'h-1.5 w-1.5',
    },
    sm: {
      container: 'px-2.5 py-1 text-xs gap-1.5',
      dot: 'h-2 w-2',
    },
    md: {
      container: 'px-3 py-1.5 text-xs gap-2',
      dot: 'h-2.5 w-2.5',
    },
    lg: {
      container: 'px-4 py-2 text-sm gap-2.5',
      dot: 'h-3 w-3',
    },
  }[size];

  const currentText = label || (activeLive ? liveLabel : offlineLabel);
  const defaultTitle = tooltip || (
    activeLive 
      ? 'System Status: LIVE (Connected to Realtime Server)' 
      : (!isOnline ? 'System Status: OFFLINE (No Internet Connection)' : 'System Status: OFFLINE (Reconnecting to Server...)')
  );

  const stateStyles = activeLive
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 hover:border-emerald-500/50 shadow-emerald-500/10'
    : 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25 hover:border-rose-500/50 shadow-rose-500/10';

  const isInteractive = Boolean(onClick || asButton);
  const Component = isInteractive ? 'button' : 'div';

  return (
    <Component
      type={isInteractive ? 'button' : undefined}
      onClick={onClick}
      title={defaultTitle}
      className={`inline-flex items-center justify-center font-semibold rounded-full border transition-all duration-300 select-none shadow-xs ${
        isInteractive ? 'cursor-pointer active:scale-95' : 'cursor-default'
      } ${sizeStyles.container} ${stateStyles} ${className}`}
      aria-label={defaultTitle}
    >
      {/* Real-time Blinking / Pulsing Dot */}
      <span className={`relative flex shrink-0 ${sizeStyles.dot}`}>
        {activeLive && pulse && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-full w-full transition-colors duration-300 ${
            activeLive 
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' 
              : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
          }`}
        />
      </span>

      {/* Label Text */}
      {showLabel && (
        <span className="tracking-wider uppercase font-bold text-[11px] leading-none transition-colors duration-300">
          {currentText}
        </span>
      )}
    </Component>
  );
};

export default LiveBadge;
