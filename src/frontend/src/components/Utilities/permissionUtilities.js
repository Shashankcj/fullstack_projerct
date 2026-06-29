
export const hasPermission = (permissionsData,permissionName) => {
  return permissionsData?.permissions?.some(
    perm => perm.name === permissionName
  ) || false;
};

export const hasAnyPermission = (permissionsData,permissionNames) => {
  return permissionsData?.permissions?.some(
    perm => permissionNames.includes(perm.name)
  ) || false;
};