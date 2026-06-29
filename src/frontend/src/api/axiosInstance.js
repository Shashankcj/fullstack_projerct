// src/api/axiosInstance.js
import axios from "axios";

const api = axios.create({
  baseURL: "/api/webuser/",
  withCredentials: true,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  //  Manually extract and send cookies in headers
  const cookies = document.cookie;
  
  // Extract specific JWT token
  const jwtToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('jwt='))
    ?.split('=')[1];
  console.log(" Extracted JWT token:", jwtToken);
  if (cookies) {
    config.headers['Cookie'] = cookies;
    console.log("Cookies added to Cookie header");
  }
  console.log("🔍 Request headers:", config.headers);
  console.log("🔍 Request cookies:", document.cookie);
  console.log("🔍 Request URL:", config.url);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log("🚫 Response error:", error.response?.data);
    console.log("🚫 Response status:", error.response?.status);
    console.log("🚫 Response headers:", error.response?.headers);
    return Promise.reject(error);
  }
);

export default api;
