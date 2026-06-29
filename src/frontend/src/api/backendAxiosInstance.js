// backendAxiosInstance.js
import axios from 'axios';

const backendApi = axios.create({
    baseURL: '/api/webapp/v1/',
    
    // CRITICAL: This tells the browser to send the HttpOnly 'jwt' cookie automatically
    withCredentials: true 
});
// ── Response Interceptor ──────────────────────────────────────
backendApi.interceptors.response.use(

    (response) => response,  // ✅ success — pass through untouched

    (error) => {
        const status = error.response?.status;
        const url = error.config?.url || '';

        // 401 — token expired or invalid → force re-login
        if (status === 401) {
            if (!window.location.pathname.includes('/signin')) {
                window.location.href = '/signin';  // full reload clears React state too
            }
        }

        // 403 — forbidden; but /auth/me and /get/logged-in-user-details/ are auth checks
        // Only redirect if it's NOT an auth validation endpoint
        if (status === 403 && !url.includes('auth/me') && !url.includes('logged-in-user-details')) {
            if (!window.location.pathname.includes('/signin')) {
                window.location.href = '/signin';
            }
        }

        // 429 — rate limit hit → mark it so SignIn.jsx can show specific message
        if (status === 429) {
            return Promise.reject({
                ...error,
                isRateLimit: true,
                message: "Too many attempts. Please wait 5 minutes."
            });
        }

        // everything else — pass the error through normally
        return Promise.reject(error);
    }
);

export default backendApi;


