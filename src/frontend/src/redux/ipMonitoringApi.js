// src/redux/ipMonitoringApiSlice.js
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const ipMonitoringApi = createApi({
  reducerPath: "ipMonitoringApi",

  baseQuery: fetchBaseQuery({
    baseUrl: "/api/webapp/v1/",
    credentials: "include",
    prepareHeaders: (headers, { getState }) => {
      const token = getState()?.auth?.token || localStorage.getItem("token");
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),

  tagTypes: ["IPAddress"],

  endpoints: (builder) => ({
    /* ================================
       GET – List all IPs (with pagination)
    ================================= */
    getIPAddresses: builder.query({
  query: (params = {}) => {
    const { page = 1, page_size = 10, search, status,priority } = params;

    const queryParams = new URLSearchParams();
    queryParams.append("page", page);
    queryParams.append("page_size", page_size);

    if (search) {
      queryParams.append("search", search);
    }

    if (status) {
      queryParams.append("status", status);
    }
     if (priority) {
      queryParams.append("priority", priority);
    }

    return `/ip-monitoring/?${queryParams.toString()}`;
  },
      transformResponse: (response) => {

        if (response.results) {
          return {
            data: response.results.map((ip) => ({
              ...ip,
              id: ip.uuid,
            })),
            count: response.count,
            next: response.next,
            previous: response.previous,
          };
        }

        return {
          data: response.map((ip) => ({
            ...ip,
            id: ip.uuid,
          })),
          count: response.length,
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ id }) => ({
                type: "IPAddress",
                id,
              })),
              { type: "IPAddress", id: "LIST" },
            ]
          : [{ type: "IPAddress", id: "LIST" }],
    }),

    /* ================================
       GET – Single IP
    ================================= */
    getIPAddressById: builder.query({
      query: (id) => `/ip-monitoring/${id}/`,
      providesTags: (result, error, id) => [{ type: "IPAddress", id }],
    }),

    /* ================================
       POST – Create IP
    ================================= */
    createIPAddress: builder.mutation({
      query: (payload) => ({
        url: "/ip-monitoring/",
        method: "POST",
        body: payload,
      }),
      invalidatesTags: [{ type: "IPAddress", id: "LIST" }],
    }),

    /* ================================
       POST – CSV Bulk Upload
    ================================= */
    bulkUploadIPs: builder.mutation({
      query: (formData) => ({
        url: "/ip-monitoring/",
        method: "POST",
        body: formData,
        formData: true,
      }),
      invalidatesTags: [{ type: "IPAddress", id: "LIST" }],
    }),

    /* ================================
       PATCH – Single + Bulk Update
       payload:
       - object  → single update
       - array   → bulk update
    ================================= */
    updateIPs: builder.mutation({
      query: (payload) => ({
        url: "/ip-monitoring/",
        method: "PATCH",
        body: payload,
      }),
      invalidatesTags: [{ type: "IPAddress", id: "LIST" }],
    }),

    /* ================================
       DELETE – Single + Bulk Delete
       payload:
       - object  → single delete
       - array   → bulk delete
    ================================= */
    deleteIPs: builder.mutation({
      query: (payload) => ({
        url: "/ip-monitoring/",
        method: "DELETE",
        body: payload,
      }),
      invalidatesTags: [{ type: "IPAddress", id: "LIST" }],
    }),

    /* ================================
       PATCH – Assign Priority (single or bulk)
       payload:
       - { ip_uuid, priority }          → single
       - [{ ip_uuid, priority }, ...]   → bulk
    ================================= */
    assignPriority: builder.mutation({
      query: (payload) => ({
        url: "/ip-monitoring/",
        method: "PATCH",
        body: payload,
      }),
      invalidatesTags: (result, error, payload) => {
        const ids = Array.isArray(payload)
          ? payload.map((item) => item.uuid)
          : [payload.uuid];

        return [
          ...ids.map((id) => ({ type: "IPAddress", id })),
          { type: "IPAddress", id: "LIST" },
        ];
      },
    }),
  }),
});

/* ================================
   Export Hooks
================================= */
export const {
  useGetIPAddressesQuery,
  useGetIPAddressByIdQuery,
  useCreateIPAddressMutation,
  useBulkUploadIPsMutation,
  useUpdateIPsMutation,
  useDeleteIPsMutation,
  useAssignPriorityMutation,
} = ipMonitoringApi;
