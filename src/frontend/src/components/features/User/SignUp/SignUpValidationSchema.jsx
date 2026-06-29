import * as Yup from 'yup';

const SignUpValidationSchema = Yup.object({
  username: Yup.string().required('Username is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .max(20, 'Password must be less than 20 characters')
    .test('has-uppercase', 'Password must contain at least one uppercase letter', (value) => {
      return value ? /[A-Z]/.test(value) : true;
    })
    .test('has-lowercase', 'Password must contain at least one lowercase letter', (value) => {
      return value ? /[a-z]/.test(value) : true;
    })
    .test('has-number', 'Password must contain at least one number', (value) => {
      return value ? /\d/.test(value) : true;
    })
    .test('has-special', 'Password must contain at least one special character', (value) => {
      return value ? /[!@#$%^&*()_+\-=[\]{};:'"\\|,.<>/?]/.test(value) : true;
    })
    .test('no-spaces', 'Password cannot contain spaces', (value) => {
      return value ? !/\s/.test(value) : true;
    })
    .required('Password is required'),
  confirm_password: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm Password is required'),
});

export default SignUpValidationSchema;
