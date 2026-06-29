// import React, { useState, useEffect } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import {
//   Users, Settings, Monitor, AlertTriangle, Shield,
//   Plus, Minus, Check, Save, ChevronDown, ChevronRight, Key,
//   Server, FileText, Cog
// } from 'lucide-react';
// import { ArrowLeftIcon as HeroArrowLeft, ShieldCheckIcon, UserGroupIcon } from '@heroicons/react/24/outline';
// import { toast } from 'react-toastify';
// import {
//   useGetUserPermissionsQuery,
//   useGetAvailablePermissionsQuery,
//   useUpdateUserPermissionsMutation
// } from '../../redux/permissionApiSlice';
// import "../index.css";

// const UserPermissionsPage = ({ isDarkMode = false }) => {
//   console.log('=== UserPermissionsPage Debug Start ===');
  
//   const [expandedCategories, setExpandedCategories] = useState(new Set());
//   const [userPermissions, setUserPermissions] = useState(new Set());
//   const [initialPermissions, setInitialPermissions] = useState(new Set());
//   const [hasChanges, setHasChanges] = useState(false);
  
//   // ✅ New state for bulk mode
  
//   const location = useLocation();
//   const navigate = useNavigate();
  
//   // ✅ Enhanced data extraction to handle both individual and bulk
//   const rawData = location.state;
//   console.log('Raw location state:', rawData);
  
//   let user = null;
//   let users = [];
//   let returnTo = '/profile/permissions';
//   let isBulkMode = false;
  
//   if (rawData) {
//     // ✅ Check for bulk mode (multiple users)
//     if (rawData.users && Array.isArray(rawData.users)) {
//       users = rawData.users;
//       isBulkMode = true;
//       returnTo = rawData.returnTo || '/profile/permissions';
//       console.log('Using bulk mode with users:', users);
//     }
//     // ✅ Individual mode (single user)
//     else if (rawData.user) {
//       user = rawData.user;
//       users = [user]; // Normalize to array for consistent handling
//       returnTo = rawData.returnTo || '/profile/permissions';
//       console.log('Using individual mode with user:', user);
//     }
//     // ✅ Backward compatibility - direct user object
//     else if (rawData.id) {
//       user = rawData;
//       users = [user];
//       console.log('Using direct user object:', user);
//     }
//   }

//   console.log('Final extracted data:', { user, users, isBulkMode, returnTo });

//   // ✅ For individual mode, use the first (and only) user
//   const primaryUser = users[0];
//   const userId = primaryUser?.id;

//   // ✅ API queries - skip user permissions query in bulk mode since we're not loading existing permissions
//   const {
//     data: userPermissionData,
//     isLoading: isLoadingUserPerms,
//     error: userPermsError,
//     refetch: refetchUserPerms
//   } = useGetUserPermissionsQuery(userId, {
//     skip: !userId || isBulkMode // Skip in bulk mode
//   });

//   const {
//     data: availablePermissions,
//     isLoading: isLoadingAvailable,
//     error: availableError,
//   } = useGetAvailablePermissionsQuery();

//   const [updateUserPermissions, { isLoading: isUpdating }] = useUpdateUserPermissionsMutation();

//   console.log('=== API Data Debug ===');
//   console.log('User Permission Data:', userPermissionData);
//   console.log('Available Permissions:', availablePermissions);

//   // ✅ Updated navigation handlers
//   const handleBackClick = () => {
//     if (hasChanges) {
//       const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to leave?');
//       if (!confirmLeave) return;
//     }
    
//     console.log('Navigating back to:', returnTo);
    
//     if (returnTo && returnTo !== '/profile/permissions/setpermissions') {
//       navigate(returnTo);
//     } else if (window.history.length > 1) {
//       navigate(-1);
//     } else {
//       navigate('/profile');
//     }
//   };

//   const handleCancel = () => {
//     handleBackClick();
//   };

