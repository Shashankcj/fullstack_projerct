import {Chart} from '../../../../components/device/deviceCharts';
import { MonHeaderCard } from '../../../../components/device/utils';
import { useOutletContext } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { fetchComponentUUIDs } from './utils';
import { CHART_DP_SIZES } from '../../../../constants/constants';

export const PartitionMonitoring = (props) => {
    const isDarkMode = props.isDarkMode;
    const [partitionUUIDs, setPartitionUUIDs] = useState([]);
    const { agentId } = useOutletContext();

    useEffect(() => fetchComponentUUIDs(agentId, 'partition', setPartitionUUIDs), [agentId]);

    return (
           
        <div className="space-y-3">
            <MonHeaderCard componentUUIDs={partitionUUIDs} ip_address="192.168.1.1" os="Linux" os_version="5.4.0" isDarkMode={isDarkMode} /> 
            <div className="grid grid-cols-1 gap-6">
                <Chart isDarkMode={isDarkMode} chartTitle="Partition Utilization" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Partition Utilization" mon_type="used_space_perc" chartSize={CHART_DP_SIZES.FW}/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                    <Chart isDarkMode={isDarkMode} chartTitle="Partition Used Space" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Partition Used Space" mon_type="used_space" chartSize={CHART_DP_SIZES.SMALL}/>
                    <Chart isDarkMode={isDarkMode} chartTitle="Partition Free Space" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Partition Free Space" mon_type="free_space" chartSize={CHART_DP_SIZES.SMALL}/>
                
            </div>
        </div>
       
    );

}

export default PartitionMonitoring;