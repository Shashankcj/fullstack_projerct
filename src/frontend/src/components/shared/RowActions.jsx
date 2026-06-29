import PropTypes from "prop-types";
import { Edit2, TrashIcon } from "lucide-react";
import RenderIfAllowed from "./RenderIfAllowed";

const RowActions = ({
  row,
  isDarkMode,
  onEdit,
  onDelete,
  module,
}) => {
  return (
    <div className="flex items-center justify-center gap-2">
      {onEdit && (
        <RenderIfAllowed module={module} action="update">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(e, row);
            }}
            className={`p-1 rounded transition-colors ${
              isDarkMode
                ? "text-blue-400 hover:bg-blue-900/20"
                : "text-blue-600 hover:bg-blue-50"
            }`}
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </RenderIfAllowed>
      )}

      {onDelete && (
        <RenderIfAllowed module={module} action="delete">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e, row);
            }}
            className={`p-1 rounded transition-colors ${
              isDarkMode
                ? "text-red-400 hover:bg-red-900/20"
                : "text-red-600 hover:bg-red-50"
            }`}
            title="Delete"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </RenderIfAllowed>
      )}
    </div>
  );
};

RowActions.propTypes = {
  row: PropTypes.object.isRequired,
  isDarkMode: PropTypes.bool,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  module: PropTypes.string.isRequired,
};

export default RowActions;
