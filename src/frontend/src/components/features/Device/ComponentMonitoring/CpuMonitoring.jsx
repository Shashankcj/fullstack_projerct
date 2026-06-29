import {Chart} from '../../../../components/device/deviceCharts';
import { MonHeaderCard } from '../../../../components/device/utils';
import { CHART_DP_SIZES } from '../../../../constants/constants';
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { fetchComponentUUIDs } from './utils';

const CPUMonitoring = (props) => {
    const isDarkMode = props.isDarkMode; 

    const { agentId } = useOutletContext();

    const [cpuUUIDs, setCpuUUIDs] = useState([]);
    
    

    useEffect(() => fetchComponentUUIDs(agentId, 'CPU', setCpuUUIDs), [agentId]);



    const FW_CHART_SIZE = 20;
    const SMALL_CHART_SIZE = 10;

    return (
        <div className="space-y-3">
            <MonHeaderCard ip_address="192.168.1.1" os="Linux" os_version="5.4.0" isDarkMode={isDarkMode} componentUUIDs={cpuUUIDs}/> 
            <div className="grid grid-cols-1 gap-6">
                
                    <Chart 
                        chartTitle="CPU Utilization"
                        seriesCount={1} 
                        xAxisKey="timestamp" 
                        yAxisLabel="CPU Utilization" 
                        mon_type="cpu_utilization" 
                        chartSize={CHART_DP_SIZES.FW} 
                        isDarkMode={isDarkMode} 
                    />
               
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <Chart isDarkMode={isDarkMode} chartTitle="CTX Switches" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Context Switches" mon_type="ctx_switches" chartSize={CHART_DP_SIZES.SMALL} />
            
                <Chart isDarkMode={isDarkMode} chartTitle="Hardware IRQs" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Hardware IRQs" mon_type="hw_irq" chartSize={CHART_DP_SIZES.SMALL} />
            
                <Chart isDarkMode={isDarkMode} chartTitle="Software IRQs" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Software IRQs" mon_type="sw_irq" chartSize={CHART_DP_SIZES.SMALL} />
            
                <Chart isDarkMode={isDarkMode} chartTitle="System Calls" seriesCount={1} xAxisKey="timestamp" yAxisLabel="System Calls" mon_type="syscalls" chartSize={CHART_DP_SIZES.SMALL} />
            
            </div>
        </div>
    );
}

export default CPUMonitoring;