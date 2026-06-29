import { useGetServersQuery } from '../../redux/dashboardStatsApi'

const useServers = (filterParams = {}) => {
  const {
    priority,
    page,
    limit,
    search,
    health,
    status, // ← added
  } = filterParams

  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useGetServersQuery(
    {
      priority,
      page,
      page_size: limit,
      search,
      health,
      status, // ← added
    },
    {
      pollingInterval: 10000,
      skipPollingIfUnfocused: true,
      refetchOnMountOrArgChange: true,
    }
  )

  return {
    servers: data?.servers ?? [],
    totalCount: data?.count ?? 0,
    totalPages: data?.total_pages ?? 1,
    isLoading,
    isFetching,
    refetch,
  }
}

export default useServers