import React, { useState, useEffect } from 'react';
import { Outlet, useParams, NavLink } from 'react-router-dom';
import { useWebSocket } from '../../../../Contexts/WebSocketContext';
import backendApi from '../../../../api/backendAxiosInstance';


const IPMonitorLayout = () => {
    const { ipMonitorUUID } = useParams();
    const { sendMessage, isWSSConnected } = useWebSocket();
    const [entityInfo, setEntityInfo] = useState(null);

    console.log('IPMonitorLayout ipMonitorUUID:', ipMonitorUUID);

    useEffect(() => {
        // You can add any side effects related to deviceId change here
        console.log('Fetching IP Monitor info for UUID:', ipMonitorUUID);
        backendApi.get(`/ip-monitoring/${ipMonitorUUID}/details/`)
            .then(response => {
                setEntityInfo(response.data);
            })
            .catch(error => {
                console.error('Error fetching device info:', error);
            });
        
        if (isWSSConnected) {
            sendMessage({ type: 'WATCH_IP', agent_uuid: ipMonitorUUID });
        }

        return () => {
            if (isWSSConnected) {
                sendMessage({ event_type: 'UNWATCH_IP', agent_uuid: ipMonitorUUID });
            }
            
        };

    }, [ipMonitorUUID, sendMessage, isWSSConnected]);

    return (
        <div className="content">
                <Outlet context={{ ipMonitorUUID, entityInfo }} /> 
        </div>
    );
}

export default IPMonitorLayout;