//   // ✅ Helper functions for category styling (same as before)
//   const getCategoryConfig = (categoryKey) => {
//     const configs = {
//       'user_management': {
//         title: 'User Management',
//         icon: <Users className="w-5 h-5" />,
//         color: '#EF4444',
//         description: 'Control user account operations and permissions'
//       },
//       'group_management': {
//         title: 'Group Management',
//         icon: <Settings className="w-5 h-5" />,
//         color: '#3B82F6',
//         description: 'Manage device groups and assignments'
//       },
//       'device_management': {
//         title: 'Device Management',
//         icon: <Monitor className="w-5 h-5" />,
//         color: '#10B981',
//         description: 'Control device operations and monitoring'
//       },
//       'alerts': {
//         title: 'Alert Management',
//         icon: <AlertTriangle className="w-5 h-5" />,
//         color: '#F59E0B',
//         description: 'Configure alert settings and notifications'
//       },
//       'monitoring': {
//         title: 'Monitoring',
//         icon: <Shield className="w-5 h-5" />,
//         color: '#8B5CF6',
//         description: 'Access monitoring dashboards and system data'
//       },
//       'reports': {
//         title: 'Reports',
//         icon: <FileText className="w-5 h-5" />,
//         color: '#6366F1',
//         description: 'Generate and export system reports'
//       },
//       'system_admin': {
//         title: 'System Administration',
//         icon: <Server className="w-5 h-5" />,
//         color: '#DC2626',
//         description: 'System-wide administrative functions'
//       }
//     };

//     return configs[categoryKey] || {
//       title: categoryKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
//       icon: <Cog className="w-5 h-5" />,
//       color: '#6B7280',
//       description: `Manage ${categoryKey.replace(/_/g, ' ')} operations`
//     };
//   };

//   // ✅ Initialize permissions from API data (only for individual mode)
//   useEffect(() => {
//     if (!isBulkMode && userPermissionData?.permissions) {
//       console.log('Initializing individual permissions');
//       const permissionIds = userPermissionData.permissions.map(p => p.id);
//       const permissionSet = new Set(permissionIds);
//       setUserPermissions(permissionSet);
//       setInitialPermissions(new Set(permissionIds));
//       setHasChanges(false);
//     } else if (!isBulkMode && userPermissionData && Array.isArray(userPermissionData.permissions) && userPermissionData.permissions.length === 0) {
//       console.log('Setting empty permissions for individual mode');
//       setUserPermissions(new Set());
//       setInitialPermissions(new Set());
//       setHasChanges(false);
//     }
//     // ✅ For bulk mode, start with empty permissions (user selects what to add/remove)
//     else if (isBulkMode) {
//       console.log('Initializing bulk mode with empty permissions');
//       setUserPermissions(new Set());
//       setInitialPermissions(new Set());
//       setHasChanges(false);
//     }
//   }, [userPermissionData, isBulkMode]);

//   // ✅ Helper functions
//   const areSetsEqual = (set1, set2) => {
//     if (set1.size !== set2.size) return false;
//     for (let item of set1) {
//       if (!set2.has(item)) return false;
//     }
//     return true;
//   };

//   const toggleCategory = (categoryId) => {
//     console.log('Toggling category:', categoryId);
//     const newExpanded = new Set(expandedCategories);
//     if (newExpanded.has(categoryId)) {
//       newExpanded.delete(categoryId);
//     } else {
//       newExpanded.add(categoryId);
//     }
//     setExpandedCategories(newExpanded);
//   };

//   const togglePermission = (permissionId) => {
//     console.log('Toggling permission:', permissionId);
//     const newPermissions = new Set(userPermissions);
//     if (newPermissions.has(permissionId)) {
//       newPermissions.delete(permissionId);
//     } else {
//       newPermissions.add(permissionId);
//     }
//     setUserPermissions(newPermissions);

//     // ✅ Different change detection for individual vs bulk
//     if (isBulkMode) {
//       setHasChanges(newPermissions.size > 0);
//     } else {
//       const hasChangesNow = !areSetsEqual(newPermissions, initialPermissions);
//       setHasChanges(hasChangesNow);
//     }
//   };

//   // ✅ Enhanced save function to handle both individual and bulk
//   const savePermissions = async () => {
//     if (isBulkMode) {
//       return bulkSavePermissions();
//     } else {
//       return individualSavePermissions();
//     }
//   };

//   const individualSavePermissions = async () => {
//     try {
//       const permissionIds = Array.from(userPermissions);
//       await updateUserPermissions({
//         userId: primaryUser.id,
//         permissions: permissionIds
//       }).unwrap();

//       setInitialPermissions(new Set(userPermissions));
//       setHasChanges(false);
//       toast.success(`Permissions updated for ${primaryUser?.username}`);
//       await refetchUserPerms();
//     } catch (error) {
//       toast.error(`Failed to update permissions: ${error?.data?.message || 'Unknown error'}`);
//     }
//   };

