// import React, { useState } from 'react';
// import { useNavigate, useLocation } from 'react-router-dom';
// import {
//   ShieldCheckIcon,
//   MagnifyingGlassIcon,
//   PlusIcon,
//   UserIcon,
//   ArrowPathIcon,
//   ArrowLeftIcon,
//   ChevronLeftIcon,
//   CogIcon,
//   UserGroupIcon,
//   CheckIcon
// } from '@heroicons/react/24/outline';
// import { Plus, Users } from 'lucide-react';
// import { toast } from 'react-toastify';
// import "../index.css"; // For custom scrollbar
// import { useGetUsersQuery } from '../../redux/userApiSlice';
// import { useAuth } from '../../Contexts/AuthContext';
// import { RoleDropdown } from './RoleDropdown';

// const PermissionManagement = ({ isDarkMode = false, }) => {
//   const { user } = useAuth();
//   const { data, error, isLoading } = useGetUsersQuery();
//   const navigate = useNavigate();
//   const location = useLocation();

//   const [searchTerm, setSearchTerm] = useState('');
//   const [selectedRole, setSelectedRole] = useState('all');
//   const [loading, setLoading] = useState(false);

//   // ✅ Bulk selection state
//   const [selectedUsers, setSelectedUsers] = useState(new Set());
//   const [bulkMode, setBulkMode] = useState(false);

//   // ✅ Dynamic role options from backend data
//   const roleOptions = React.useMemo(() => {
//     if (!data || data.length === 0) return [];

//     const uniqueRoles = [...new Set(data.map(user => user.role))];
//     return uniqueRoles.map(role => ({
//       value: role,
//       label: role.charAt(0).toUpperCase() + role.slice(1)
//     })).sort((a, b) => a.label.localeCompare(b.label));
//   }, [data]);

//   // ✅ Handle back navigation
//   let returnTo = '/profile';
//   const handleBackClick = () => {
//     console.log('Navigating back to:', returnTo);

//     if (returnTo == '/profile') {
//       navigate(returnTo);
//     } else if (window.history.length > 1) {
//       navigate(-1);
//     } else {
//       navigate('/profile');
//     }
//   };

//   // ✅ User filtering logic with role hierarchy
//   const filteredUsers = (data ?? []).filter(rowUser => {
//     if (rowUser.id === user?.id) return false;

//     const getRoleLevel = (role) => {
//       const roleLevels = {
//         'admin': 1,
//         'manager': 2,
//         'supervisor': 3,
//         'consultant': 4,
//         'user': 5,
//         'trainee': 6,
//         'operator': 7,
//         'viewer': 8
//       };
//       return roleLevels[role] || 4;
//     };

//     const currentUserLevel = getRoleLevel(user?.role);
//     const targetUserLevel = getRoleLevel(rowUser.role);

//     if (user?.role === 'admin') {
//       return rowUser.role !== 'admin';
//     }

//     if (targetUserLevel > currentUserLevel) {
//       return true;
//     }

//     if (targetUserLevel === currentUserLevel && rowUser.id !== user.id) {
//       return true;
//     }
//     return false;
//   }).filter(rowUser => {
//     if (searchTerm && !rowUser.username.toLowerCase().includes(searchTerm.toLowerCase()) &&
//       !rowUser.email.toLowerCase().includes(searchTerm.toLowerCase())) {
//       return false;
//     }
//     if (selectedRole !== 'all' && rowUser.role !== selectedRole) {
//       return false;
//     }
//     return true;
//   });

//   // ✅ Bulk selection handlers
//   const toggleBulkMode = () => {
//     setBulkMode(!bulkMode);
//     setSelectedUsers(new Set()); // Clear selection when toggling mode
//   };

//   const toggleUserSelection = (userId) => {
//     const newSelection = new Set(selectedUsers);
//     if (newSelection.has(userId)) {
//       newSelection.delete(userId);
//     } else {
//       newSelection.add(userId);
//     }
//     setSelectedUsers(newSelection);
//   };

