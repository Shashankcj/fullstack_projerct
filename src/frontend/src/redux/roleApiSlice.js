import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const roleApi = createApi({
  reducerPath: 'roleApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/webapp/v1/',
    prepareHeaders: (headers) => {
      headers.set('Content-Type', 'application/json');
      return headers;
    },
  }),
  tagTypes: ['Role'],
  endpoints: (builder) => ({

    // GET: Fetch all roles
    getRoles: builder.query({
      query: () => ({
        url: '/roles/',
        method: 'GET',
      }),
      transformResponse: (response) => response?.data || [],
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ uuid }) => ({ type: 'Role', id: uuid })),
              { type: 'Role', id: 'LIST' },
            ]
          : [{ type: 'Role', id: 'LIST' }],
    }),

    // POST: Create a new role
    createRole: builder.mutation({
      query: (roleData) => ({
        url: '/roles/',
        method: 'POST',
        body: roleData,
      }),
      transformResponse: (response) => response?.data || response,
      invalidatesTags: [{ type: 'Role', id: 'LIST' }],
    }),

    // PATCH: Update an existing role
    updateRole: builder.mutation({
      query: (roleData) => ({
        url: '/roles/',
        method: 'PATCH',
        body: roleData,
      }),
      transformResponse: (response) => response?.data || response,
      invalidatesTags: (result, error, { uuid }) => [
        { type: 'Role', id: uuid },
        { type: 'Role', id: 'LIST' },
      ],
    }),

    // DELETE: Delete a role by UUID
    deleteRole: builder.mutation({
      query: (roleId) => ({
        url: '/roles/',
        method: 'DELETE',
        body: { uuid: roleId },
      }),
      transformResponse: (response) => response?.data || response,
      invalidatesTags: (result, error, roleId) => [
        { type: 'Role', id: roleId },
        { type: 'Role', id: 'LIST' },
      ],
    }),

  }),
});

export const {
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} = roleApi;
