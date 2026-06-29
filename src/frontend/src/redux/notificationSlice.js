import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  alerts: [],
};

const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {
    addAlert(state, action) {
      const alert = action.payload;

      // prevent duplicates
      const exists = state.alerts.some(
        a => a.uuid === alert.uuid
      );
      if (!exists) {
        state.alerts.unshift(alert); // newest first
      }
    },

    markAlertAsRead(state, action) {
      const uuid = action.payload;
      const alert = state.alerts.find(a => a.uuid === uuid);
      if (alert) {
        alert.is_read = true;
      }
    },

    markAllAsRead(state) {
      state.alerts.forEach(alert => {
        alert.is_read = true;
      });
    },

    clearAlerts(state) {
      state.alerts = [];
    },
  },
});

export const {
  addAlert,
  markAlertAsRead,
  markAllAsRead,
  clearAlerts,
} = notificationSlice.actions;

export const selectAlerts = state =>
  state.notification?.alerts || [];

export default notificationSlice.reducer;
