import { X } from "lucide-react";

const LicenseBanner = ({message,onClose,isExpired}) => {

  return (
    <div  className={`fixed top-4 right-4 z-[9999] text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-4 ${
        isExpired ? "bg-red-600" : "bg-yellow-500"
      }`}>
      <div>{message}</div>

      <button onClick={onClose} className="hover:opacity-80">
        <X size={18} />
      </button>

    </div>
  );
};

export default LicenseBanner;