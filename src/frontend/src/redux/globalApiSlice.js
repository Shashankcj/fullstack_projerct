import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const globalApiSlice = createApi({
  reducerPath: 'globalApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/webapp/v1/',
    credentials: 'include',
  }),
  tagTypes: ['GLOBALConfig'],
  endpoints: (builder) => ({
    // GET request to fetch global configuration
    getGlobalConfig: builder.query({
      query: () => ({
        url: '/globalconfig',
        method: 'GET',
      }),
      transformResponse: (response) => ({
      ...(response?.config || {}),

      _user: response?.user || {},
    }),

      providesTags: ['GLOBALConfig'],
    }),

    // PATCH request to save global configuration
    saveGlobalConfig: builder.mutation({
      query: (payload) => ({
        url: '/globalconfig',
        method: 'PATCH',
        body: payload,
      }),
      invalidatesTags: ['GLOBALConfig'],
    }),

    // POST request to TEST SMTP configuration
    testGlobalConfig: builder.mutation({
      query: (payload) => ({
        url: '/test-smtp-config/',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['GLOBALConfig'],
    }),

    // Dynamic POST/PUT for license configuration
    saveLicenseConfig: builder.mutation({
      query: (data) => {
        const { _isUpdate, ...payload } = data; // Extract flag, remove from payload
        
        return {
          url: '/license/',
          method: _isUpdate ? 'PUT' : 'POST', // Dynamic method based on flag
          body: payload,
        };
      },
      invalidatesTags: ['GLOBALConfig'],
    }),
  }),
});

export const {
  useGetGlobalConfigQuery,
  useSaveGlobalConfigMutation,
  useTestGlobalConfigMutation,
  useSaveLicenseConfigMutation,
} = globalApiSlice;
