import { Formik, Form, Field } from "formik";
import SignValidationSchema from "./SignInValidationSchema";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import backendApi from "../../../../api/backendAxiosInstance";
import { toast } from "react-toastify";
import { useAuth } from "../../../../Contexts/AuthContext";
import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { setPermissions } from "../../../../redux/userModulePermission";
import { useDocumentTitle } from "../../../../Hooks/useDocumentTitle";
import GenesisLogoCard from "../GenesisLogoCard";
import GenesisLogo from "../../../../assets/genesis_logo.png";

/* ================= STATIC CONSTANTS ================= */
const INITIAL_VALUES = { email: "", password: "" };

/* ================= COMPONENT ================= */
const SignIn = () => {
  useDocumentTitle("Sign In");

  const { setAuthenticated } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  /* -------------------- AUTH CHECK ON MOUNT -------------------- */
  useEffect(() => {
    const controller = new AbortController();

    backendApi
      .get("/auth/me", { withCredentials: true, signal: controller.signal })
      .then(() => {
        // ✅ JWT cookie is valid — user is already logged in
        setAuthenticated(true);
        navigate("/dashboard/p1");
      })
      .catch((err) => {
        // 401/403/network error = not logged in or token invalid
        // Expected behavior on signin page → do nothing, stay on signin
        if (err.name === "CanceledError") return;
        setAuthenticated(false);
      });

    return () => controller.abort();
  }, [navigate, setAuthenticated]);



  /* -------------------- SUBMIT HANDLER -------------------- */
  const onSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      const res = await backendApi.post("/signin/", values, {
        withCredentials: true,
      });

      if (res.status === 200) {
        toast.success(res.data.message || "Login successful!");
        setAuthenticated(true);

        try {
          const permResponse = await backendApi.get(
            "/modules/permissions/all",
            { withCredentials: true }
          );
          const perms = permResponse.data.permissions || permResponse.data;
          dispatch(setPermissions(perms));
        } catch (permError) {
          console.error("[SignIn] Failed to fetch permissions:", permError);
          toast.warning("Could not load permissions");
        }

        navigate("/dashboard/p1");
      }
    } catch (error) {

      //  Rate limit — check this FIRST before anything else
      if (error.isRateLimit) {
        toast.error("Too many failed attempts. Please wait 5 minutes and try again.");
        setSubmitting(false);
        return;
      }


      const status = error.response?.status;
      const errorMessage =
        error.response?.data?.error || error.response?.data?.message;

      if (status === 404) {
        toast.warning(errorMessage);
      } else if (status === 401) {
        toast.error(errorMessage);
      } else if (status === 403) {
        toast.warning(
          errorMessage || "Account not verified. Please check your email."
        );
      } else {
        toast.error("Server error. Please try again later.");
      }

      resetForm({
        values: { ...values, password: "" },
        touched: { email: true },
      });
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------- RENDER -------------------- */
  return (
    <div
      className="
    flex min-h-screen
    bg-slate-50 dark:bg-[#0B1120]
    overflow-hidden
    transition-colors duration-300
  "
    >

      {/* ── RIGHT: Blue Brand Panel ── */}
      <div className="hidden md:flex md:w-[50%] min-h-screen relative z-10">
        <GenesisLogoCard />
      </div>

      {/* ── LEFT: White Form Panel ── */}
      <div
        className="
    w-full md:w-[50%]
    flex flex-col items-center justify-center
    bg-white dark:bg-[#111827]
    p-6 relative min-h-screen z-20
    transition-colors duration-300
  "
      >

        {/* Logo — shown on all screen sizes */}
        <div className="flex items-center gap-3 mb-8">
          <img
            src={GenesisLogo}
            alt="Genesis"
            className="w-10 h-10 object-contain flex-shrink-0"
          />

          <div className="flex flex-col justify-center">
            <h1
              className="text-xl font-extrabold text-slate-800 dark:text-white
                 tracking-[0.12em] leading-none"
            >
              GENESIS
            </h1>

            <p
              className="text-xs text-slate-500 dark:text-slate-400 mt-1
                 tracking-[0.04em]"
            >
              Server Monitoring
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div
          className="
    w-full max-w-md
    bg-white dark:bg-[#1E293B]
    border border-slate-200 dark:border-slate-700
    rounded-2xl
    shadow-lg
    p-8
    transition-all duration-300
  "
        >

          <Formik
            initialValues={INITIAL_VALUES}
            validationSchema={SignValidationSchema}
            onSubmit={onSubmit}
          >
            {({ errors, touched, isSubmitting }) => {
              return (
                <Form>

                  {/* Email Field */}
                  <div className="mb-5">
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700
                                 dark:text-gray-300 mb-1.5"
                    >
                      Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      {/* Icon */}
                      <span className="absolute left-3 text-slate-400 pointer-events-none">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                        </svg>
                      </span>
                      <Field
                        type="email"
                        name="email"
                        id="email"
                        placeholder="Enter your email"
                        className={`w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm
                          bg-white dark:bg-gray-700 dark:text-white
                          focus:outline-none focus:ring-2 focus:ring-indigo-400
                          focus:border-indigo-400 transition-all duration-200
                          ${errors.email && touched.email
                            ? "border-red-400 dark:border-red-400"
                            : "border-slate-200 dark:border-gray-600"
                          }`}
                      />
                    </div>
                    {errors.email && touched.email && (
                      <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                    )}

                  </div>

                  {/* Password Field */}                  <div className="mb-6">
                    <label
                      htmlFor="password"
                      className="bg-white dark:bg-slate-800
text-slate-900 dark:text-white
placeholder:text-slate-400
dark:placeholder:text-slate-500"
                    >
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      {/* Icon */}
                      <span className="absolute left-3 text-slate-400 pointer-events-none">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </span>
                      <Field
                        type={showPassword ? "text" : "password"}
                        name="password"
                        id="password"
                        placeholder="Enter your password"
                        className={`w-full pl-10 pr-10 py-2.5 border rounded-lg text-sm
                          bg-white dark:bg-gray-700 dark:text-white focus:outline-none
                          focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400
                          transition-all duration-200
                          ${errors.password && touched.password
                            ? "border-red-400 dark:border-red-400"
                            : "border-slate-200 dark:border-gray-600"
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 flex items-center text-slate-400
                          dark:text-gray-400 hover:text-slate-600 dark:hover:text-white
                          focus:outline-none transition-colors duration-200"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.password && touched.password && (
                      <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full flex items-center justify-center
                      bg-[#6366f1] hover:bg-indigo-600 text-white
                      font-semibold py-3 rounded-lg transition-all duration-200
                      text-sm sm:text-base
                      shadow-[0_2px_8px_rgba(99,102,241,0.35)]
                      hover:shadow-[0_4px_16px_rgba(99,102,241,0.45)]
                      ${isSubmitting ? "opacity-60 cursor-not-allowed" : ""}
                    `}
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Sign In"
                    )}
                  </button>

                  {/* Forgot Password — below the button, matching reference */}
                  <div className="mt-4 text-center">
                    <Link
                      to="/forgot-password"
                      className="text-sm text-indigo-500 hover:text-indigo-700
                        dark:text-indigo-400 dark:hover:text-indigo-300
                        hover:underline transition-colors duration-200"
                    >
                      Forgot Password?
                    </Link>
                  </div>

                </Form>
              );
            }}
          </Formik>
        </div>

      </div>
    </div>
  );
};

export default SignIn;