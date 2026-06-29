import { useSelector } from "react-redux";

const RenderIfAllowed = ({
  module,
  action = "read",
  children,
  showForbidden = false,
}) => {
  const modulePermissions = useSelector(
    (state) => state.userModPerm?.[module]
  );

  const hasPermission = Boolean(modulePermissions?.[action]);

  // PAGE-LEVEL forbidden view
  if (!hasPermission && showForbidden) {
    return (
      <div className="w-full flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold text-gray-400 uppercase tracking-wider">
            Access Forbidden
          </h1>
          <p className="mt-4 text-sm text-gray-500">
            You do not have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  // BUTTON / UI-LEVEL restriction
  if (!hasPermission) {
    return null;
  }

  return <>{children}</>;
};

export default RenderIfAllowed;
