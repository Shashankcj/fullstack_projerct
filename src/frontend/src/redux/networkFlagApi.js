import { createApi } from '@reduxjs/toolkit/query/react';
import { fetchBaseQuery } from '@reduxjs/toolkit/query';

export const portFlagApi = createApi({
  reducerPath: 'portFlagApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/webapp/v1/',
    prepareHeaders: (headers, { getState }) => {
      const token = getState().auth?.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['FlaggedPort'],
  endpoints: (builder) => ({

    // Get all flagged port devices with optional filters
    getFlaggedPortDevices: builder.query({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        
        // Add optional query parameters
        if (params.stats) {
          searchParams.append('stats', 'true');
        }
        if (params.port_type) {
          searchParams.append('port_type', params.port_type);
        }
        if (params.logical_type) {
          searchParams.append('logical_type', params.logical_type);
        }
        
        // Add unviewed_only filter if provided
        if (params.unviewed_only !== undefined) {
          searchParams.append('unviewed_only', params.unviewed_only.toString());
        }

        return `flagged_ports/${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      },
      providesTags: ['FlaggedPort'],
    }),

    // Mark port device as viewed/unviewed
    markPortViewed: builder.mutation({
      query: ({ uuid, action = 'mark_viewed' }) => ({
        url: 'flagged_ports/',
        method: 'PATCH',
        body: {
          uuid,
          action, // 'mark_viewed' or 'mark_unviewed'
        },
      }),
      invalidatesTags: ['FlaggedPort'],
      // Optimistic update
      async onQueryStarted({ uuid, action }, { dispatch, queryFulfilled }) {
        // Update all relevant queries optimistically
        const patchResults = [];
        
        // Helper function to update query data
        const updateQueryData = (queryParams) => {
          return dispatch(
            portFlagApi.util.updateQueryData(
              'getFlaggedPortDevices',
              queryParams,
              (draft) => {
                if (draft?.data) {
                  const index = draft.data.findIndex(device => device.uuid === uuid);
                  if (index !== -1) {
                    if (action === 'mark_viewed') {
                      draft.data[index].is_viewed = true;
                      draft.data[index].viewed_at = new Date().toISOString();
                      // Remove from unviewed list if this is an unviewed_only query
                      if (queryParams.unviewed_only) {
                        draft.data.splice(index, 1);
                        draft.count = draft.data.length;
                      }
                    } else {
                      draft.data[index].is_viewed = false;
                      draft.data[index].viewed_at = null;
                    }
                  }
                }
              }
            )
          );
        };

        // Update various query combinations
        patchResults.push(updateQueryData({ unviewed_only: true }));
        patchResults.push(updateQueryData({}));
        patchResults.push(updateQueryData({ port_type: 'physical' }));
        patchResults.push(updateQueryData({ port_type: 'logical' }));
        patchResults.push(updateQueryData({ port_type: 'physical', unviewed_only: true }));
        patchResults.push(updateQueryData({ port_type: 'logical', unviewed_only: true }));

        try {
          await queryFulfilled;
        } catch {
          // Revert optimistic updates on error
          patchResults.forEach(patchResult => patchResult.undo());
        }
      },
    }),

    // Bulk mark multiple port devices as viewed
    bulkMarkPortViewed: builder.mutation({
      query: ({ uuids, action = 'mark_viewed' }) => ({
        url: 'bulk-mark-viewed/',
        method: 'PATCH',
        body: {
          item_type: 'port',
          uuids,
          action,
        },
      }),
      invalidatesTags: ['FlaggedPort'],
      // Optimistic update for bulk operation
      async onQueryStarted({ uuids, action }, { dispatch, queryFulfilled }) {
        const patchResults = [];
        
        // Helper function to update query data for bulk operations
        const updateQueryData = (queryParams) => {
          return dispatch(
            portFlagApi.util.updateQueryData(
              'getFlaggedPortDevices',
              queryParams,
              (draft) => {
                if (draft?.data) {
                  if (action === 'mark_viewed') {
                    if (queryParams.unviewed_only) {
                      // Remove all marked items from unviewed list
                      draft.data = draft.data.filter(device => !uuids.includes(device.uuid));
                      draft.count = draft.data.length;
                    } else {
                      // Update items in all items list
                      draft.data.forEach(device => {
                        if (uuids.includes(device.uuid)) {
                          device.is_viewed = true;
                          device.viewed_at = new Date().toISOString();
                        }
                      });
                    }
                  } else {
                    // Update items for mark_unviewed
                    draft.data.forEach(device => {
                      if (uuids.includes(device.uuid)) {
                        device.is_viewed = false;
                        device.viewed_at = null;
                      }
                    });
                  }
                }
              }
            )
          );
        };

        // Update various query combinations
        patchResults.push(updateQueryData({ unviewed_only: true }));
        patchResults.push(updateQueryData({}));
        patchResults.push(updateQueryData({ port_type: 'physical' }));
        patchResults.push(updateQueryData({ port_type: 'logical' }));
        patchResults.push(updateQueryData({ port_type: 'physical', unviewed_only: true }));
        patchResults.push(updateQueryData({ port_type: 'logical', unviewed_only: true }));

        try {
          await queryFulfilled;
        } catch {
          patchResults.forEach(patchResult => patchResult.undo());
        }
      },
    }),

    // Get flagged port statistics
    getFlaggedPortStats: builder.query({
      query: () => 'flagged_ports/?stats=true',
      providesTags: ['FlaggedPort'],
    }),

    // Get flagged ports by type with optional unviewed filter
    getFlaggedPortsByType: builder.query({
      query: ({ port_type, unviewed_only }) => {
        const searchParams = new URLSearchParams();
        searchParams.append('port_type', port_type);
        
        if (unviewed_only !== undefined) {
          searchParams.append('unviewed_only', unviewed_only.toString());
        }

        return `flagged_ports/?${searchParams.toString()}`;
      },
      providesTags: ['FlaggedPort'],
    }),

    // Get flagged ports by type and logical type with optional unviewed filter
    getFlaggedPortsByTypeAndLogical: builder.query({
      query: ({ port_type, logical_type, unviewed_only }) => {
        const searchParams = new URLSearchParams();
        searchParams.append('port_type', port_type);
        searchParams.append('logical_type', logical_type);
        
        if (unviewed_only !== undefined) {
          searchParams.append('unviewed_only', unviewed_only.toString());
        }

        return `flagged_ports/?${searchParams.toString()}`;
      },
      providesTags: ['FlaggedPort'],
    }),

  }),
});

// Export hooks
export const {
  useGetFlaggedPortDevicesQuery,
  useMarkPortViewedMutation,
  useBulkMarkPortViewedMutation,
  useGetFlaggedPortStatsQuery,
  useGetFlaggedPortsByTypeQuery,
  useGetFlaggedPortsByTypeAndLogicalQuery,
} = portFlagApi;

export const handleWebSocketPortUpdate = (flagData) => (dispatch) => {
  dispatch(portFlagApi.util.invalidateTags(['FlaggedPort']));
};