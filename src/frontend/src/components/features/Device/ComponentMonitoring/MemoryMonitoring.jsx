import {Chart} from '../../../../components/device/deviceCharts';
import { MonHeaderCard } from '../../../../components/device/utils';
import { CHART_DP_SIZES } from '../../../../constants/constants';

export const MemoryMonitoring = (props) => {
    const isDarkMode = props.isDarkMode;

    return (
        
        <div className="space-y-3">
            <MonHeaderCard ip_address="192.168.1.1" os="Linux" os_version="5.4.0" isDarkMode={isDarkMode} /> 
            <div className="grid grid-cols-1 gap-6">
                <Chart isDarkMode={isDarkMode} chartTitle="Memory Utilization" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Memory Utilization" mon_type="memory_utilization" chartSize={CHART_DP_SIZES.FW} />
            </div>

        </div>
    
    );

}

export default MemoryMonitoring;