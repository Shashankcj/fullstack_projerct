import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';


export const auditLogsApi = createApi({
  reducerPath: 'auditLogsApi',

  baseQuery: fetchBaseQuery({
    baseUrl: '/api/webapp/v1/',
    credentials: 'include',
    // ✅ Fix #6 — added prepareHeaders matching alertFilterApi pattern
    prepareHeaders: (headers, { getState }) => {
      const token = getState()?.auth?.token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),

  tagTypes: ['AuditLog'],

  endpoints: (builder) => ({

    /* ────────────────────────────────────────
       GET AUDIT LOGS (paginated + filtered)
    ──────────────────────────────────────── */
    getAuditLogs: builder.query({
      // ✅ Fix #1 — RTK params object replaces manual URLSearchParams
      query: ({
        page       = 1,
        page_size  = 9,
        user       = '',
        action     = '',
        model_name = '',
        severity   = '',
        start_date = '',
        end_date   = '',
        search     = '',
      } = {}) => ({
        url: 'get_auditlogs/',
        params: {
          page,
          page_size,
          ...(user        && { user }),
          ...(action      && { action }),
          ...(model_name  && { model_name }),
          ...(severity    && { severity_display: severity }),
          ...(start_date  && { start_date }),
          ...(end_date    && { end_date }),
          ...(search      && { search }),
        },
      }),
      providesTags: ['AuditLog'],
      transformResponse: (response) => ({
        audit_logs: response.results?.audit_logs || [],
        count:      response.count               || 0,
        next:       response.next,
        previous:   response.previous,
      }),
    }),


    /* ────────────────────────────────────────
       GET FILTER OPTIONS
    ──────────────────────────────────────── */
    getFilterOptions: builder.query({
      query: () => 'get_filter_options/',
      // ✅ Fix #4 — added providesTags for cache invalidation
      providesTags: [{ type: 'AuditLog', id: 'FILTER_OPTIONS' }],
      transformResponse: (response) => {
        const severities = response.severities
          ? Array.from(new Set(response.severities.map((s) => s.label)))
          : [];
        return {
          users:     response.users     || [],
          actions:   response.actions   || [],
          resources: response.resources || [],
          severities,
        };
      },
    }),


    /* ────────────────────────────────────────
       EXPORT AUDIT LOGS (blob download)
    ──────────────────────────────────────── */
    // ✅ Fix #3 — changed from builder.query to builder.mutation
    //            Downloads should NOT be cached — fire once per click
    // ✅ Fix #2 — RTK params object replaces manual URLSearchParams
    exportAuditLogs: builder.mutation({
      query: ({
        user       = '',
        action     = '',
        model_name = '',
        severity   = '',
        start_date = '',
        end_date   = '',
        search     = '',
      } = {}) => ({
        url:    'audit_logs/download/',
        method: 'GET',
        params: {
          ...(user        && { user }),
          ...(action      && { action }),
          ...(model_name  && { model_name }),
          ...(severity    && { severity_display: severity }),
          ...(start_date  && { start_date }),
          ...(end_date    && { end_date }),
          ...(search      && { search }),
        },
        responseHandler: (response) => response.blob(),
      }),
    }),

  }),
});


/* ================= EXPORTS ================= */
export const {
  useGetAuditLogsQuery,
  useLazyGetFilterOptionsQuery,
  // ✅ Fix #3 — mutation hook replaces lazy query hook
  useExportAuditLogsMutation,
} = auditLogsApi;

// ✅ Fix #8 — added default export
export default auditLogsApi;