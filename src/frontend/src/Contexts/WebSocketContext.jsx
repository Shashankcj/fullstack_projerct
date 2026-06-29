
import { createContext, useEffect, useState, useRef, useCallback, useContext } from 'react';
import { useDispatch } from 'react-redux';
import { apiSlice }      from '../redux/apiSlice';
import { portFlagApi }   from '../redux/networkFlagApi';
import { storageFlagApi } from '../redux/storageFlagApi';
import { useAuth } from './AuthContext';
import {
  cpuMonDataTransformer,
  memoryMonDataTransformer,
  networkMonDataTransformer,
  diskMonDataTransformer,
  partitionMonDataTransformer,
  ipMonDataTransformer,
} from '../components/features/Device/monDataTransformers';
import { addAlert } from '../redux/notificationSlice';


/* ================= MODULE-LEVEL CONSTANTS ================= */

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL     = 3000;   // ms base delay
const PING_INTERVAL          = 30000;  // ms
const WEBSOCKET_URL          = `wss://${window.location.host}/api/v1/wss/webapp/`;

const DATA_TRANSFORMERS = {
  cpu_monitoring:       cpuMonDataTransformer,
  memory_monitoring:    memoryMonDataTransformer,
  network_monitoring:   networkMonDataTransformer,
  disk_monitoring:      diskMonDataTransformer,
  partition_monitoring: partitionMonDataTransformer,
  ip_monitoring:        ipMonDataTransformer,
};


/* ================= CONTEXT ================= */

export const WebSocketContext = createContext(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === null) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};


/* ================= PROVIDER ================= */

