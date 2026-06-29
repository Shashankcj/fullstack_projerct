import React, { useState, useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useWebSocket } from '../../../Contexts/WebSocketContext';
import backendApi from '../../../api/backendAxiosInstance';
import PageWrapper from '../../../components/Utilities/PageWrapper';
import DeviceSummaryCard from '../Device/Dashboard/DeviceSummaryCard';

const DeviceLayout = ({isDarkMode}) => {
  const { agentId } = useParams();
  const { sendMessage, isWSSConnected } = useWebSocket();
  const [entityInfo, setEntityInfo] = useState(null);

  useEffect(() => {
    let isMounted = true;

    backendApi
      .get(`/devices/${agentId}/details/`)
      .then((response) => {
        if (isMounted) setEntityInfo(response.data);
      })
      .catch((error) => {
        console.error('Error fetching device info:', error);
      });

    if (isWSSConnected) {
      sendMessage({ type: 'WATCH_AGENT', agent_uuid: agentId });
    }

    return () => {
      isMounted = false;
      if (isWSSConnected) {
        sendMessage({ event_type: 'UNWATCH_AGENT', agent_uuid: agentId });
      }
    };
  }, [agentId, sendMessage, isWSSConnected]);

  const handleRefresh = async () => {
    const response = await backendApi.get(`/devices/${agentId}/details/`);
    setEntityInfo(response.data);
    return response.data;
  };

  return (
    <PageWrapper isDarkMode={isDarkMode}>
  <div
  className="sticky top-[6.7rem] z-30"
  style={{
    backgroundColor: isDarkMode
      ? 'rgba(17, 24, 39, 0.72)'
      : 'rgba(240,244,255,0.72)'
  }}
>
  <div className="max-w-8xl mx-auto">
    <DeviceSummaryCard
      isDarkMode={isDarkMode}
      device={entityInfo}
      onRefresh={handleRefresh}
    />
  </div>
</div>

      <div className="max-w-8xl mx-auto mt-2">
        <Outlet context={{ agentId, entityInfo, isDarkMode, handleRefresh }} />
      </div>
    </PageWrapper>
  );
};

export default DeviceLayout;



