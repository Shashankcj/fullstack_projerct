import {Chart} from '../../../../components/device/deviceCharts';
import { MonHeaderCard } from '../../../../components/device/utils';
import { useOutletContext } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { fetchComponentUUIDs } from './utils';
import { CHART_DP_SIZES } from '../../../../constants/constants';


export const DiskMonitoring = (props) => {
    const isDarkMode = props.isDarkMode;
    const [diskUUIDs, setDiskUUIDs] = useState([]);
    const { agentId } = useOutletContext();

    useEffect(() => fetchComponentUUIDs(agentId, 'storage', setDiskUUIDs), [agentId]);

    return (
        <div className="space-y-3">
            <MonHeaderCard isDarkMode={isDarkMode} componentUUIDs={diskUUIDs} ip_address="192.168.1.1" os="Linux" os_version="5.4.0"  /> 
            <div className="grid grid-cols-1 gap-6">
                <Chart isDarkMode={isDarkMode} chartTitle="Disk Utilization" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Disk Utilization" mon_type="disk_usage_percent" chartSize={CHART_DP_SIZES.FW} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <Chart isDarkMode={isDarkMode} chartTitle="Disk Size" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Disk Size" mon_type="total_disk_size" chartSize={CHART_DP_SIZES.SMALL}/>
                
                
                <Chart isDarkMode={isDarkMode} chartTitle="Disk Usage" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Disk Usage" mon_type="total_disk_usage" chartSize={CHART_DP_SIZES.SMALL}/>
            
            
                <Chart isDarkMode={isDarkMode} chartTitle="Unallocated Disk Space" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Unallocated Disk Space" mon_type="unallocated_disk_space" chartSize={CHART_DP_SIZES.SMALL}/>
            
        
                <Chart isDarkMode={isDarkMode} chartTitle="Allocated Disk Space" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Allocated Disk Space" mon_type="allocated_disk_space" chartSize={CHART_DP_SIZES.SMALL}/>
            
            </div>
        </div>
    );

}

export default DiskMonitoring;