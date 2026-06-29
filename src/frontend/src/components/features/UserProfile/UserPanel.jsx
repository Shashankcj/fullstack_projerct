import React from 'react';
import ProfileTab from './ProfileTab';
import { useAuth } from '../../../Contexts/AuthContext';
import { UserIcon } from '@heroicons/react/24/outline';
import PageWrapper from '../../Utilities/PageWrapper';

const UserPanel = ({ isDarkMode = true }) => {
  const { user } = useAuth();

  return (
    <PageWrapper isDarkMode={isDarkMode}>
    <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        {/* Card */}
        <div
          className={`
            rounded-xl shadow-lg border
            transition-all duration-300
            ${isDarkMode
              ? 'bg-slate-900 border-gray-700'
              : 'bg-white border-gray-200'}
          `}
        >

          {/* Header */}
          <div
            className={`
              flex items-center gap-3 sm:gap-4
              px-4 sm:px-6 py-4
              border-b
              ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}
            `}
          >
            <div className="p-2 rounded-lg bg-indigo-500/10">
              <UserIcon
                className="w-5 h-5 sm:w-6 sm:h-6"
                style={{ color: isDarkMode ? '#6366F1' : '#4F46E5' }}
              />
            </div>

            <h1
              className={`
                text-lg sm:text-xl md:text-2xl font-semibold
                ${isDarkMode ? 'text-white' : 'text-gray-900'}
              `}
            >
              User Profile
            </h1>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 md:p-8">
            <ProfileTab user={user} isDarkMode={isDarkMode} />
          </div>

        </div>
    </div>
    </PageWrapper>
  );
};

export default UserPanel;