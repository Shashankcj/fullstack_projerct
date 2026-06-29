import React from 'react';
import { Formik, Form } from 'formik';
import SignUpValidationSchema from './SignUpValidationSchema';
import { CardStyle } from '../CardStyle';
import { MyInput } from '../MyInput';
import { Link, useNavigate } from 'react-router-dom';
import backendApi from '../../../../api/backendAxiosInstance';
import { toast } from 'react-toastify';
import "./SignUp.css";
import { useDocumentTitle } from '../../../../Hooks/useDocumentTitle';
import GenesisCard from '../GenesisLogoCard';

const SignUp = () => {
  useDocumentTitle('Signup');
  const navigate = useNavigate();

  const initialValues = {
    username: '',
    email: '',
    password: '',
    confirm_password: '',
  };

  const onSubmit = async (values, { setSubmitting }) => {
    try {
      const res = await backendApi.post('/signup/', values);

      if (res.status === 201) {
        toast.success(res.data.message || 'Registration successful!');
        navigate("/signin");
      }
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error(error.response?.data?.error || 'Invalid input or unauthorized.');
      } else {
        toast.error('Server error. Please try again later.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left section with GenesisCard and blue background */}
      <div className="w-[30%] flex items-center justify-center bg-blue-700">
        <GenesisCard />
      </div>

      {/* Right section with form */}
      <div className="w-[70%] flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-6">
        <div className="w-full max-w-md">
          <CardStyle 
            title={<span style={{ color: '#6366f1' }}>Sign Up</span>} 
            className="dark:bg-gray-800"
            style={{
              boxShadow: '0 4px 24px 0 rgba(99, 102, 241, 0.09), 0 1.5px 7px -1.5px rgba(30, 41, 59, 0.08)',
              borderRadius: '0.75rem',
              backgroundColor: '#fff',
            }}
          >
            <Formik 
              initialValues={initialValues} 
              validationSchema={SignUpValidationSchema} 
              onSubmit={onSubmit}
            >
              {({ isSubmitting, errors, touched }) => {
                const isUsernameValid = touched.username && !errors.username;
                const isEmailValid = touched.email && !errors.email;
                const isPasswordValid = touched.password && !errors.password;

                return (
                  <Form>
                    <MyInput name="username" label="Username" enableValidation={true} />

                    <MyInput 
                      name="email" 
                      label="Email" 
                      type="email" 
                      disabled={!isUsernameValid} 
                      enableValidation={true} 
                    />

                    <MyInput 
                      name="password" 
                      label="Password" 
                      type="password" 
                      disabled={!isEmailValid}
                    />

                    <MyInput 
                      name="confirm_password" 
                      label="Confirm Password" 
                      type="password" 
                      disabled={!isPasswordValid}
                    />

                    <button 
                      type="submit" 
                      disabled={isSubmitting} 
                      className={`w-full text-white font-semibold py-2 mt-4 rounded-lg transition ${
                        isSubmitting ? 'opacity-60 cursor-not-allowed' : 'hover:bg-indigo-700'
                      }`} 
                      style={{ backgroundColor: '#6366f1' }}
                    >
                      {isSubmitting ? 'Signing Up...' : 'Sign Up'}
                    </button>
                  </Form>
                );
              }}
            </Formik>

            <p className="mt-4 text-sm text-center text-gray-700 dark:text-gray-300">
              Already have an account?{' '}
              <Link to="/signin" className="text-blue-600 hover:underline">
                SignIn
              </Link>
            </p>
          </CardStyle>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
