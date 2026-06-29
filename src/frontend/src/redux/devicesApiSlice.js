
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const devicesApi = createApi({
  reducerPath: 'devicesApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/webapp/v1/',
    credentials: 'include',
  }),
  tagTypes: ['Device'],
  endpoints: (builder) => ({
    // Get devices list with pagination, search, and status filter
    getDevices: builder.query({
      query: ({ page = 1, page_size = 10, search = '', status, device_type, os, priority, health }) => {
        const params = new URLSearchParams();

        params.append('page', page.toString());
        params.append('page_size', page_size.toString());

        if (search) params.append('search', search);
        if (status && status !== 'all') params.append('status', status);
        if (device_type) params.append('device_type', device_type);
        if (os) params.append('os', os); 
        if (priority) params.append('priority', priority); 
        if (health && health !== 'all') params.append('health', health);

        return `devicedata?${params.toString()}`;
      },

      providesTags: (result) => {
        const devices =
          result?.results?.devices ||
          result?.results ||
          [];

        return Array.isArray(devices)
          ? [
              ...devices.map(({ uuid }) => ({ type: 'Device', id: uuid })),
              { type: 'Device', id: 'LIST' },
            ]
          : [{ type: 'Device', id: 'LIST' }];
      },

      transformErrorResponse: (response) => ({
        status: response.status,
        error: response.data?.error || 'Failed to fetch devices',
        message: response.data?.message || 'Unable to load device data',
      }),

      keepUnusedDataFor: 60,
    }),

    // Get single device by UUID
    getDeviceById: builder.query({
      query: (uuid) => `device/${uuid}`,
      providesTags: (result, error, uuid) => [{ type: 'Device', id: uuid }],
      transformErrorResponse: (response) => ({
        status: response.status,
        error: response.data?.error || 'Failed to fetch device details',
        message: response.data?.message || 'Unable to load device information',
      }),
    }),

    // Delete device(s)
    deleteDevice: builder.mutation({
      query: ({ uuid, uuids }) => ({
        url: `delete_agent/`,
        method: 'DELETE',
        body: uuids ? { uuids } : { uuid },
      }),

      invalidatesTags: (result, error, { uuid, uuids }) => {
        if (uuid) {
          return [
            { type: 'Device', id: uuid },
            { type: 'Device', id: 'LIST' },
          ];
        }

        if (uuids) {
          return [
            ...uuids.map((id) => ({ type: 'Device', id })),
            { type: 'Device', id: 'LIST' },
          ];
        }

        return [{ type: 'Device', id: 'LIST' }];
      },
    }),

    // Assign priority via PATCH (single or multiple)
    assignPriority: builder.mutation({
      query: (payload) => ({
        url: 'agents/priority/',
        method: 'PATCH',
        body: payload,
      }),
      invalidatesTags: (result, error, payload) => {
        const ids = Array.isArray(payload)
          ? payload.map((item) => item.agent_uuid)
          : [payload.agent_uuid];

        return [
          ...ids.map((id) => ({ type: 'Device', id })),
          { type: 'Device', id: 'LIST' },
        ];
      },
    }),

    // CSV Upload for Devices
    csvUpload: builder.mutation({
      query: (formData) => ({
        url: 'agents/priority/csv/',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: [{ type: 'Device', id: 'LIST' }], 
    }),

    // Set Maintenance Mode (single or bulk)
    setMaintenanceMode: builder.mutation({
      query: (payload) => ({
        url: 'agents/maintenance/',
        method: 'PATCH',            
        body: payload,              
      }),
      invalidatesTags: (result, error, payload) => {
        // Extract device IDs exactly like assignPriority
        const ids = Array.isArray(payload)
          ? payload.map((item) => item.agent_uuid)
          : [payload.agent_uuid];

        return [
          ...ids.map((id) => ({ type: 'Device', id })),
          { type: 'Device', id: 'LIST' },
        ];
      },
    }),
  }),
});

export const {
  useGetDevicesQuery,
  useGetDeviceByIdQuery,
  useDeleteDeviceMutation,
  useAssignPriorityMutation,
  useCsvUploadMutation,
  useSetMaintenanceModeMutation,
} = devicesApi;
