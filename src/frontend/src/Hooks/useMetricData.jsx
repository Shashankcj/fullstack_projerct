import { useEffect, useState } from "react";
import backendApi from "../api/backendAxiosInstance";

export const useMetricData = ({
  endpoint,
  refreshInterval,
  defaultValue = [],
  params = {},
}) => {

  const [data, setData] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    let intervalId;

    const fetchData = async () => {
      try {
        setLoading(true);

        const response = await backendApi.get(
          endpoint,
          { params }
        );

        setData(response.data);

      } catch (error) {

        console.error(
          `[useMetricData] ${endpoint}`,
          error.response?.data || error.message
        );

        setData(defaultValue);

      } finally {

        setLoading(false);

      }
    };

    // initial fetch
    fetchData();

    // auto refresh
    if (refreshInterval && refreshInterval > 0) {

      const intervalMs =
        Math.max(refreshInterval, 1) * 60 * 1000;

      intervalId = setInterval(
        fetchData,
        intervalMs
      );
    }

    // cleanup
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };

  }, [
    endpoint,
    refreshInterval,
  ]);

  return {
    data,
    loading,
  };
};