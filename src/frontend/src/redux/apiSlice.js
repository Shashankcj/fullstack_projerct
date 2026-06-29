import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';


const customBaseQuery = async (args, api, extraOptions) => {
  const rawBaseQuery = fetchBaseQuery({
    baseUrl: '/api/webapp/v1/',
    credentials: 'include',
    prepareHeaders: (headers, { getState }) => {
      const token = getState()?.auth?.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (!headers.has('Content-Type') && !(args.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }
      return headers;
    },
    timeout: 30000,
  });

  try {
    const result = await rawBaseQuery(args, api, extraOptions);

    if (result.error?.status === 404) {
      return {
        data: {
          groups: [],
          total_groups: 0,
          total_devices: 0,
          user: null,
          timestamp: new Date().toISOString()
        }
      };
    }

    if (result.error?.status === 'PARSING_ERROR') {
      return {
        data: {
          groups: [],
          total_groups: 0,
          total_devices: 0,
          user: null,
          timestamp: new Date().toISOString()
        }
      };
    }

    return result;

  } catch (networkError) {
    return {
      error: {
        status: 'FETCH_ERROR',
        error: 'Network error occurred',
        data: networkError.message
      }
    };
  }
};


export const apiSlice = createApi({
  reducerPath: 'api',
  tagTypes: ['Devices', 'Groups', 'CpuStats', 'MemoryStats', 'DiskStats'],
  baseQuery: customBaseQuery,

  keepUnusedDataFor: 300,
  refetchOnMountOrArgChange: 30,
  refetchOnFocus: true,
  refetchOnReconnect: true,

  endpoints: (builder) => ({
    // === DEVICE ENDPOINTS ===
    getDevices: builder.query({
      query: ({ page = 1, page_size = 10, search = '', os = '', device_type = '', status = '' }) => {
        const params = new URLSearchParams({
          page: page.toString(),
          page_size: page_size.toString(),
        });
        if (search) params.append('search', search);
        if (os) params.append('os', os);
        if (device_type) params.append('device_type', device_type);
        if (status) params.append('status', status);
        return `devices?${params.toString()}`;
      },
      providesTags: (result) =>
        result?.results?.devices
          ? [
              ...result.results.devices.map(({ uuid }) => ({ type: 'Devices', id: uuid })),
              { type: 'Devices', id: 'LIST' },
            ]
          : [{ type: 'Devices', id: 'LIST' }],
      transformResponse: (response) => ({
        devices:  response.results?.devices || [],
        count:    response.count            || 0,
        next:     response.next,
        previous: response.previous,
      }),
      transformErrorResponse: (response) => ({
        status:  response.status,
        error:   response.data?.error   || 'Failed to fetch devices',
        message: response.data?.message || 'Unable to load device data',
      }),
      keepUnusedDataFor: 60,
    }),


    getDevicesdata: builder.query({
      query: () => 'devicedata',
      providesTags: ['Devices'],
      keepUnusedDataFor: 600,
      transformErrorResponse: (response) => ({
        status:  response.status,
        error:   response.data?.error   || 'Failed to fetch devices',
        message: response.data?.message || 'Unable to load device data',
      }),
    }),


    getAvailableDevicesdata: builder.query({
      query: () => 'available_devices',
      providesTags: ['Devices'],
      keepUnusedDataFor: 600,
      transformErrorResponse: (response) => ({
        status:  response.status,
        error:   response.data?.error   || 'Failed to fetch devices',
        message: response.data?.message || 'Unable to load device data',
      }),
    }),


    getDeviceDetailsById: builder.query({
      query: (uuid) => `device/${uuid}`,
      providesTags: (result, error, uuid) => [
        { type: 'Devices', id: uuid },
        { type: 'Devices', id: 'DETAIL' },
      ],
      transformErrorResponse: (response) => ({
        status:  response.status,
        error:   response.data?.error   || 'Failed to fetch device details',
        message: response.data?.message || 'Unable to load device information',
      }),
    }),


    importDevicesFromCSV: builder.mutation({
      query: ({ csvFile, groupName }) => {
        const formData = new FormData();
        formData.append('csv_file', csvFile);
        if (groupName) formData.append('group_name', groupName);
        return {
          url:    'validate-csv/',
          method: 'POST',
          body:   formData,
          credentials: 'include',
        };
      },
      invalidatesTags: ['Devices'],
      transformResponse: (response) => ({
        ...response,
        importedAt: new Date().toISOString(),
        devices: response.devices?.map((device) => ({
          ...device,
          imported_at: device.imported_at ? new Date(device.imported_at) : new Date(),
          updated_at:  device.updated_at  ? new Date(device.updated_at)  : new Date(),
        })) || [],
      }),
      transformErrorResponse: (response) => ({
        status:  response.status,
        error:   response.data?.error   || 'Failed to import CSV',
        message: response.data?.message || 'Unable to process CSV file',
      }),
    }),


    // === CPU STATS ENDPOINTS ===
    getCpuMinutelyStats: builder.query({
      query: (uuid) => `cpu/${uuid}/stats/minutely/`,
      providesTags: (result, error, uuid) => [
        { type: 'CpuStats', id: uuid },
        { type: 'CpuStats', id: 'MINUTELY' },
      ],
      retry: (failureCount, error) => failureCount < 3 && error.status >= 500,
      keepUnusedDataFor: 60,
      refetchOnMountOrArgChange: true,
    }),

    getCpuHourlyStats: builder.query({
      query: (uuid) => `cpu/${uuid}/stats/hourly/`,
      providesTags: (result, error, uuid) => [
        { type: 'CpuStats', id: uuid },
        { type: 'CpuStats', id: 'HOURLY' },
      ],
      retry: (failureCount, error) => failureCount < 3 && error.status >= 500,
    }),

    getCpuDailyStats: builder.query({
      query: (uuid) => `cpu/${uuid}/stats/daily/`,
      providesTags: (result, error, uuid) => [
        { type: 'CpuStats', id: uuid },
        { type: 'CpuStats', id: 'DAILY' },
      ],
      retry: (failureCount, error) => failureCount < 3 && error.status >= 500,
    }),

    getCpuWeeklyStats: builder.query({
      query: (uuid) => `cpu/${uuid}/stats/weekly/`,
      providesTags: (result, error, uuid) => [
        { type: 'CpuStats', id: uuid },
        { type: 'CpuStats', id: 'WEEKLY' },
      ],
      retry: (failureCount, error) => failureCount < 3 && error.status >= 500,
    }),

    getCpuMonthlyStats: builder.query({
      query: (uuid) => `cpu/${uuid}/stats/monthly/`,
      providesTags: (result, error, uuid) => [
        { type: 'CpuStats', id: uuid },
        { type: 'CpuStats', id: 'MONTHLY' },
      ],
      retry: (failureCount, error) => failureCount < 3 && error.status >= 500,
    }),

    getCpuCustomRangeStats: builder.mutation({
      query: ({ uuid, start_date, end_date, granularity = 'daily' }) => ({
        url:    `cpu/${uuid}/stats/custom-range/`,
        method: 'POST',
        body:   { start_date, end_date, granularity },
      }),
      invalidatesTags: (result, error, { uuid }) => [{ type: 'CpuStats', id: uuid }],
    }),


    // === MEMORY STATS ENDPOINTS ===
    getMemoryMinutelyStats: builder.query({
      query: (agentUuid) => `memory/${agentUuid}/stats/minutely/`,
      providesTags: (result, error, agentUuid) => [
        { type: 'MemoryStats', id: agentUuid },
        { type: 'MemoryStats', id: 'MINUTELY' },
      ],
      retry: (failureCount, error) => failureCount < 3 && error.status >= 500,
      keepUnusedDataFor: 60,
      refetchOnMountOrArgChange: true,
    }),

    getMemoryHourlyStats: builder.query({
      query: (agentUuid) => `memory/${agentUuid}/stats/hourly/`,
      providesTags: (result, error, agentUuid) => [
        { type: 'MemoryStats', id: agentUuid },
        { type: 'MemoryStats', id: 'HOURLY' },
      ],
      retry: (failureCount, error) => failureCount < 3 && error.status >= 500,
    }),

    getMemoryDailyStats: builder.query({
      query: (agentUuid) => `memory/${agentUuid}/stats/daily/`,
      providesTags: (result, error, agentUuid) => [
        { type: 'MemoryStats', id: agentUuid },
        { type: 'MemoryStats', id: 'DAILY' },
      ],
      retry: (failureCount, error) => failureCount < 3 && error.status >= 500,
    }),

    getMemoryWeeklyStats: builder.query({
      query: (agentUuid) => `memory/${agentUuid}/stats/weekly/`,
      providesTags: (result, error, agentUuid) => [
        { type: 'MemoryStats', id: agentUuid },
        { type: 'MemoryStats', id: 'WEEKLY' },
      ],
      retry: (failureCount, error) => failureCount < 3 && error.status >= 500,
    }),

    getMemoryMonthlyStats: builder.query({
      query: (agentUuid) => `memory/${agentUuid}/stats/monthly/`,
      providesTags: (result, error, agentUuid) => [
        { type: 'MemoryStats', id: agentUuid },
        { type: 'MemoryStats', id: 'MONTHLY' },
      ],
      retry: (failureCount, error) => failureCount < 3 && error.status >= 500,
    }),

    getMemoryCustomRangeStats: builder.mutation({
      query: ({ uuid, start_date, end_date, granularity = 'daily' }) => ({
        url:    `memory/${uuid}/stats/custom-range/`,
        method: 'POST',
        body:   { start_date, end_date, granularity },
      }),
      invalidatesTags: (result, error, { uuid }) => [{ type: 'MemoryStats', id: uuid }],
    }),


    // === DISK STATS ENDPOINTS ===
    getDiskMinutelyStats: builder.query({
      query: (uuid) => `disk/${uuid}/stats/minutely/`,
      providesTags: (result, error, uuid) => [
        { type: 'DiskStats', id: uuid },
        { type: 'DiskStats', id: 'MINUTELY' },
      ],
      retry: (failureCount, error) => failureCount < 3 && error.status >= 500,
      keepUnusedDataFor: 60,
      refetchOnMountOrArgChange: true,
    }),

    getDiskHourlyStats: builder.query({
      query: (uuid) => `disk/${uuid}/stats/hourly/`,
      providesTags: (result, error, uuid) => [
        { type: 'DiskStats', id: uuid },
        { type: 'DiskStats', id: 'HOURLY' },
      ],
      retry: (failureCount, error) => failureCount < 3 && error.status >= 500,
    }),

    getDiskDailyStats: builder.query({
      query: (uuid) => `disk/${uuid}/stats/daily/`,
      providesTags: (result, error, uuid) => [
        { type: 'DiskStats', id: uuid },
        { type: 'DiskStats', id: 'DAILY' },
      ],
      retry: (failureCount, error) => failureCount < 3 && error.status >= 500,
    }),

    getDiskWeeklyStats: builder.query({
      query: (uuid) => `disk/${uuid}/stats/weekly/`,
      providesTags: (result, error, uuid) => [
        { type: 'DiskStats', id: uuid },
        { type: 'DiskStats', id: 'WEEKLY' },
      ],
      retry: (failureCount, error) => failureCount < 3 && error.status >= 500,
    }),

    getDiskMonthlyStats: builder.query({
      query: (uuid) => `disk/${uuid}/stats/monthly/`,
      providesTags: (result, error, uuid) => [
        { type: 'DiskStats', id: uuid },
        { type: 'DiskStats', id: 'MONTHLY' },
      ],
      retry: (failureCount, error) => failureCount < 3 && error.status >= 500,
    }),

    getDiskCustomRangeStats: builder.mutation({
      query: ({ uuid, start_date, end_date, granularity = 'daily' }) => ({
        url:    `disk/${uuid}/stats/custom-range/`,
        method: 'POST',
        body:   { start_date, end_date, granularity },
      }),
      invalidatesTags: (result, error, { uuid }) => [{ type: 'DiskStats', id: uuid }],
    }),
  }),
});


/* ================= EXPORTS ================= */
export const {
  // Device hooks
  useGetDevicesQuery,
  useGetDevicesdataQuery,
  useGetDeviceDetailsByIdQuery,
  useGetAvailableDevicesdataQuery,

  // Device management hooks
  useImportDevicesFromCSVMutation,
  // useAssignDevicesToGroupMutation,

  // Group hooks
  // useGetAllGroupsQuery,
  // useDeleteGroupMutation,
  // useSaveGroupConfigurationMutation,

  // CPU hooks
  useGetCpuMinutelyStatsQuery,
  useGetCpuHourlyStatsQuery,
  useGetCpuDailyStatsQuery,
  useGetCpuWeeklyStatsQuery,
  useGetCpuMonthlyStatsQuery,
  useGetCpuCustomRangeStatsMutation,

  // Memory hooks
  useGetMemoryMinutelyStatsQuery,
  useGetMemoryHourlyStatsQuery,
  useGetMemoryDailyStatsQuery,
  useGetMemoryWeeklyStatsQuery,
  useGetMemoryMonthlyStatsQuery,
  useGetMemoryCustomRangeStatsMutation,

  // Disk hooks
  useGetDiskMinutelyStatsQuery,
  useGetDiskHourlyStatsQuery,
  useGetDiskDailyStatsQuery,
  useGetDiskWeeklyStatsQuery,
  useGetDiskMonthlyStatsQuery,
  useGetDiskCustomRangeStatsMutation,
} = apiSlice;


export const {
  updateQueryData,
  invalidateTags,
  resetApiState,
} = apiSlice.util;