//   const bulkSavePermissions = async () => {
//     if (userPermissions.size === 0) {
//       toast.warning('Please select at least one permission');
//       return;
//     }

//     const loadingToast = toast.loading(`Updating permissions for ${users.length} users...`);

//     try {
//       const permissionIds = Array.from(userPermissions);
//       const updatePromises = users.map(user =>
//         updateUserPermissions({
//           userId: user.id,
//           permissions: permissionIds,
  
//         }).unwrap()
//       );

//       await Promise.all(updatePromises);

//       toast.dismiss(loadingToast);
//       toast.success(
//         `Successfully updated permissions for ${users.length} users!`,
//         { autoClose: 4000 }
//       );

//       setUserPermissions(new Set());
//       setHasChanges(false);
      
//       // Navigate back after successful update
//       setTimeout(() => {
//         handleBackClick();
//       }, 1000);

//     } catch (error) {
//       toast.dismiss(loadingToast);
//       toast.error(`Failed to update permissions: ${error?.data?.message || 'Unknown error'}`);
//     }
//   };

//   const resetPermissions = () => {
//     if (isBulkMode) {
//       setUserPermissions(new Set());
//       setHasChanges(false);
//     } else {
//       setUserPermissions(new Set(initialPermissions));
//       setHasChanges(false);
//     }
//   };

//   const getCategoryStats = (permissions) => {
//     const selected = permissions.filter(p => userPermissions.has(p.id)).length;
//     const total = permissions.length;
    
//     if (isBulkMode) {
//       return { selected, total };
//     } else {
//       return { granted: selected, total }; // Keep original naming for individual mode
//     }
//   };

//   const getTotalStats = () => {
//     if (!availablePermissions) return isBulkMode ? { selected: 0, total: 0 } : { granted: 0, total: 0 };

//     const totalPermissions = Object.values(availablePermissions)
//       .reduce((sum, permissions) => sum + (Array.isArray(permissions) ? permissions.length : 0), 0);
//     const selectedPermissions = userPermissions.size;
    
//     if (isBulkMode) {
//       return { selected: selectedPermissions, total: totalPermissions };
//     } else {
//       return { granted: selectedPermissions, total: totalPermissions };
//     }
//   };

//   // ✅ Handle no users case
//   if (!users || users.length === 0) {
//     return (
//       <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
//           <div className="text-center py-12">
//             <h2 className="text-xl font-semibold text-red-600 mb-4">No User Data</h2>
//             <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
//               {isBulkMode 
//                 ? 'No users were selected for bulk permission management.'
//                 : 'Unable to find user information. Please go back and select a user.'
//               }
//             </p>
//             <button
//               onClick={handleBackClick}
//               className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
//             >
//               Go Back to User Management
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // ✅ Handle loading state
//   if ((isLoadingUserPerms && !isBulkMode) || isLoadingAvailable) {
//     return (
//       <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
//           <div className="flex items-center justify-between mb-6">
//             <div className="flex items-center space-x-3">
//               <button onClick={handleBackClick} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}>
//                 <HeroArrowLeft className="w-5 h-5" />
//               </button>
//               {isBulkMode ? (
//                 <UserGroupIcon className="w-6 h-6 text-blue-600" />
//               ) : (
//                 <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
//               )}
//               <div>
//                 <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
//                   {isBulkMode ? 'Bulk Permission Management' : 'User Permissions'}
//                 </h1>
//                 <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
//                   {isBulkMode 
//                     ? `Managing permissions for ${users.length} users`
//                     : `Managing permissions for ${primaryUser.username}`
//                   }
//                 </p>
//               </div>
//             </div>
//           </div>

//           <div className="rounded-lg shadow p-6" style={{ backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }}>
//             <div className="text-center py-12">
//               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
//               <p style={{ color: isDarkMode ? '#FFF' : '#111827' }}>Loading permissions...</p>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // ✅ Handle error state (same structure but different content)
//   if (userPermsError || availableError) {
//     return (
//       <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
//           <div className="flex items-center justify-between mb-6">
//             <div className="flex items-center space-x-3">
//               <button onClick={handleBackClick} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}>
//                 <HeroArrowLeft className="w-5 h-5" />
//               </button>
//               {isBulkMode ? <UserGroupIcon className="w-6 h-6 text-blue-600" /> : <ShieldCheckIcon className="w-6 h-6 text-blue-600" />}
//               <div>
//                 <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
//                   {isBulkMode ? 'Bulk Permission Management' : 'User Permissions'}
//                 </h1>
//               </div>
//             </div>
//           </div>

