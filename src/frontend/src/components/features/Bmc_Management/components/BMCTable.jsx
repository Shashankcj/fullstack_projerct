import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDocumentTitle } from "../../../../Hooks/useDocumentTitle";
import DataTable from "../../../table/DataTable";
import { Plus } from "lucide-react";
import { toast } from "react-toastify";
import SearchBar from "../../../shared/SearchBar";
import BMCModal from "./BMCModal";
import ActionButtons from "../../../shared/ActionButtons";
import PageWrapper from "../../../Utilities/PageWrapper";

const BMCTable = ({ isDarkMode = true }) => {
  useDocumentTitle("BMC Devices");
  const navigate = useNavigate();
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [showModal, setShowModal] = useState(false);

  //  5 DUMMY RECORDS
  const dummyBMCData = [
    { id: "bmc-1", uuid: "bmc-uuid-001", name: "Server-01-BMC", vendor: "Dell", status: "Active" },
    { id: "bmc-2", uuid: "bmc-uuid-002", name: "Rack-05-BMC", vendor: "HP", status: "Inactive" },
    { id: "bmc-3", uuid: "bmc-uuid-003", name: "Node-Cluster1", vendor: "Supermicro", status: "Active" },
    { id: "bmc-4", uuid: "bmc-uuid-004", name: "Edge-Device-01", vendor: "Cisco", status: "Active" },
    { id: "bmc-5", uuid: "bmc-uuid-005", name: "Storage-Array", vendor: "NetApp", status: "Maintenance" },
  ];

  // Dummy values matching DevicesList structure
  const data = { results: dummyBMCData, count: dummyBMCData.length };
  const isLoading = false;
  const isFetching = false;
  const error = null;
  const refetch = () => toast.success("BMC data refreshed!");

  /* -------------------- TABLE CONFIG - FIXED ALIGNMENT -------------------- */
  const tableConfig = useMemo(
    () => ({
      columns: [
        { key: "select", width: "w-[8%]", sortable: false, header: "", align: "text-center" },

        {
          key: "name",
          width: "w-[32%]",
          sortable: true,
          header: "NAME",
          align: "text-center",
          sortField: "name",
        },
        {
          key: "vendor",
          width: "w-[25%]",
          sortable: true,
          header: "VENDOR",
          align: "text-center",
          sortField: "vendor",
        },
        {
          key: "status",
          width: "w-[20%]",
          sortable: true,
          header: "STATUS",
          align: "text-center",
          sortField: "status",
        },
        {
          key: "action",
          width: "w-[15%]",
          sortable: false,
          header: "ACTION",
          align: "text-center",
        },
      ],
    }),
    [isDarkMode]
  );

  /* -------------------- DATA PROCESSING - EXACT DevicesList format -------------------- */
  const processedRows = useMemo(() => {
    return data.results.map((bmc) => ({
      id: bmc.uuid,
      name: bmc.name || "---",
      vendor: bmc.vendor || "---",
      status: bmc.status || "Unknown",
    }));
  }, [data]);

  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / 10);

  /* -------------------- HANDLERS - SAME as DevicesList -------------------- */
  // const handleRowClick = useCallback((id) => {
  //   if (id) navigate(`/bmc/${id}`);
  // }, [navigate]);

  const handleRowClick = () => {
    navigate('/bmc_dashboard')
  }

  const handleAddBMC = useCallback(() => setShowModal(true), []);


  const handleDeleteDevice = useCallback((e, device) => {
    e.stopPropagation();
    if (window.confirm(`Delete ${device.name}?`)) {
      toast.success(`Deleted ${device.name} successfully`);
      setSelectedRows(new Set());
    }
  }, []);

  const handleCheckboxChange = useCallback((e, deviceId) => {
    e.stopPropagation();
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(deviceId)) newSet.delete(deviceId);
      else newSet.add(deviceId);
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((e) => {
    if (e.target.checked)
      setSelectedRows(new Set(processedRows.map((row) => row.id)));
    else setSelectedRows(new Set());
  }, [processedRows]);

  const allSelected = processedRows.length > 0 && selectedRows.size === processedRows.length;
  const someSelected = selectedRows.size > 0 && selectedRows.size < processedRows.length;

  const handlePageChange = useCallback((page) => { }, []);
  const handleItemsPerPageChange = useCallback((count) => { }, []);

  return (
    <PageWrapper isDarkMode={isDarkMode}>
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div
        className="rounded-lg shadow-md overflow-hidden"
        style={{
          backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
          border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
        }}
      >
        {/* Header */}
        <div
          className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 border-b"
          style={{
            borderColor: isDarkMode ? "#374151" : "#E5E7EB",
            backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-base sm:text-lg font-semibold" style={{ color: isDarkMode ? "#FFF" : "#525759" }}>
              BMC Devices
            </span>

            {/* <RenderIfAllowed module="ip_monitoring" action="create"> */}
            <ActionButtons
              onAdd={handleAddBMC}
              addButtonTitle="Add BMC Credentials"
              addIcon={Plus}
              isDarkMode={isDarkMode}
            />
            {/* </RenderIfAllowed> */}
          </div>
          <div>
            <SearchBar
              searchPlaceholder="Search BMC Devices..."
              isDarkMode={isDarkMode}
              className="border-0 p-0"
            />
          </div>
        </div>

        {/* Table */}
        <DataTable
          rows={processedRows}
          tableConfig={tableConfig}
          selectedRows={selectedRows}
          isDarkMode={isDarkMode}
          onCheckboxChange={handleCheckboxChange}
          onSelectAll={handleSelectAll}
          onRowClick={handleRowClick}
          onDeleteDevice={handleDeleteDevice}
          allSelected={allSelected}
          someSelected={someSelected}
          currentPage={1}
          totalPages={totalPages}
          itemsPerPage={10}
          itemsPerPageOptions={[10, 25, 50, 100]}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
          totalCount={totalCount}
          tableTitle="BMC Devices"
          moduleName="bmc"
        />

        {/* modal to add ips  */}
        <BMCModal
          show={showModal}
          onHide={() => setShowModal(false)}
          onSuccess={() => refetch()}
          isDarkMode={isDarkMode}
        // createBMC={yourRTKMutation}   // plug in when API is ready
        />
      </div>
    </div>
    </PageWrapper>
  );
};

export default BMCTable;