//   const selectAllUsers = () => {
//     const allUserIds = filteredUsers.map(u => u.id);
//     setSelectedUsers(new Set(allUserIds));
//   };

//   const selectUsersByRole = (role) => {
//     const roleUserIds = filteredUsers.filter(u => u.role === role).map(u => u.id);
//     setSelectedUsers(new Set(roleUserIds));
//   };

//   const clearSelection = () => {
//     setSelectedUsers(new Set());
//   };

//   const getRoleBadgeColor = (role) => {
//     switch (role?.toLowerCase()) {
//       case "admin":
//         return isDarkMode ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800";
//       case "manager":
//         return isDarkMode ? "bg-yellow-900 text-yellow-300" : "bg-yellow-100 text-yellow-800";
//       case "operator":
//         return isDarkMode ? "bg-blue-900 text-blue-300" : "bg-blue-100 text-blue-800";
//       case "viewer":
//         return isDarkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-800";
//       default:
//         return isDarkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-800";
//     }
//   };

//   const getStatusBadgeColor = (isActive) => {
//     return isActive
//       ? isDarkMode ? "bg-green-900 text-green-300" : "bg-green-100 text-green-800"
//       : isDarkMode ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800";
//   };

//   // ✅ Enhanced formatDate function to handle null values specifically for last_login
//   const formatDate = (dateString) => {
//     if (!dateString || dateString === null || dateString === undefined) {
//       return null;
//     }

//     try {
//       const date = new Date(dateString);

//       if (isNaN(date.getTime())) {
//         return 'Invalid Date';
//       }

//       return date.toLocaleDateString("en-US", {
//         year: "numeric",
//         month: "short",
//         day: "numeric",
//         hour: "2-digit",
//         minute: "2-digit",
//       });
//     } catch (error) {
//       console.error('Date formatting error:', error);
//       return 'Invalid Date';
//     }
//   };

//   // ✅ Navigate to single user permissions page
//   const handlePermissionClick = (selectedUser) => {
//     navigate(`/profile/permissions/setpermissions`, {
//       state: {
//         user: selectedUser,
//         returnTo: location.pathname
//       }
//     });
//   };

//   // ✅ Navigate to bulk permissions page
//   const handleBulkPermissionClick = () => {
//     if (selectedUsers.size === 0) {
//       toast.warning('Please select at least one user');
//       return;
//     }

//     const usersToManage = filteredUsers.filter(u => selectedUsers.has(u.id));

//     navigate(`/profile/permissions/setpermissions`, {
//       state: {
//         users: usersToManage,
//         returnTo: location.pathname
//       }
//     });
//   };

//   // ✅ Get role count for quick selection buttons
//   const getRoleCount = (role) => {
//     return filteredUsers.filter(u => u.role === role).length;
//   };

//   return (
//     <>
//       {/* Header with Search, Filters and Bulk Actions */}
//       <div className="flex flex-col space-y-3 mb-4">
//         {/* First Row - Title and Bulk Toggle */}
//         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
//           <div className="flex items-center space-x-2">
//             <ShieldCheckIcon className="w-5 h-5" style={{ color: isDarkMode ? "#60A5FA" : "#3B82F6" }} />
//             <h2
//               className="text-lg font-semibold"
//               style={{ color: isDarkMode ? "#FFF" : "#111827" }}
//             >
//               User Permission Management
//             </h2>
//             <span
//               className="text-sm font-medium px-2.5 py-0.5 rounded-full"
//               style={{
//                 backgroundColor: isDarkMode ? "#1E40AF" : "#DBEAFE",
//                 color: isDarkMode ? "#93C5FD" : "#1E40AF",
//               }}
//             >
//               {filteredUsers.length} users
//             </span>
//           </div>

//           {/* ✅ Bulk Mode Toggle */}
//           <div className="flex items-center space-x-3">
//             <button
//               onClick={toggleBulkMode}
//               className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ml-4 ${bulkMode
//                   ? isDarkMode
//                     ? 'bg-[#6366F1] text-white hover:bg-[#6366F1]/50'
//                     : 'bg-[#6366F1] text-white hover:bg-[#6366F1]/50'
//                   : isDarkMode
//                     ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
//                     : 'bg-gray-200 text-gray-700 hover:bg-gray-300 border border-gray-300'
//                 }`}
//             >
//               <UserGroupIcon className="w-4 h-4 mr-2" />
//               {bulkMode ? 'Exit Bulk Mode' : 'Bulk Mode'}
//             </button>

