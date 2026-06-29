import React, { useState } from 'react';
import { useDocumentTitle } from '../../../../Hooks/useDocumentTitle';
import GenericConfiguration from './GenericConfiguration';
import MonitoringConfig from './MonitoringConfig';
import {
  smtpConfigSections,
  monitoringConfigSections,
  dataretentionConfigSections,
  licenseConfigSections,
  licenseConfigSectionsWithDetails,
} from '../utils/configDefinitions';
import ActionButtons from "../../../shared/ActionButtons";
import PageWrapper from "../../../Utilities/PageWrapper";
import { useGetGlobalConfigQuery } from '../../../../redux/globalApiSlice';

const GlobalConfiguration = ({ isDarkMode }) => {
  useDocumentTitle('Global Configuration');
  const [activeTab, setActiveTab] = useState('smtp');

const {
  data: existingConfig,
  refetch,
  isFetching,
} = useGetGlobalConfigQuery(undefined, {
  refetchOnMountOrArgChange: true,
});

  const hasLicense = !!existingConfig?.['license.key'];

  const licenseSections = hasLicense
    ? licenseConfigSectionsWithDetails
    : licenseConfigSections;

  return (
    <PageWrapper isDarkMode={isDarkMode}>
    <div className="px-2 sm:px-0">
      {/* Header */}
      <div
  className={`rounded-lg p-3 flex items-start justify-between`}
>
  {/* LEFT */}
  <div>
    <h1
      className={`text-2xl font-bold ${
        isDarkMode ? 'text-white' : 'text-gray-700'
      }`}
    >
      Global Configuration
    </h1>
  </div>

  {/* RIGHT */}
  <ActionButtons
    onRefresh={refetch}
    isRefreshing={isFetching}
    isDarkMode={isDarkMode}
    refreshButtonTitle="Refresh Configuration"
  />
</div>



      {/* Main Configuration Card with Tabs */}
      <div
        className={`rounded-lg shadow-md border ${
          isDarkMode
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
        }`}
      >
        {/* Tab Navigation */}
        <div
          className={`border-b ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          <div className="flex">
            <button
              onClick={() => setActiveTab('smtp')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'smtp'
                  ? isDarkMode
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-blue-600 border-b-2 border-blue-600'
                  : isDarkMode
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Smtp
            </button>
            <button
              onClick={() => setActiveTab('monitoring')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'monitoring'
                  ? isDarkMode
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-blue-600 border-b-2 border-blue-600'
                  : isDarkMode
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monitoring
            </button>
            <button
              onClick={() => setActiveTab('license')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'license'
                  ? isDarkMode
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-blue-600 border-b-2 border-blue-600'
                  : isDarkMode
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              License
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'advanced'
                  ? isDarkMode
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-blue-600 border-b-2 border-blue-600'
                  : isDarkMode
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Advanced
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'smtp' && (
            <GenericConfiguration
              isDarkMode={isDarkMode}
              configType="smtp"
              sections={smtpConfigSections}
            />
          )}

          {activeTab === 'monitoring' && (
            <MonitoringConfig
              isDarkMode={isDarkMode}
              configType="monitoring"
              existingConfig={existingConfig} 
            />
          )}

          {activeTab === 'license' && (
            <GenericConfiguration
              isDarkMode={isDarkMode}
              configType="license"
              sections={licenseSections}
            />
          )}

          {activeTab === 'advanced' && (
            <div className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
              <GenericConfiguration
                isDarkMode={isDarkMode}
                configType="data_retention"
                sections={dataretentionConfigSections}
              />
            </div>
          )}
        </div>
      </div>
    </div>
    </PageWrapper>
  );
  
};

export default GlobalConfiguration;
