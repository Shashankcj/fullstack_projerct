
import { useEffect } from 'react';
import { useFormikContext } from 'formik';
import debounce from 'lodash.debounce';

export const useDebouncedValidation = (name, validateFn, delay = 500) => {
  const { values, setFieldError, setFieldTouched, touched } = useFormikContext();

  useEffect(() => {
    
    if (!touched[name]) return;

    const debounced = debounce(async (value) => {
      if (!value) {
        setFieldError(name, undefined); 
        return;
      }

      try {
        const errorMessage = await validateFn(value);
        setFieldError(name, errorMessage || undefined);
      } catch (err) {
        setFieldError(name, 'Validation failed');
      }
    }, delay);

    debounced(values[name]);

    return () => debounced.cancel();
  }, [values[name], touched[name]]);
};