//             {bulkMode && selectedUsers.size > 0 && (
//               <button
//                 onClick={handleBulkPermissionClick}
//                 className="inline-flex items-center px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-all duration-200"
//               >
//                 <Users className="w-4 h-4 mr-2" />
//                 Manage {selectedUsers.size} Users
//               </button>
//             )}
//           </div>
//         </div>

//         {/* Second Row - Search and Filters */}
//         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
//           <div className="flex items-center space-x-4">
//             <div className="relative">
//               <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
//               <input
//                 type="text"
//                 placeholder="Search users..."
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//                 className={`pl-8 pr-3 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode
//                   ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
//                   : "bg-white border-gray-300 text-gray-900"
//                   }`}
//               />
//             </div>
            
//             {/* ✅ REPLACE SELECT WITH STYLED DROPDOWN */}
//             <RoleDropdown
//               roleOptions={roleOptions}
//               selectedRole={selectedRole}
//               setSelectedRole={setSelectedRole}
//               isDarkMode={isDarkMode}
//             />
//           </div>

//           {/* ✅ Bulk Selection Controls */}
//           {bulkMode && (
//             <div className="flex items-center space-x-2">
//               <button
//                 onClick={selectAllUsers}
//                 className={`px-3 py-1 text-xs rounded transition-colors ${isDarkMode
//                     ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
//                     : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
//                   }`}
//               >
//                 Select All ({filteredUsers.length})
//               </button>

//               {roleOptions.map((role) => {
//                 const count = getRoleCount(role.value);
//                 return count > 0 ? (
//                   <button
//                     key={role.value}
//                     onClick={() => selectUsersByRole(role.value)}
//                     className={`px-2 py-1 text-xs rounded transition-colors ${isDarkMode
//                         ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50'
//                         : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
//                       }`}
//                   >
//                     {role.label}s ({count})
//                   </button>
//                 ) : null;
//               })}

//               {selectedUsers.size > 0 && (
//                 <button
//                   onClick={clearSelection}
//                   className={`px-3 py-1 text-xs rounded transition-colors ${isDarkMode
//                       ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
//                       : 'bg-red-100 text-red-700 hover:bg-red-200'
//                     }`}
//                 >
//                   Clear ({selectedUsers.size})
//                 </button>
//               )}
//             </div>
//           )}
//         </div>
//       </div>

