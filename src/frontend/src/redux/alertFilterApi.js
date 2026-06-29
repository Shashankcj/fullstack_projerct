import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const alertFilterApi = createApi({
  reducerPath: 'alertSlice',

  baseQuery: fetchBaseQuery({
    baseUrl: '/api/webapp/v1/',
    prepareHeaders: (headers, { getState }) => {
      const token = getState()?.auth?.token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),

  tagTypes: ['Alerts', 'AlertFilters'],

  endpoints: (builder) => ({

    getAlerts: builder.query({
      query: (params = {}) => ({
        url: 'get_alerts/',
        params: {
          ...(params.device_id  && { uuid:       params.device_id }),
          ...(params.alert_type && { alert_type: params.alert_type }),
          ...(params.severity   && { severity:   params.severity }),
          ...(params.start_date && { start_date: params.start_date }),
          ...(params.end_date   && { end_date:   params.end_date }),
          ...(params.is_read !== undefined && { is_read: params.is_read }),
          page:      params.page     || 1,
          page_size: params.per_page || 50,
        },
      }),
      providesTags: ['Alerts'],
    }),

    getAlertFilterOptions: builder.query({
      query: (deviceUuid) => ({
        url: 'get_alert_filter_options/',
        params: { uuid: deviceUuid },
      }),
      providesTags: (result, error, deviceUuid) => [
        { type: 'AlertFilters', id: deviceUuid },
      ],
    }),

    markAlertAsRead: builder.mutation({
      query: (alertId) => ({
        url: 'alerts/mark_read/',
        method: 'PATCH',
        body: { uuid: alertId },
      }),
      invalidatesTags: (result, error, alertId) => [
        'Alerts',                                          
        { type: 'Alerts', id: `unread-${alertId}` },  
      ],
    }),

    getUnreadCount: builder.query({
      query: (deviceId) => ({
        url: 'alerts/unread_count/',
        params: { uuid: deviceId },
      }),
      providesTags: (result, error, deviceId) => [
        { type: 'Alerts', id: `unread-${deviceId}` },
      ],
    }),

    markAllAlertsAsRead: builder.mutation({
      query: (deviceUuid = null) => ({
        url: 'alerts/mark_all_read/',
        method: 'PATCH',
        params: deviceUuid ? { uuid: deviceUuid } : {}, 
        body: {},
      }),
      invalidatesTags: (result, error, deviceUuid) => [
        'Alerts',                                            
        { type: 'Alerts', id: `unread-${deviceUuid}` },   
      ],
    }),

  }),
});

export const {
  useGetAlertsQuery,
  useGetAlertFilterOptionsQuery,
  useMarkAlertAsReadMutation,
  useMarkAllAlertsAsReadMutation,
  useGetUnreadCountQuery,
} = alertFilterApi;

export default alertFilterApi;