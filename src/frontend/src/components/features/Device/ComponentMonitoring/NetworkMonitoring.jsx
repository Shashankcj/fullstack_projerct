import {Chart} from '../../../../components/device/deviceCharts';
import { MonHeaderCard } from '../../../../components/device/utils';
import { useOutletContext } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { fetchComponentUUIDs } from './utils';
import { CHART_DP_SIZES } from '../../../../constants/constants';

export const NetworkMonitoring = (props) => {
    const isDarkMode = props.isDarkMode;
    const [portUUIDs, setPortUUIDs] = useState([]);
    const { agentId } = useOutletContext();
    
    useEffect(() => fetchComponentUUIDs(agentId, 'port', setPortUUIDs), [agentId]);
    
    return (
      
        <div className="space-y-3">
            <MonHeaderCard ip_address="192.168.1.1" os="Linux" os_version="5.4.0" isDarkMode={isDarkMode} componentUUIDs={portUUIDs} /> 
            <div className="grid grid-cols-1 gap-6">
                <Chart isDarkMode={isDarkMode} chartTitle="Port Utilization (Bandwidth)" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Network Utilization" mon_type="network_utilization"  chartSize={CHART_DP_SIZES.FW} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Chart isDarkMode={isDarkMode} chartTitle="Data Received" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Bytes Received" mon_type="bytes_received" chartSize={CHART_DP_SIZES.SMALL} />
                <Chart isDarkMode={isDarkMode} chartTitle="Data Sent" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Bytes Sent" mon_type="bytes_sent" chartSize={CHART_DP_SIZES.SMALL} />
                <Chart isDarkMode={isDarkMode} chartTitle="Packets Received" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Packets Received" mon_type="packets_received" chartSize={CHART_DP_SIZES.SMALL} />
                <Chart isDarkMode={isDarkMode} chartTitle="Packets Sent" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Packets Sent" mon_type="packets_sent" chartSize={CHART_DP_SIZES.SMALL} />
                <Chart isDarkMode={isDarkMode} chartTitle="Drop In" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Drop In" mon_type="drop_in" chartSize={CHART_DP_SIZES.SMALL} />
                <Chart isDarkMode={isDarkMode} chartTitle="Drop Out" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Drop Out" mon_type="drop_out" chartSize={CHART_DP_SIZES.SMALL} />
                <Chart isDarkMode={isDarkMode} chartTitle="Error In" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Error In" mon_type="error_in" chartSize={CHART_DP_SIZES.SMALL} />
                <Chart isDarkMode={isDarkMode} chartTitle="Error Out" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Error Out" mon_type="error_out" chartSize={CHART_DP_SIZES.SMALL} />
            </div>

        </div>
      
    );

}

export default NetworkMonitoring;