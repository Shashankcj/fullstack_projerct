// import { useEffect } from "react";
// import { useSearchParams } from "react-router-dom";

// /**
//  * Syncs any key/value map to URL search params.
//  * Omits values that match their default to keep URLs clean.
//  * Used by: all 5 pages
//  */
// export const useURLSync = ({ params = {}, defaults = {} }) => {
//   const [, setSearchParams] = useSearchParams();

//   useEffect(() => {
//     const next = new URLSearchParams();
//     Object.entries(params).forEach(([key, value]) => {
//       if (value !== undefined && value !== null && value !== "" && value !== defaults[key]) {
//         next.set(key, value);
//       }
//     });
//     setSearchParams(next, { replace: true });
//   }, [JSON.stringify(params)]);
// };


import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Syncs any key/value map to URL search params.
 * Omits empty/default values to keep URLs clean.
 * Used by: all table pages
 */
export const useURLSync = ({ params = {}, defaults = {} }) => {
  const [, setSearchParams] = useSearchParams();

  // 1. Serialize the inputs to strings so we have a stable primitive to compare against
  const paramsString = JSON.stringify(params);
  const defaultsString = JSON.stringify(defaults);

  // 2. Compute the search params. It will ONLY recalculate if the actual values change.
  const normalizedParams = useMemo(() => {
    const next = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      const defaultValue = defaults[key];
      const isEmpty =
        value === undefined ||
        value === null ||
        value === "";

      if (!isEmpty && value !== defaultValue) {
        next.set(key, String(value));
      }
    });

    return next;
    // Depend on the primitive strings here to break the reference loop
  }, [paramsString, defaultsString]); 

  // 3. Update the URL, guarding against redundant pushes
  useEffect(() => {
    setSearchParams(normalizedParams, { replace: true });
  }, [normalizedParams, setSearchParams]);
};