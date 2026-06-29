import {Chart} from '../../../device/deviceCharts';
import { MonHeaderCard } from '../../../device/utils';
import PageWrapper from '../../../Utilities/PageWrapper';
import { CHART_DP_SIZES } from '../../../../constants/constants';

const IPMonitor = (props) => {
    const isDarkMode = props.isDarkMode;
    return (
        <PageWrapper isDarkMode={isDarkMode}>
            <div className="space-y-3">
                <MonHeaderCard isIPMonitoringPage={true} isDarkMode={isDarkMode} showDeviceInfo={true}/> 
                <div className="grid grid-cols-1 gap-6">
                    
                        <Chart 
                            chartTitle="UP / DOWN Status"
                            seriesCount={1} 
                            xAxisKey="timestamp" 
                            yAxisLabel="UP / DOWN Status" 
                            mon_type="ip_status" 
                            chartSize={CHART_DP_SIZES.FW} 
                            isDarkMode={isDarkMode} 
                        />
                   
                </div>
    
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    <Chart isDarkMode={isDarkMode} chartTitle="Min Latency" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Min Latency" mon_type="min_latency" chartSize={CHART_DP_SIZES.SMALL} />
                
                    <Chart isDarkMode={isDarkMode} chartTitle="Max Latency" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Max Latency" mon_type="max_latency" chartSize={CHART_DP_SIZES.SMALL} />
                
                    <Chart isDarkMode={isDarkMode} chartTitle="Jitter" seriesCount={1} xAxisKey="timestamp" yAxisLabel="Jitter" mon_type="jitter" chartSize={CHART_DP_SIZES.SMALL} />
                
                    {/* <Chart chartTitle="System Calls" seriesCount={1} xAxisKey="timestamp" yAxisLabel="System Calls" mon_type="syscalls" chartSize={CHART_DP_SIZES.SMALL} /> */}
                
                </div>
            </div>
            </PageWrapper>
        );

};

export default IPMonitor;