//           <div className="rounded-lg shadow p-6" style={{ backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }}>
//             <div className="text-center py-12">
//               <h3 className="text-lg font-semibold mb-4 text-red-600">Error Loading Permissions</h3>
//               <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
//                 {userPermsError?.data?.message || availableError?.data?.message || 'Failed to load permission data'}
//               </p>
//               <div className="flex space-x-3 justify-center">
//                 <button onClick={() => !isBulkMode && refetchUserPerms()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
//                   Retry
//                 </button>
//                 <button onClick={handleBackClick} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
//                   Go Back
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   const totalStats = getTotalStats();

//   // ✅ Main page content
//   return (
//     <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
//         {/* ✅ Dynamic Page Header */}
//         <div className="flex items-center justify-between mb-6">
//           <div className="flex items-center space-x-3">
//             <button onClick={handleBackClick} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`} title="Go back to user management">
//               <HeroArrowLeft className="w-5 h-5" />
//             </button>
//             {isBulkMode ? (
//               <UserGroupIcon className="w-6 h-6" style={{ color: isDarkMode ? "#60A5FA" : "#3B82F6" }} />
//             ) : (
//               <ShieldCheckIcon className="w-6 h-6" style={{ color: isDarkMode ? "#60A5FA" : "#3B82F6" }} />
//             )}
//             <div>
//               <h1 className="text-2xl font-bold" style={{ color: isDarkMode ? "#FFF" : "#111827" }}>
//                 {isBulkMode ? 'Bulk Permission Management' : 'User Permissions'}
//               </h1>
//               <p className="text-sm" style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
//                 {isBulkMode ? (
//                   <>Managing permissions for <span className="font-medium">{users.length} users</span></>
//                 ) : (
//                   <>Managing permissions for <span className="font-medium">{primaryUser.username}</span> ({primaryUser.role})</>
//                 )}
//               </p>
//             </div>
//           </div>

//           <div className="text-right">
//             <div className="text-lg font-bold" style={{ color: isDarkMode ? "#FFF" : "#111827" }}>
//               {isBulkMode ? `${totalStats.selected}/${totalStats.total}` : `${totalStats.granted}/${totalStats.total}`}
//             </div>
//             <div className="text-xs" style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
//               {isBulkMode ? 'permissions selected' : 'permissions granted'}
//             </div>
//           </div>
//         </div>

//         {/* ✅ Bulk Mode: Selected Users Display */}
//         {isBulkMode && (
//           <div className="rounded-lg shadow border mb-6" style={{ backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF", borderColor: isDarkMode ? "#374151" : "#E5E7EB" }}>
//             <div className="p-4">
//               <h3 className="text-lg font-medium mb-3" style={{ color: isDarkMode ? "#FFF" : "#111827" }}>
//                 Selected Users ({users.length})
//               </h3>
//               <div className="flex flex-wrap gap-2">
//                 {users.map(user => (
//                   <span key={user.id} className="inline-flex items-center px-3 py-1 rounded-full text-sm" style={{ backgroundColor: isDarkMode ? "#374151" : "#F3F4F6", color: isDarkMode ? "#D1D5DB" : "#374151" }}>
//                     {user.username} ({user.role})
//                   </span>
//                 ))}
//               </div>
//             </div>
//           </div>
//         )}


//         {/* ✅ Main Content - Permission Categories (same for both modes) */}
//         <div className="rounded-lg shadow border" style={{ backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF", borderColor: isDarkMode ? "#374151" : "#E5E7EB" }}>
//           <div className="p-6">
//             {/* Permission Categories */}
//             <div className="space-y-4 mb-6">
//               {availablePermissions && Object.entries(availablePermissions).map(([categoryKey, permissions]) => {
//                 if (!Array.isArray(permissions)) return null;

//                 const isExpanded = expandedCategories.has(categoryKey);
//                 const stats = getCategoryStats(permissions);
//                 const config = getCategoryConfig(categoryKey);

