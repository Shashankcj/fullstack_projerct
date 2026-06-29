import { FaCheckCircle } from 'react-icons/fa';

const PasswordResetInfo = () => {
  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center border border-gray-200 dark:border-gray-700">
        <FaCheckCircle className="text-green-500 text-4xl mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
          Password Reset Email Sent
        </h2>
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          A password reset link has been sent to your email address.
          <br />
          Please update your password within <span className="font-semibold text-red-500">15 minutes</span>, otherwise the link will expire.
        </p>
      </div>
    </div>
  )
}

export default PasswordResetInfo;
