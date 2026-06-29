import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';

const ErrorPage = ({ isDarkMode }) => {
  const navigate = useNavigate();

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${
      isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'
    }`}>
      <div className="max-w-2xl w-full text-center">
        {/* 404 Number with gradient */}
        <div className="relative mb-8">
          <h1 className={`text-9xl font-bold ${
            isDarkMode ? 'text-gray-800' : 'text-gray-200'
          }`}>
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-3xl opacity-30"></div>
          </div>
        </div>

        {/* Error Message */}
        <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${
          isDarkMode ? 'text-gray-100' : 'text-gray-800'
        }`}>
          Page Not Found
        </h2>
        
        <p className={`text-lg mb-8 ${
          isDarkMode ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Sorry, the page you're looking for doesn't exist or has been moved.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => navigate('/dashboard')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105 ${
              isDarkMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
            }`}
          >
            <Home size={20} />
            Go to Dashboard
          </button>
          
          <button
            onClick={() => navigate(-1)}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              isDarkMode 
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700' 
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-md'
            }`}
          >
            <ArrowLeft size={20} />
            Go Back
          </button>
        </div>

        {/* Additional Help Text */}
        <div className={`mt-12 pt-8 border-t ${
          isDarkMode ? 'border-gray-800' : 'border-gray-300'
        }`}>
          <p className={`text-sm ${
            isDarkMode ? 'text-gray-500' : 'text-gray-500'
          }`}>
            Need help? Contact your system administrator or visit the{' '}
            <button
              onClick={() => navigate('/devices')}
              className="text-blue-500 hover:text-blue-600 underline"
            >
              devices page
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
