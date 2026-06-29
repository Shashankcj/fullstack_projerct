// import React, { useState } from 'react';
// import { Calendar, X } from 'lucide-react';
// import PropTypes from 'prop-types';

// const CustomTimeRangeModal = ({ isDarkMode, onChange, initialRange, onClose }) => {
//   const [startDate, setStartDate] = useState(
//     initialRange.start ? initialRange.start.toISOString().slice(0, 16) : ''
//   );
//   const [endDate, setEndDate] = useState(
//     initialRange.end ? initialRange.end.toISOString().slice(0, 16) : ''
//   );
//   const [error, setError] = useState(null);

//   const handleApply = () => {
//     const start = startDate ? new Date(startDate) : null;
//     const end = endDate ? new Date(endDate) : null;

//     console.log('[CustomTimeRangeModal] User clicked Apply with:', { 
//       startDate, 
//       endDate, 
//       start, 
//       end 
//     });

//     if (start && end && start > end) {
//       setError('Start date must be before end date');
//       return;
//     }
    
//     setError(null);
//     onChange({ start, end });
//     onClose?.();
//   };

//   return (
//     <div
//       className="fixed inset-0 z-[200] flex items-center justify-center bg-black bg-opacity-50"
//       onClick={onClose}
//     >
//       <div
//         className="rounded-xl p-6 max-w-md w-full mx-4 relative shadow-2xl border"
//         style={{
//           background: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(246, 245, 248, 1)',
//           borderColor: isDarkMode ? 'rgba(51, 65, 85, 0.4)' : 'rgba(203, 213, 225, 0.3)',
//         }}
//         onClick={e => e.stopPropagation()}
//       >
//         <button
//           onClick={onClose}
//           className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
//           aria-label="Close"
//         >
//           <X size={20} />
//         </button>

//         <h2
//           className="text-xl font-semibold mb-5 flex items-center gap-2"
//           style={{ color: isDarkMode ? '#F1F5F9' : '#1E293B' }}
//         >
//           <Calendar 
//             size={18} 
//             strokeWidth={2.5} 
//             color={isDarkMode ? '#F8FAFC' : '#1E293B'} 
//           />
//           Select Time Range
//         </h2>

//         {error && (
//           <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200">
//             <p className="text-sm text-red-600">{error}</p>
//           </div>
//         )}

//         <div className="space-y-4 mb-6">
//           <div>
//             <label
//               htmlFor="start-date"
//               className="block text-sm font-medium mb-2"
//               style={{ color: isDarkMode ? '#E2E8F0' : '#334155' }}
//             >
//               Start Date and Time
//             </label>
//             <input
//               id="start-date"
//               type="datetime-local"
//               value={startDate}
//               onChange={e => setStartDate(e.target.value)}
//               className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-blue-500"
//               style={{
//                 background: isDarkMode ? 'rgba(17,24,39,0.3)' : 'rgba(248,250,252,0.8)',
//                 borderColor: isDarkMode ? 'rgba(51, 65, 85, 0.4)' : 'rgba(203, 213, 225, 0.3)',
//                 color: isDarkMode ? '#E2E8F0' : '#334155',
//               }}
//             />
//           </div>
//           <div>
//             <label
//               htmlFor="end-date"
//               className="block text-sm font-medium mb-2"
//               style={{ color: isDarkMode ? '#E2E8F0' : '#334155' }}
//             >
//               End Date and Time
//             </label>
//             <input
//               id="end-date"
//               type="datetime-local"
//               value={endDate}
//               onChange={e => setEndDate(e.target.value)}
//               className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-blue-500"
//               style={{
//                 background: isDarkMode ? 'rgba(17,24,39,0.3)' : 'rgba(248,250,252,0.8)',
//                 borderColor: isDarkMode ? 'rgba(51, 65, 85, 0.4)' : 'rgba(203, 213, 225, 0.3)',
//                 color: isDarkMode ? '#E2E8F0' : '#334155',
//               }}
//             />
//           </div>
//         </div>

//         <div className="flex justify-end gap-3">
//           <button
//             onClick={onClose}
//             className="text-sm font-medium px-4 py-2 rounded-md transition"
//             style={{
//               background: isDarkMode ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)',
//               color: isDarkMode ? '#E2E8F0' : '#334155',
//             }}
//           >
//             Cancel
//           </button>
//           <button
//             onClick={handleApply}
//             className="text-sm font-medium px-4 py-2 rounded-md transition bg-[#6366f1] text-white hover:bg-[#4f46e5]"
//           >
//             Apply
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// CustomTimeRangeModal.propTypes = {
//   isDarkMode: PropTypes.bool,
//   onChange: PropTypes.func.isRequired,
//   initialRange: PropTypes.shape({
//     start: PropTypes.instanceOf(Date),
//     end: PropTypes.instanceOf(Date)
//   }),
//   onClose: PropTypes.func,
// };

// CustomTimeRangeModal.defaultProps = {
//   isDarkMode: false,
//   initialRange: { start: null, end: null },
//   onClose: () => {},
// };

// export default CustomTimeRangeModal;
