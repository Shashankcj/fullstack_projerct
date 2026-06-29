import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import backendApi from "../../../../api/backendAxiosInstance";
import { toast } from "react-toastify";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";


const EmailVerification = () => {
  const { token } = useParams();
  const navigate  = useNavigate();

  const [status, setStatus]   = useState("loading");
  const [message, setMessage] = useState("");


  useEffect(() => {

    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link.");
      return;
    }

    const controller  = new AbortController(); 
    let redirectTimer;                     

    const verifyEmail = async () => {
      try {
        const res = await backendApi.get(
          `/register/verify-email/${token}`,
          { signal: controller.signal }      
        );

        const msg = res.data.message || "Email verified successfully.";
        setStatus("success");
        setMessage(msg);
        toast.success(msg);

        redirectTimer = setTimeout(() => navigate("/signin"), 3000);

      } catch (error) {
        if (error.name === "CanceledError") return;

        const msg = error.response?.data?.error || "Verification failed.";
        setStatus("error");
        setMessage(msg);
        toast.error(msg);
      }
    };

    verifyEmail();

    return () => {
      controller.abort();
      clearTimeout(redirectTimer);
    };
  }, [token, navigate]);


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">

        {/* Loading */}
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-500" />
            <p className="mt-4 text-gray-700 text-lg font-medium">
              Verifying your email...
            </p>
          </>
        )}

        {/* Success */}
        {status === "success" && (
          <>
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="mt-4 text-2xl font-semibold text-green-700">
              Success!
            </h2>
            <p className="mt-2 text-gray-600">{message}</p>
            <p className="text-sm text-gray-400 mt-1">
              Redirecting to login in 3 seconds...
            </p>
          </>
        )}

        {/* Error */}
        {status === "error" && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="mt-4 text-2xl font-semibold text-red-700">
              Verification Failed
            </h2>
            <p className="mt-2 text-gray-600">{message}</p>
            <button
              onClick={() => navigate("/signin")}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
            >
              Back to Sign In
            </button>
          </>
        )}

      </div>
    </div>
  );
};

export default EmailVerification;