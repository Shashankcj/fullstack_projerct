import { SystemInfoCard } from './SystemInfoCard';
import { CPUCard } from './CPUCard';
import { MemoryCard } from './MemoryCard';
import { NetworkCard } from './NetworkCard';
import { DiskUsageCard } from './DiskCard';
import { AlertsCard } from './AlertsCard';
import { EventLogsTable } from './EventsCard';
import { useGetDeviceDetailsByIdQuery } from '../../../../redux/apiSlice';
import { useParams } from 'react-router-dom';
import { AlertCircle, RefreshCw, Monitor } from 'lucide-react';
import Loading from '../../../../components/shared/loading';
import { useDocumentTitle } from '../../../../Hooks/useDocumentTitle';

const Dashboard = ({ isDarkMode, cpuMap, networkMap, memoryMap }) => {
  useDocumentTitle('Device');

  const { agentId } = useParams();
  const { data, isLoading, error, refetch } = useGetDeviceDetailsByIdQuery(agentId);
  const device = data;

  /* ── Loading ── */
  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center">
            <div className="mb-6"><Loading /></div>
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              Loading Device Dashboard
            </h3>
            <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Fetching device information...
            </p>
          </div>
        </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (

        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-md w-full">
            <AlertCircle className="w-14 h-14 mx-auto mb-4 text-red-500" />
            <h3 className={`text-lg sm:text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              Failed to Load Device Data
            </h3>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {error?.data?.message || 'Something went wrong.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={refetch}
                className="flex items-center justify-center px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Retry
              </button>
              <button
                onClick={() => window.history.back()}
                className={`px-4 py-2 text-sm rounded-lg border ${
                  isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
    );
  }

  /* ── Empty ── */
  if (!device) {
    return (
    
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-md w-full">
            <Monitor className="w-14 h-14 mx-auto mb-4 text-gray-400" />
            <h3 className={`text-lg sm:text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              Device Not Found
            </h3>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Device not available or access denied.
            </p>
          </div>
        </div>
  
    );
  }

  /* ── Main ── */
  return (
    <>

      {/* Main Content */}
      <div className="max-w-8xl mx-auto mt-4 space-y-5 ">

        {/* Top Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(16rem,20rem)_1fr] gap-4">
          <SystemInfoCard isDarkMode={isDarkMode} data={device} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CPUCard     isDarkMode={isDarkMode} cpuMap={cpuMap} />
            <MemoryCard  isDarkMode={isDarkMode} memoryMap={memoryMap} />
            <NetworkCard isDarkMode={isDarkMode} networkMap={networkMap} />
            <DiskUsageCard isDarkMode={isDarkMode} />
          </div>
        </div>

        {/* Bottom */}
        <div className="space-y-5">
          <AlertsCard    isDarkMode={isDarkMode} deviceId={device?.uuid} limit={100} />
          <EventLogsTable isDarkMode={isDarkMode} deviceId={device?.uuid} limit={100} />
        </div>

      </div>
    </>
  );
};

export default Dashboard;