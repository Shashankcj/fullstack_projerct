import {Chart} from '../../../../components/device/deviceCharts';
import { MonHeaderCard } from '../../../../components/device/utils';
import { useOutletContext } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { fetchComponentUUIDs } from './utils';
import { CHART_DP_SIZES } from '../../../../constants/constants';

export const DiskIOMonitoring = (props) => {
    const isDarkMode = props.isDarkMode;
    const [diskUUIDs, setDiskUUIDs] = useState([]);
    const { agentId } = useOutletContext();

    useEffect(() => fetchComponentUUIDs(agentId, 'storage', setDiskUUIDs), [agentId]);

    return (
         <div className="space-y-3">
            <MonHeaderCard isDarkMode={isDarkMode} componentUUIDs={diskUUIDs}  /> 
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <Chart isDarkMode={isDarkMode} chartTitle="Read Count" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Read Ops" mon_type="read_count_io" chartSize={CHART_DP_SIZES.SMALL}/>
                
                <Chart isDarkMode={isDarkMode} chartTitle="Write Count" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Write Ops" mon_type="write_count_io" chartSize={CHART_DP_SIZES.SMALL}/>
            
            
                <Chart isDarkMode={isDarkMode} chartTitle="Bytes Read" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Data Read" mon_type="bytes_read_io" chartSize={CHART_DP_SIZES.SMALL}/>
            
        
                <Chart isDarkMode={isDarkMode} chartTitle="Bytes Written" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Data Written" mon_type="bytes_write_io" chartSize={CHART_DP_SIZES.SMALL}/>

                <Chart isDarkMode={isDarkMode} chartTitle="Read Time" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Read Time" mon_type="read_time_io" chartSize={CHART_DP_SIZES.SMALL}/>
            
        
                <Chart isDarkMode={isDarkMode} chartTitle="Write Time" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Write Time" mon_type="write_time_io" chartSize={CHART_DP_SIZES.SMALL}/>
            
            </div>
        </div>
    );

}

export default DiskIOMonitoring;