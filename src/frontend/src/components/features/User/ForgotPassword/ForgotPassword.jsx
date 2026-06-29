import React, { useState, useEffect } from 'react';
import { Formik, Form, Field } from 'formik';
import { useNavigate } from 'react-router-dom';
import backendApi from '../../../../api/backendAxiosInstance';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import GenesisLogoCard from '../GenesisLogoCard';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [captcha, setCaptcha] = useState('');

  // Generate random 4-digit captcha
  const generateCaptcha = () => {
    const randomCaptcha = Math.floor(1000 + Math.random() * 9000).toString();
    setCaptcha(randomCaptcha);
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  const initialValues = {
    email: '',
    captchaInput: '',
  };

  const PasswordValidationSchema = Yup.object({
    email: Yup.string().email('Invalid email').required('Email is required'),
    captchaInput: Yup.string()
      .required('Captcha is required')
      .test('captcha-match', 'Captcha does not match', function (value) {
        return value === captcha;
      }),
  });

  const onSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      const { captchaInput, ...apiValues } = values;
      const res = await backendApi.post('/register/reset-password/', apiValues);

      if (res.status === 200 || res.status === 201) {
        toast.success('Reset Link sent to your registered email!');
        navigate('/forgot-password-info');
      }
    } catch (error) {
      if (error.response?.status === 500) {
        toast.error(error.response?.data?.error || 'Something went wrong. Please try again.');
      } else {
        toast.error('Server error. Please try later.');
      }
      resetForm();
      generateCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = () => generateCaptcha();

  return (
    <div className="flex min-h-screen">
      {/* Left side - Genesis split */}
      <div className="w-[30%] flex items-center justify-center bg-blue-700">
        <GenesisLogoCard />
      </div>

      {/* Right side - Form */}
      <div className="w-[70%] flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-6">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          {/* Title */}
          <h2 className="text-2xl font-semibold text-center text-gray-800 dark:text-gray-100 mb-2">
            Reset Password
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {/* Form */}
          <Formik 
            initialValues={initialValues} 
            validationSchema={PasswordValidationSchema} 
            onSubmit={onSubmit}
          >
            {({ errors, touched, isSubmitting, setFieldTouched }) => (
              <Form>
                {/* Email Field */}
                <div className="mb-4">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Email<span className="text-red-500">*</span>
                  </label>
                  <Field
                    type="email"
                    name="email"
                    id="email"
                    onFocus={() => setFieldTouched('email', false)}
                    className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
                      errors.email && touched.email
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                  {errors.email && touched.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                {/* Captcha Section */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Security Verification<span className="text-red-500">*</span>
                  </label>
                  
                  {/* Captcha Display */}
                  <div className="flex items-center gap-3 mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600">
                    <span className="font-mono text-2xl font-bold tracking-widest text-blue-600 dark:text-blue-400 select-none bg-white dark:bg-gray-800 px-3 py-1 rounded border">
                      {captcha}
                    </span>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer text-xl font-bold p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title="Refresh Captcha"
                    >
                      ↻
                    </button>
                  </div>

                  {/* Captcha Input */}
                  <Field
                    type="text"
                    name="captchaInput"
                    placeholder="Enter captcha"
                    onFocus={() => setFieldTouched('captchaInput', false)}
                    className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
                      errors.captchaInput && touched.captchaInput
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                  {errors.captchaInput && touched.captchaInput && (
                    <p className="text-red-500 text-xs mt-1">{errors.captchaInput}</p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full bg-[#6366f1] hover:bg-[#6366f1]/80 text-white font-semibold py-3 rounded-md transition-colors ${
                    isSubmitting ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                </button>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
