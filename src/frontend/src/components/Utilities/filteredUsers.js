
// export const filteredUsers = (data ?? []).filter(rowUser => {
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