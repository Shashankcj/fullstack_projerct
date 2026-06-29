import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const userApiSlice = createApi({
  reducerPath: 'userApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/webapp/v1/' }),
  tagTypes: ['WebUser'],
  endpoints: (builder) => ({
    getUsers: builder.query({
      query: () => 'user/manage/',
      providesTags: ['WebUser'],
    }),
    createUser: builder.mutation({
      query: (user) => ({
        url: 'user/manage/',
        method: 'POST',
        body: user,
      }),
      invalidatesTags: ['WebUser'],
    }),
    updateUser: builder.mutation({
      query: (userData) => ({
        url: `user/manage/`,
        method: 'PATCH',
        body: userData, 
      }),
      invalidatesTags: ['WebUser']
    }), 
    deleteUser: builder.mutation({
      query: (userData) => ({  
        url: `user/manage/`,
        method: 'DELETE',
        body: typeof userData === 'object' ? userData : { id: userData },  
      }),
      invalidatesTags: ['WebUser']
    }),
    updatePassword: builder.mutation({
      query: ({ id, newPassword }) => ({
        url: `/user/manage/`,
        method: 'PATCH',
        body: { newPassword },
      }),
      invalidatesTags: ['WebUser'],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useUpdatePasswordMutation
} = userApiSlice;
