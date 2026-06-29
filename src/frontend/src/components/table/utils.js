export const HEALTH_PRIORITY = {
  red: 3,
  amber: 2,
  maintenance: 1,
  green: 0,
  no_data: -1,
};

export const getRowStyle = (healthStatus) => {
  const key = String(
    healthStatus ?? "no_data"
  )
    .toLowerCase()
    .trim();

  if (key === "red") {
    return {
      backgroundColor: "rgba(239, 68, 68, 0.15)",
      borderLeft: "4px solid rgba(239, 68, 68, 0.5)",
    };
  }

  if (key === "amber") {
    return {
      backgroundColor: "rgba(234, 179, 8, 0.15)",
      borderLeft: "4px solid rgba(234, 179, 8, 0.5)",
    };
  }

  return {};
};

export const sortServersByHealth = (servers = []) => {
  return [...servers].sort((a, b) => {
    const valA =
      HEALTH_PRIORITY[
        String(a.health_status).toLowerCase()
      ] ?? 0;

    const valB =
      HEALTH_PRIORITY[
        String(b.health_status).toLowerCase()
      ] ?? 0;

    return valB - valA;
  });
};