//                 return (
//                   <div key={categoryKey} className="border rounded-lg" style={{ backgroundColor: isDarkMode ? '#374151' : '#FFFFFF', borderColor: config.color + '40' }}>
//                     {/* Category Header */}
//                     <div onClick={() => toggleCategory(categoryKey)} className="p-4 cursor-pointer hover:bg-opacity-80 transition-colors" style={{ backgroundColor: config.color + '10' }}>
//                       <div className="flex items-center justify-between">
//                         <div className="flex items-center space-x-3">
//                           <div className="p-2 rounded-lg" style={{ backgroundColor: config.color + '20', color: config.color }}>
//                             {config.icon}
//                           </div>
//                           <div>
//                             <h4 className="font-semibold" style={{ color: isDarkMode ? '#F9FAFB' : '#111827' }}>
//                               {config.title}
//                             </h4>
//                             <p className="text-sm" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
//                               {config.description}
//                             </p>
//                           </div>
//                         </div>
//                         <div className="flex items-center space-x-3">
//                           <div className="text-right">
//                             <div className="text-sm font-medium" style={{ color: isDarkMode ? '#FFF' : '#111827' }}>
//                               {isBulkMode ? `${stats.selected}/${stats.total}` : `${stats.granted}/${stats.total}`}
//                             </div>
//                             <div className="text-xs" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
//                               {isBulkMode ? 'selected' : 'permissions'}
//                             </div>
//                           </div>
//                           {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
//                         </div>
//                       </div>
//                     </div>

//                     {/* Category Permissions */}
//                     {isExpanded && (
//                       <div className="p-4 space-y-3 border-t" style={{ borderColor: config.color + '20' }}>
//                         {permissions.map((permission) => (
//                           <div key={permission.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${userPermissions.has(permission.id) ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20' : isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
//                             <div className="flex-1">
//                               <div className="flex items-center space-x-2">
//                                 <span className="text-sm font-medium" style={{ color: isDarkMode ? '#FFF' : '#111827' }}>
//                                   {permission.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
//                                 </span>
//                                 {userPermissions.has(permission.id) && <Check className="w-4 h-4 text-green-600" />}
//                               </div>
//                               <p className="text-xs mt-1" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
//                                 {permission.description}
//                               </p>
//                             </div>

//                             <button
//                               onClick={() => togglePermission(permission.id)}
//                               disabled={isUpdating}
//                               className={`ml-4 p-2 rounded-lg transition-colors ${userPermissions.has(permission.id) ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300'} ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
//                             >
//                               {userPermissions.has(permission.id) ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
//                             </button>
//                           </div>
//                         ))}
//                       </div>
//                     )}
//                   </div>
//                 );
//               })}
//             </div>

//             {/* ✅ Footer with action buttons */}
//             <div className="flex items-center justify-between pt-6 border-t" style={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}>
//               <div className="text-sm" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
//                 {hasChanges ? (
//                   <span className="text-orange-600 dark:text-orange-400 font-medium">
//                     {isBulkMode 
//                       ? `⚠️ ${userPermissions.size} permissions selected`
//                       : '⚠️ You have unsaved changes'
//                     }
//                   </span>
//                 ) : (
//                   isBulkMode ? 'No permissions selected' : 'No changes made'
//                 )}
//               </div>

//               <div className="flex space-x-3">
//                 <button onClick={handleCancel} disabled={isUpdating} className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${isDarkMode ? 'text-gray-300 bg-gray-600 hover:bg-gray-500' : 'text-gray-700 bg-gray-200 hover:bg-gray-300'} ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}>
//                   {hasChanges ? 'Cancel' : 'Go Back'}
//                 </button>

//                 {hasChanges && (
//                   <button onClick={resetPermissions} disabled={isUpdating} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isDarkMode ? 'text-gray-300 bg-gray-600 hover:bg-gray-500' : 'text-gray-700 bg-gray-200 hover:bg-gray-300'} ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}>
//                     Reset Changes
//                   </button>
//                 )}

//                 {hasChanges && (
//                   <button onClick={savePermissions} disabled={isUpdating} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
//                     {isUpdating ? (
//                       <>
//                         <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
//                         <span>{isBulkMode ? 'Updating...' : 'Saving...'}</span>
//                       </>
//                     ) : (
//                       <>
//                         {isBulkMode ? <UserGroupIcon className="w-4 h-4" /> : <Save className="w-4 h-4" />}
//                         <span>{isBulkMode ? `Apply to ${users.length} Users` : 'Save Permissions'}</span>
//                       </>
//                     )}
//                   </button>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default UserPermissionsPage;
