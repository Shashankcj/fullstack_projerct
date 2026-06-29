const PageWrapper = ({ children, className = "", isDarkMode }) => (
  <div
    className={`w-full max-w-[1400px] mx-auto p-3 sm:p-4 lg:p-3 ${className}`}
    style={{ backgroundColor: isDarkMode ? "#111827" : "#F0F4FF" }}
  >
    {children}
  </div>
);

export default PageWrapper;