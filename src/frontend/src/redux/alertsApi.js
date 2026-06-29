import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"

export const alertsApi = createApi({
  reducerPath: "alertsApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/webapp/v1/",
    prepareHeaders: (headers, { getState }) => {
      const token = getState().auth?.accessToken
      if (token) headers.set("Authorization", `Bearer ${token}`)
      return headers
    },
  }),
  endpoints: (builder) => ({

    getAlerts: builder.query({
      query: (params) => {
        const q = new URLSearchParams({ page: params.page, page_size: params.page_size })
        if (params.search)    q.append("search",      params.search)
        if (params.device)    q.append("device_name", params.device)
        if (params.priority)  q.append("priority",    params.priority)
        if (params.component) q.append("alert_type",  params.component)
        if (params.severity)  q.append("severity",    params.severity)
        if (params.dateFrom)  q.append("start_date",  params.dateFrom)
        if (params.dateTo)    q.append("end_date",    params.dateTo)
        return `get_alerts?${q.toString()}`
      },
    }),

    getAlertFilterOptions: builder.query({
      query: () => "get_alert_filter_options",
    }),

  }),
})

export const {
  useGetAlertsQuery,
  useLazyGetAlertFilterOptionsQuery,
} = alertsApi