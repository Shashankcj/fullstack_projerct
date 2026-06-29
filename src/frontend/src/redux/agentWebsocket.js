
import { apiSlice } from './apiSlice';

let socket;

export const agentWebSocket = (dispatch) => {
  if (socket) return; 

  socket = new WebSocket('wss://192.168.100.11/webapp/api/agent/');

  socket.onopen = () => {
    // console.log('WebSocket connected');
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // console.log('WebSocket message received:', data);
    
    if (data.type === 'agent_update') {
      const updatedAgent = data.agent;

      dispatch(
        apiSlice.util.updateQueryData('getDevicesdata', undefined, (draft) => {
          const index = draft.device.findIndex(d => d.uuid === updatedAgent.uuid);
          if (index >= 0) {
            draft.device[index] = updatedAgent;
          } else {
            draft.device.push(updatedAgent);
          }
        })
      );
    }
  };

  socket.onclose = () => {
    // console.warn('WebSocket disconnected');
    socket = null;
  };
};
