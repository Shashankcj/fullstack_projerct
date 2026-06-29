import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const dashboardApi = createApi({
  reducerPath: "dashboardApi",

  baseQuery: fetchBaseQuery({
    baseUrl: "/api/webapp/v1/",
    prepareHeaders: (headers, { getState }) => {
      const token = getState().auth?.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),

  tagTypes: ["Dashboard"],

  endpoints: (builder) => ({
    // ✅ 1. Summary (top cards + donuts)
    getSummary: builder.query({
      query: (priority) => {
        const params = new URLSearchParams();
        if (priority && priority !== "all") {
          params.append("priority", priority);
        }
        const queryString = params.toString();
        return `dashboard/summary/${queryString ? `?${queryString}` : ""}`;
      },
      providesTags: (result, error, priority) => [
        { type: "Dashboard", id: `${priority}-SUMMARY` },
      ],
    }),

    // ✅ 2. Servers table (with pagination)
    getServers: builder.query({
  query: ({
    priority,
    page = 1,
    page_size = 10,
    search = "",
    health = "",
    status = "",
  }) => {
    const params = new URLSearchParams();

    params.append("page", String(page));
    params.append("page_size", String(page_size));

    if (priority && priority !== "all") {
      params.append("priority", priority);
    }

    if (search) {
      params.append("search", search);
    }

    // ← added
    if (health) {
      params.append("health", health);
    }
    if (status) {
      params.append("status", status);
    }

    return `dashboard/servers/?${params.toString()}`;
  },

  providesTags: (result, error, { priority }) => [
    { type: "Dashboard", id: `${priority}-SERVERS` },
  ],
}),
  }),
});

export const {
  useGetSummaryQuery,
  useGetServersQuery,
} = dashboardApi;