//       {/* ✅ Table with fixed height*/}
//       <div
//         className="rounded-lg shadow border overflow-hidden"
//         style={{
//           backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
//           borderColor: isDarkMode ? "#374151" : "#E5E7EB",
//         }}
//       >
//         {filteredUsers.length === 0 ? (
//           <div className="text-center py-6">
//             <UserIcon
//               className="mx-auto h-12 w-12"
//               style={{ color: isDarkMode ? "#6B7280" : "#9CA3AF" }}
//             />
//             <h3
//               className="mt-2 text-sm font-medium"
//               style={{ color: isDarkMode ? "#FFF" : "#111827" }}
//             >
//               No users found
//             </h3>
//             <p
//               className="mt-1 text-sm"
//               style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
//             >
//               {searchTerm || selectedRole !== "all"
//                 ? "Try adjusting your search or filter criteria"
//                 : "No users available"}
//             </p>
//           </div>
//         ) : (
//           <div className="relative overflow-auto custom-scroll" style={{ maxHeight: "330px" }}>
//             <table className="min-w-full table-fixed">
//               {/* ✅ Sticky Header */}
//               <thead
//                 className="sticky top-0 z-10"
//                 style={{ backgroundColor: isDarkMode ? "#111827" : "#F9FAFB" }}
//               >
//                 <tr>
//                   {/* ✅ Bulk Selection Column */}
//                   {bulkMode && (
//                     <th
//                       className="w-12 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
//                       style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
//                     >
//                       <input
//                         type="checkbox"
//                         checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
//                         onChange={() => {
//                           if (selectedUsers.size === filteredUsers.length) {
//                             clearSelection();
//                           } else {
//                             selectAllUsers();
//                           }
//                         }}
//                         className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
//                       />
//                     </th>
//                   )}
//                   <th
//                     className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${bulkMode ? 'w-1/4' : 'w-1/3'}`}
//                     style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
//                   >
//                     User
//                   </th>
//                   <th
//                     className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${bulkMode ? 'w-1/6' : 'w-1/6'}`}
//                     style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
//                   >
//                     Role
//                   </th>
//                   <th
//                     className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${bulkMode ? 'w-1/8' : 'w-1/8'}`}
//                     style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
//                   >
//                     Status
//                   </th>
//                   <th
//                     className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${bulkMode ? 'w-1/4' : 'w-1/4'}`}
//                     style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
//                   >
//                     Last Login
//                   </th>
//                   <th
//                     className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${bulkMode ? 'w-1/6' : 'w-1/6'}`}
//                     style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
//                   >
//                     Joined
//                   </th>
//                   {/* ✅ Conditional Permissions Column - Truncated in Bulk Mode */}
//                   <th
//                     className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${bulkMode ? 'w-16' : 'w-20'}`}
//                     style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
//                   >
//                     {bulkMode ? 'Perm' : 'Permissions'}
//                   </th>
//                 </tr>
//               </thead>

//               {/* Table Body */}
//               <tbody
//                 style={{
//                   backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
//                 }}
//               >
//                 {filteredUsers.map((user, index) => (
//                   <tr
//                     key={user.id}
//                     className={`transition-colors ${selectedUsers.has(user.id) && bulkMode
//                         ? isDarkMode
//                           ? 'bg-blue-900/20'
//                           : 'bg-blue-50'
//                         : 'hover:bg-opacity-50'
//                       }`}
//                     style={{
//                       backgroundColor:
//                         selectedUsers.has(user.id) && bulkMode
//                           ? isDarkMode
//                             ? "#1E3A8A20"
//                             : "#DBEAFE"
//                           : index % 2 === 0
//                             ? isDarkMode
//                               ? "#1F2937"
//                               : "#FFFFFF"
//                             : isDarkMode
//                               ? "#111827"
//                               : "#F9FAFB",
//                     }}
//                     onMouseEnter={(e) => {
//                       if (!bulkMode || !selectedUsers.has(user.id)) {
//                         e.currentTarget.style.backgroundColor = isDarkMode
//                           ? "#374151"
//                           : "#F3F4F6";
//                       }
//                     }}
//                     onMouseLeave={(e) => {
//                       e.currentTarget.style.backgroundColor =
//                         selectedUsers.has(user.id) && bulkMode
//                           ? isDarkMode
//                             ? "#1E3A8A20"
//                             : "#DBEAFE"
//                           : index % 2 === 0
//                             ? isDarkMode
//                               ? "#1F2937"
//                               : "#FFFFFF"
//                             : isDarkMode
//                               ? "#111827"
//                               : "#F9FAFB";
//                     }}
//                   >
//                     {/* Bulk Selection Checkbox */}
//                     {bulkMode && (
//                       <td className="w-12 px-4 py-1.5 whitespace-nowrap">
//                         <input
//                           type="checkbox"
//                           checked={selectedUsers.has(user.id)}
//                           onChange={() => toggleUserSelection(user.id)}
//                           className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
//                         />
//                       </td>
//                     )}

//                     <td className={`px-6 py-1.5 ${bulkMode ? 'w-1/4' : 'w-1/3'}`}>
//                       <div className="flex items-center space-x-3">
//                         {/* <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
//                           <UserIcon className="w-4 h-4" />
//                         </div> */}
//                         <div className="min-w-0 flex-1">
//                           <div
//                             className="text-sm font-medium truncate"
//                             style={{ color: isDarkMode ? "#F9FAFB" : "#111827" }}
//                           >
//                             {user.username}
//                           </div>
//                           <div
//                             className="text-xs truncate"
//                             style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
//                           >
//                             {user.email}
//                           </div>
//                         </div>
//                       </div>
//                     </td>

