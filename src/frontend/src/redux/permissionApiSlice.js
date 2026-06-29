import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const permissionApi = createApi({
  reducerPath: 'permissionApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/webapp/v1/',
    credentials: 'include',
    prepareHeaders: (headers, { getState }) => {
      let token = null;

      try {
        token = getState()?.auth?.token;
      } catch (error) {
        console.log('No auth state available');
      }

      if (!token) {
        const getCookieValue = (name) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop().split(';').shift();
          return null;
        };
        token = getCookieValue('jwt');
      }

      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      headers.set('Content-Type', 'application/json');
      headers.set('Accept', 'application/json');
      return headers;
    },
  }),
  tagTypes: ['Permission', 'UserPermission', 'AvailablePermission'],
  endpoints: (builder) => ({
    // Get user's assigned permissions
    getUserPermissions: builder.query({
      query: (userId) => `get_user_permissions/${userId}/`,
      providesTags: (result, error, userId) => [
        { type: 'UserPermission', id: userId }
      ],
    }),

    // Get all available permissions
    getAvailablePermissions: builder.query({
      query: () => `get_available_permissions/`,
      providesTags: ['AvailablePermission'],
    }),

    // Update user permissions
    updateUserPermissions: builder.mutation({
      query: ({ userId, permissions }) => ({
        url: `update_user_permissions/${userId}/`,
        method: 'POST',
        body: { permissions },
      }),
      invalidatesTags: (result, error, { userId }) => [
        { type: 'UserPermission', id: userId }
      ],
    }),
  })
});

export const {
  useGetUserPermissionsQuery,
  useGetAvailablePermissionsQuery,
  useUpdateUserPermissionsMutation,
} = permissionApi;