export const WebSocketProvider = ({ children }) => {
  const { authenticated } = useAuth();
  const dispatch = useDispatch();

  const [socket,            setSocket]            = useState(null);
  const [monitoringData,    setMonitoringData]    = useState(null);
  const [connectionStatus,  setConnectionStatus]  = useState('CONNECTING');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isWSSConnected,    setIsWSSConnected]    = useState(false);

  const socketRef             = useRef(null);
  const reconnectTimeoutRef   = useRef(null);
  const pingIntervalRef       = useRef(null);
  const subscribers           = useRef({});
  const reconnectAttemptsRef  = useRef(0);
  const isConnectingRef       = useRef(false);


  /* -------------------- TIMER UTILS -------------------- */

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const setupPing = useCallback((ws) => {
    clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, PING_INTERVAL);
  }, []);


  /* -------------------- SUBSCRIBER API -------------------- */

  const agentSubscribe = useCallback((agent_uuid, mon_type, callback, component = null) => {
    if (!subscribers.current[agent_uuid]) {
      subscribers.current[agent_uuid] = {};
    }
    const key = component == null ? mon_type : `${mon_type}_${component}`;
    subscribers.current[agent_uuid][key] = callback;

    return () => {
      if (subscribers.current[agent_uuid]) {
        delete subscribers.current[agent_uuid][key];
        if (Object.keys(subscribers.current[agent_uuid]).length === 0) {
          delete subscribers.current[agent_uuid];
        }
      }
    };
  }, []);


  /* -------------------- MONITORING DATA HANDLER -------------------- */

  const handleMonitoringData = useCallback((data) => {
    const { agent_uuid, timestamp } = data.data;
    const mon_data = data.data;

    Object.keys(mon_data).forEach((key) => {
      if (DATA_TRANSFORMERS[key]) {
        const transformedData = DATA_TRANSFORMERS[key]({ timestamp, data: mon_data[key] });
        Object.keys(transformedData).forEach((tfd_key) => {
          if (
            subscribers.current[agent_uuid] &&
            subscribers.current[agent_uuid][tfd_key]
          ) {
            subscribers.current[agent_uuid][tfd_key](transformedData[tfd_key]);
          }
        });
      }
    });
  }, []);


  /* -------------------- CONNECT -------------------- */

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    try {
      setConnectionStatus('CONNECTING');
      const ws = new WebSocket(WEBSOCKET_URL);
      socketRef.current = ws;

      ws.onopen = () => {
        setSocket(ws);
        setConnectionStatus('OPEN');
        setIsWSSConnected(true);
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
        setupPing(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'pong') return;

          if (data.type === 'alert_created') {
            const payload = data.data;

            if (payload.is_read === true) return;

            const alert = {
              ...payload,
              id:          payload.uuid,
              device_uuid: payload.object_id,
              device_name: payload.device_name || 'Unknown Device',
              is_read:     payload.is_read     ?? false,
              message:     payload.message     || payload.alert_type || 'Alert',
            };
            dispatch(addAlert(alert));
            return;
          }

          if (data.type === 'agent_update' && data.agent?.device?.uuid) {
            dispatch(apiSlice.util.invalidateTags([
              'Devices',
              { type: 'Devices', id: data.agent.device.uuid },
            ]));
            return;
          }

          if (data.type === 'data_deleted' && data.agent_uuid) {
            dispatch(apiSlice.util.invalidateTags([
              'Devices',
              { type: 'Devices', id: data.agent_uuid },
            ]));
            return;
          }

          if (data.type === 'flagged_entity_update') {
            const entity = data.data?.entity_type;
            if (entity === 'port') {
              dispatch(portFlagApi.util.invalidateTags(['FlaggedPort']));
            } else if (entity === 'storage') {
              dispatch(storageFlagApi.util.invalidateTags(['FlaggedStorage']));
            }
            return;
          }
          if (data.type === 'MON_DATA') {
            handleMonitoringData(data);
            setMonitoringData(data);
            return;
          }

        } catch (err) {
          console.error('[WebSocket] Parse error:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[WebSocket] Connection error:', err);
        setConnectionStatus('ERROR');
        setIsWSSConnected(false);
      };

      ws.onclose = (event) => {
        setConnectionStatus('CLOSED');
        setIsWSSConnected(false);
        setSocket(null);
        clearTimers();

        if (
          event.code !== 1000 &&
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
        ) {
          const delay = RECONNECT_INTERVAL * Math.pow(2, reconnectAttemptsRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            setReconnectAttempts(reconnectAttemptsRef.current);
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          console.error('[WebSocket] Max reconnection attempts reached');
          setConnectionStatus('ERROR');
        }
      };

    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      setConnectionStatus('ERROR');
    }
  }, [dispatch, setupPing, clearTimers, handleMonitoringData]);


  /* -------------------- RECONNECT -------------------- */

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    if (socketRef.current) socketRef.current.close();
    connect();
  }, [connect]);


  /* -------------------- SEND MESSAGE -------------------- */

  const sendMessage = useCallback((message) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);


  /* -------------------- EFFECTS -------------------- */

  useEffect(() => {
    if (!authenticated || isConnectingRef.current) return;
    isConnectingRef.current = true;
    connect();

    return () => {
      isConnectingRef.current = false;
      clearTimers();
      if (socketRef.current) {
        socketRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [authenticated]); 

  // Visibility + network event listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && connectionStatus === 'CLOSED') {
        reconnect();
      }
    };
    const handleOnline = () => {
      if (connectionStatus === 'CLOSED' || connectionStatus === 'ERROR') {
        reconnect();
      }
    };
    const handleOffline = () => {
      setConnectionStatus('ERROR');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connectionStatus, reconnect]);


  /* -------------------- CONTEXT VALUE -------------------- */

  const contextValue = {
    socket,
    monitoringData,
    connectionStatus,
    reconnectAttempts,
    reconnect,
    sendMessage,
    isConnected:  connectionStatus === 'OPEN',
    isConnecting: connectionStatus === 'CONNECTING',
    hasError:     connectionStatus === 'ERROR',
    isWSSConnected,
    agentSubscribe,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};