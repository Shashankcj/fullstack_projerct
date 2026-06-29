import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const eventLogFilterApi = createApi({
  reducerPath: 'eventLogSlice',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/webapp/v1/',
    prepareHeaders: (headers, { getState }) => {
      // Add auth token if needed
      return headers;
    },
  }),
  tagTypes: ['EventLogs', 'EventFilters'],
  endpoints: (builder) => ({
   
    getEventLogs: builder.query({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        
        // Only add uuid if device_id is provided
        if (params.device_id) {
          queryParams.append('uuid', params.device_id);
        }
        
        if (params.event_type) {
          queryParams.append('event_type', params.event_type);
        }
        
        if (params.component_type) {
          queryParams.append('component_type', params.component_type);
        }
        
        if (params.start_date) {
          queryParams.append('start_date', params.start_date);
        }
        
        if (params.end_date) {
          queryParams.append('end_date', params.end_date);
        }
        
        const queryString = queryParams.toString();
        return `get_eventlogs${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['EventLogs'],
    }),

    // Get filter options for specific device
    getEventLogFilterOptions: builder.query({
      query: (deviceUuid) => ({
        url: 'get_eventlogs_filter_options/',
        params: { 
          uuid: deviceUuid 
        }
      }),
      providesTags: (result, error, deviceUuid) => [
        { type: 'EventFilters', id: deviceUuid }
      ],
    }),
  }),
});

// Auto-generated React hooks
export const {
  useGetEventLogsQuery,
  useGetEventLogFilterOptionsQuery,
} = eventLogFilterApi;

export default eventLogFilterApi;
