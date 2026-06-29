import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const jobsApi = createApi({
  reducerPath: "jobsApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/webapp/v1/",
    credentials: "include",
  }),
  tagTypes: ["Job"],
  endpoints: (builder) => ({
    getJobs: builder.query({
      query: ({
        page = 1,
        page_size = 10,
        user = "",
        action = "",
        job_type = "",
        result = "",  
        start_date = "",
        end_date = "",
        search = "",
      } = {}) => {
        const params = new URLSearchParams();

        params.append("page", page);
        params.append("page_size", page_size);
        if (user) params.append("user", user);
        if (action) params.append("action", action);
        if (job_type) params.append("job_type", job_type);
        if (result) params.append("result", result); 
        if (start_date) params.append("start_date", start_date);
        if (end_date) params.append("end_date", end_date);
        if (search) params.append("search", search);

        return `get_jobs/?${params.toString()}`;
      },
      providesTags: ["Job"],
      transformResponse: (response) => ({
        jobs: response.results?.jobs || [],
        count: response.count || 0,
        next: response.next,
        previous: response.previous,
      }),
    }),

    getJobFilterOptions: builder.query({
      query: () => "get_jobs_filter_options/",
      transformResponse: (response) => ({
        users: response.user || [],      
        job_types: response.job_type || [], 
        results: response.result || [],   
      }),
    }),

    exportJobs: builder.query({
      query: ({ job_uuid } = {}) => {
        if (job_uuid) {
          return {
            url: `jobs/${job_uuid}/download/`, 
            responseHandler: (response) => response.blob(),
          };
        }
        // Fallback
        return {
          url: "jobs/download/",
          responseHandler: (response) => response.blob(),
        };
      },
    }),
  }),
});

export const {
  useGetJobsQuery,
  useLazyGetJobFilterOptionsQuery,
  useLazyExportJobsQuery,
} = jobsApi;
