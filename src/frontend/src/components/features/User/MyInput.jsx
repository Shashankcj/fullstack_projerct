import { useState, useCallback } from 'react';
import { Field, ErrorMessage, useFormikContext, useField } from 'formik';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import { useDebouncedValidation } from '../../../validate/useDebouncedValidation'
import backendApi from '../../../api/backendAxiosInstance';

export const MyInput = ({ name, label, type = 'text', disabled, enableValidation = false, options = [],autoComplete }) => {
  const isTextArea = type === 'textarea';
  const isSelect = type === 'select';
  const { touched, errors, values } = useFormikContext();
  const [showPassword, setShowPassword] = useState(false);
  const [, meta] = useField(name);

  const isPasswordField = name === 'password' || name === 'confirm_password';
  const inputType = isPasswordField && showPassword ? 'text' : type;


  const validateFn = useCallback(async (value) => {
    try {
      console.log(value)
      const res = await backendApi.post(`/signup/check-${name}/`, { [name]: value });
      if (!res.data.available) {
        return res.data.message || `${name} is already taken`;
      }
    } catch (err) {
      return 'Server error';
    }
  }, [name]);

  if (enableValidation && (name === 'email' || name === 'username')) {
    useDebouncedValidation(name, validateFn);
  }

  const isTouched = touched[name];
  const hasError = errors[name];
  const hasValue = values[name];

  const inputBorder = isTouched
    ? hasError
      ? 'border-red-500'
      : hasValue
        ? 'border-green-500'
        : 'border-green-300'
    : 'border-blue-500'

  const labelColor = isTouched
    ? hasError
      ? 'text-red-500 dark:text-red-400'
      : 'text-green-500 dark:text-green-600'
    : 'text-blue-500 dark:text-blue-500';

  return (
    <div className="relative mb-6">
      {isSelect ? (
        <>
          <Field
            as="select"                               
            name={name}
            id={name}
           className={`peer block w-full rounded-lg px-2.5 pb-2 pt-6 text-sm
  text-gray-900 dark:text-white 
  bg-white dark:bg-gray-900 
  border
  ${inputBorder}
  focus:outline-none focus:ring-0`}
            disabled={disabled}
          >
            <option value="" >
              {label}
            </option>
            {options.map((opt, index) => (
              <option key={index} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Field>
        </>
      ) : (
        <>
          <Field
            as={isTextArea ? 'textarea' : 'input'}
            name={name}
            type={isTextArea ? undefined : inputType}
           className={`peer block w-full rounded-lg px-2.5 pb-2 pt-6 text-sm
  text-gray-900 dark:text-white 
  bg-white dark:bg-gray-900 
  border
  ${inputBorder}
  focus:outline-none focus:ring-0`}

            id={name}
            placeholder=" "
            disabled={disabled}
            autoComplete={autoComplete}
          />

          <label
            htmlFor={name}
            className={`absolute text-sm ${labelColor} duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2
                    peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100
                    peer-focus:-translate-y-4 peer-focus:translate-x-2 peer-focus:scale-75 ${hasValue ? 'translate-x-2' : ''}`}
          >
            {label}
          </label>
        </>
      )}

      {isPasswordField && (
        <div
          className="absolute inset-y-0 right-3 flex items-center text-gray-500 cursor-pointer"
          onClick={() => setShowPassword(prev => !prev)}
        >
          {showPassword ? <AiOutlineEyeInvisible size={20} /> : <AiOutlineEye size={20} />}
        </div>
      )}

      {/* Error message */}
      <div style={{ marginTop: '0.2rem' }}>
        <ErrorMessage name={name}>
          {msg => (
          <p className="text-red-500 text-[0.7rem]">{msg}</p>

          )}
        </ErrorMessage>
      </div>
    </div>

  );
};
