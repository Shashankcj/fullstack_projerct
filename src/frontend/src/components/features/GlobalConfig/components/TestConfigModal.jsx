import React, { useState, useEffect } from 'react';
import { XMarkIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../../../Contexts/AuthContext';
import { toast } from 'react-toastify';


const EMAIL_OPTIONS = [
  { value: 'logged_user', label: 'Send email to logged user' },
  { value: 'specific_email', label: 'Send email to specific email(s)' },
  { value: 'alert_config', label: 'Send email to addresses configured in alert config' },
];


const TestConfigModal = ({ show, onHide, onSend, isDarkMode }) => {
  const [selectedOption, setSelectedOption] = useState('logged_user');
  const [specificEmail, setSpecificEmail] = useState('');
  
  const { user } = useAuth();

  useEffect(() => {
    if (!show) {
      setSelectedOption('logged_user');
      setSpecificEmail('');
    }
  }, [show]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const validateMultipleEmails = (emailString) => {
    if (!emailString.trim()) return false;
    
    const emails = emailString.split(',').map(e => e.trim()).filter(e => e);
    
    if (emails.length === 0) return false;
    
    const invalidEmails = emails.filter(email => !validateEmail(email));
    
    if (invalidEmails.length > 0) {
      toast.error(`Invalid email address(es): ${invalidEmails.join(', ')}`);
      return false;
    }
    
    return true;
  };

  const handleSend = (e) => {
    e.preventDefault();

    //Validate based on type
    if (selectedOption === 'specific_email') {
      if (!specificEmail.trim()) {
        toast.error('Please enter at least one email address');
        return;
      }
      
      if (!validateMultipleEmails(specificEmail)) {
        return;
      }
    }

    // Parent will build the complete payload
    onSend({
      type: selectedOption,
      email: selectedOption === 'specific_email' ? specificEmail.trim() : undefined,
    });

    onHide();
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.1)" }}
      onClick={onHide}
    >
      <div
        className="rounded-xl p-6 max-w-lg w-full relative shadow-2xl border mx-4"
        style={{
          background: isDarkMode ? "rgba(15, 23, 42, 0.8)" : "rgba(246, 245, 248, 1)",
          borderColor: isDarkMode ? "rgba(51, 65, 85, 0.4)" : "rgba(203, 213, 225, 0.3)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onHide} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
          <XMarkIcon className="h-5 w-5" />
        </button>

        <h3 className="text-xl font-semibold mb-4 flex items-center" style={{ color: isDarkMode ? "#F1F5F9" : "#1E293B" }}>
          <EnvelopeIcon className="w-5 h-5 mr-2" style={{ color: isDarkMode ? "#60A5FA" : "#2563EB" }} />
          Test Email Configuration
        </h3>

        {user?.email && selectedOption === 'logged_user' && (
          <div className={`mb-4 p-3 rounded-lg ${isDarkMode ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
            <p className={`text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
              <span className="font-medium">Email will be sent to:</span> {user.email}
            </p>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          <div className="space-y-3">
            {EMAIL_OPTIONS.map(opt => (
              <div key={opt.value}>
                <label className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
                  isDarkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-white hover:bg-gray-50 text-gray-900"
                }`}>
                  <input
                    type="radio"
                    name="test_email_option"
                    value={opt.value}
                    checked={selectedOption === opt.value}
                    onChange={() => setSelectedOption(opt.value)}
                    className="form-radio h-4 w-4 mr-2"
                  />
                  {opt.label}
                </label>

                {opt.value === "specific_email" && (
                  <div className={`overflow-hidden transition-all duration-300 ease-out ${
                    selectedOption === "specific_email" ? "max-h-32 opacity-100 ml-6 mt-2" : "max-h-0 opacity-0 ml-6"
                  }`}>
                    <input
                      type="text"
                      placeholder="Enter email address(es)"
                      value={specificEmail}
                      onChange={(e) => setSpecificEmail(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        isDarkMode ? "bg-gray-700 text-gray-200 border-gray-600" : "bg-gray-50 text-gray-900 border-gray-300"
                      }`}
                    />
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Separate multiple emails with commas
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t" style={{ borderColor: isDarkMode ? "#374151" : "#E5E7EB" }}>
            <button
              type="button"
              onClick={onHide}
              className={`inline-flex items-center px-4 py-1.5 font-medium rounded-lg transition-colors ${
                isDarkMode ? "text-gray-300 bg-gray-600 hover:bg-gray-500" : "text-gray-700 bg-gray-200 hover:bg-gray-300"
              }`}
            >
              Close
            </button>

            <button
              type="submit"
              className="inline-flex items-center px-5 py-1.5 font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TestConfigModal;
