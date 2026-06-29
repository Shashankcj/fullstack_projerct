import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const storageFlagApi = createApi({
  reducerPath: 'storageFlagApi',
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
  tagTypes: ['FlaggedStorage'],
  endpoints: (builder) => ({

    // Get all flagged storage devices with optional unviewed filter
    getFlaggedStorageDevices: builder.query({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        
        // Add unviewed_only filter if provided
        if (params.unviewed_only !== undefined) {
          searchParams.append('unviewed_only', params.unviewed_only.toString());
        }
        
        // Add stats filter if provided
        if (params.stats !== undefined) {
          searchParams.append('stats', params.stats.toString());
        }
        
        const queryString = searchParams.toString();
        return `flagged_storage_devices/${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['FlaggedStorage'],
    }),

    // Mark storage device as viewed/unviewed
    markStorageViewed: builder.mutation({
      query: ({ uuid, action = 'mark_viewed' }) => ({
        url: 'flagged_storage_devices/',
        method: 'PATCH',
        body: {
          uuid,
          action, // 'mark_viewed' or 'mark_unviewed'
        },
      }),
      invalidatesTags: ['FlaggedStorage'],
      // Optimistic update
      async onQueryStarted({ uuid, action }, { dispatch, queryFulfilled }) {
        // Update all relevant queries optimistically
        const patchResults = [];
        
        // Update the main query (unviewed_only: true)
        const patchResult1 = dispatch(
          storageFlagApi.util.updateQueryData(
            'getFlaggedStorageDevices',
            { unviewed_only: true },
            (draft) => {
              if (draft?.data) {
                const index = draft.data.findIndex(device => device.uuid === uuid);
                if (index !== -1) {
                  if (action === 'mark_viewed') {
                    draft.data[index].is_viewed = true;
                    draft.data[index].viewed_at = new Date().toISOString();
                    // Remove from unviewed list
                    draft.data.splice(index, 1);
                    draft.count = draft.data.length;
                  } else {
                    draft.data[index].is_viewed = false;
                    draft.data[index].viewed_at = null;
                  }
                }
              }
            }
          )
        );
        patchResults.push(patchResult1);

        // Update the all items query (no filter)
        const patchResult2 = dispatch(
          storageFlagApi.util.updateQueryData(
            'getFlaggedStorageDevices',
            {},
            (draft) => {
              if (draft?.data) {
                const index = draft.data.findIndex(device => device.uuid === uuid);
                if (index !== -1) {
                  draft.data[index].is_viewed = action === 'mark_viewed';
                  draft.data[index].viewed_at = action === 'mark_viewed' 
                    ? new Date().toISOString() 
                    : null;
                }
              }
            }
          )
        );
        patchResults.push(patchResult2);

        try {
          await queryFulfilled;
        } catch {
          // Revert optimistic updates on error
          patchResults.forEach(patchResult => patchResult.undo());
        }
      },
    }),

    // Bulk mark multiple storage devices as viewed
    bulkMarkStorageViewed: builder.mutation({
      query: ({ uuids, action = 'mark_viewed' }) => ({
        url: 'bulk-mark-viewed/',
        method: 'PATCH',
        body: {
          item_type: 'storage',
          uuids,
          action,
        },
      }),
      invalidatesTags: ['FlaggedStorage'],
      // Optimistic update for bulk operation
      async onQueryStarted({ uuids, action }, { dispatch, queryFulfilled }) {
        const patchResults = [];
        
        // Update unviewed query
        const patchResult1 = dispatch(
          storageFlagApi.util.updateQueryData(
            'getFlaggedStorageDevices',
            { unviewed_only: true },
            (draft) => {
              if (draft?.data) {
                if (action === 'mark_viewed') {
                  // Remove all marked items from unviewed list
                  draft.data = draft.data.filter(device => !uuids.includes(device.uuid));
                  draft.count = draft.data.length;
                } else {
                  // Update items in unviewed list
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
        patchResults.push(patchResult1);

        // Update all items query
        const patchResult2 = dispatch(
          storageFlagApi.util.updateQueryData(
            'getFlaggedStorageDevices',
            {},
            (draft) => {
              if (draft?.data) {
                draft.data.forEach(device => {
                  if (uuids.includes(device.uuid)) {
                    device.is_viewed = action === 'mark_viewed';
                    device.viewed_at = action === 'mark_viewed' 
                      ? new Date().toISOString() 
                      : null;
                  }
                });
              }
            }
          )
        );
        patchResults.push(patchResult2);

        try {
          await queryFulfilled;
        } catch {
          patchResults.forEach(patchResult => patchResult.undo());
        }
      },
    }),

    // Get flagged storage statistics
    getFlaggedStorageStats: builder.query({
      query: () => 'flagged_storage_devices/?stats=true',
      providesTags: ['FlaggedStorage'],
    }),

  }),
});

// Export hooks
export const {
  useGetFlaggedStorageDevicesQuery,
  useMarkStorageViewedMutation,
  useBulkMarkStorageViewedMutation,
  useGetFlaggedStorageStatsQuery,
} = storageFlagApi;