//                     <td className={`px-6 py-1.5 whitespace-nowrap ${bulkMode ? 'w-1/6' : 'w-1/6'}`}>
//                       <span
//                         className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
//                           user.role
//                         )}`}
//                       >
//                         {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
//                       </span>
//                     </td>

//                     <td className={`px-6 py-1.5 whitespace-nowrap ${bulkMode ? 'w-1/8' : 'w-1/8'}`}>
//                       <span
//                         className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(
//                           user.is_currently_logged_in
//                         )}`}
//                       >
//                         {user.is_currently_logged_in ? "Active" : "Inactive"}
//                       </span>
//                     </td>

//                     {/* Last Login column */}
//                     <td className={`px-6 py-1.5 text-sm ${bulkMode ? 'w-1/4' : 'w-1/4'}`}>
//                       {user.last_login ? (
//                         <span 
//                           className="truncate block"
//                           style={{ color: isDarkMode ? "#D1D5DB" : "#6B7280" }}
//                         >
//                           {formatDate(user.last_login)}
//                         </span>
//                       ) : (
//                         <span
//                           className="italic truncate block"
//                           style={{ color: isDarkMode ? "#9CA3AF" : "#9CA3AF" }}
//                         >
//                           Never logged in
//                         </span>
//                       )}
//                     </td>

//                     <td
//                       className={`px-6 py-1.5 text-sm ${bulkMode ? 'w-1/6' : 'w-1/6'}`}
//                       style={{ color: isDarkMode ? "#D1D5DB" : "#6B7280" }}
//                     >
//                       <span className="truncate block">
//                         {user.date_joined ? formatDate(user.date_joined) : 'N/A'}
//                       </span>
//                     </td>

//                     {/* Permissions Column */}
//                     <td className={`px-6 py-1.5 text-sm font-medium ${bulkMode ? 'w-16' : 'w-20'}`}>
//                       <div className="flex items-center space-x-2">
//                         <button
//                           onClick={() => handlePermissionClick(user)}
//                           className={`inline-flex items-center transition-all duration-200 ${bulkMode 
//                             ? 'px-1 py-1' 
//                             : 'px-3 py-1.5'
//                           } text-xs ${isDarkMode
//                             ? "text-blue-400 hover:text-blue-300"
//                             : "text-blue-600 hover:text-blue-800"
//                             }`}
//                           title="Manage User Permissions"
//                         >
//                           <Plus className={`${bulkMode ? 'w-3 h-3' : 'w-4 h-4 mr-1.5'}`} />
//                         </button>
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </div>

//       {/* Back Button */}
//       <div className="flex justify-end mt-4">
//         <button
//           onClick={handleBackClick}
//           className="flex items-center space-x-2 px-4 py-1 bg-[#6366F1] hover:bg-[#6366F1]/50 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
//           title="Go back to previous page"
//         >
//           <ArrowLeftIcon className="w-4 h-3" />
//           <span className="text-sm font-medium">Back</span>
//         </button>
//       </div>

//       {/* ✅ Custom Scrollbar CSS */}
//       <style jsx>{`
//         .custom-scroll::-webkit-scrollbar {
//           width: 6px;
//           height: 6px;
//         }
//         .custom-scroll::-webkit-scrollbar-track {
//           background: ${isDarkMode ? '#374151' : '#F3F4F6'};
//           border-radius: 3px;
//         }
//         .custom-scroll::-webkit-scrollbar-thumb {
//           background: ${isDarkMode ? '#6B7280' : '#D1D5DB'};
//           border-radius: 3px;
//         }
//         .custom-scroll::-webkit-scrollbar-thumb:hover {
//           background: ${isDarkMode ? '#9CA3AF' : '#9CA3AF'};
//         }
//       `}</style>
//     </>
//   );
// };

// export default PermissionManagement;
