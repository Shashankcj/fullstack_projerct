import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { setupListeners } from '@reduxjs/toolkit/query/react';

// API SLICES
import { apiSlice }            from './apiSlice';
import { dashboardApi }        from './dashboardStatsApi';
import { ipMonitoringApi }     from './ipMonitoringApi';
import { devicesApi }          from './devicesApiSlice';
import { storageFlagApi }      from './storageFlagApi';
import { portFlagApi }         from './networkFlagApi';
import { alertFilterApi }      from './alertFilterApi';
import { eventLogFilterApi }   from './eventLogFilterApi';
import { roleApi }             from './roleApiSlice';
import { globalApiSlice }      from './globalApiSlice';
import { auditLogsApi }        from './auditLogsApi';
import { jobsApi }             from './jobsApi';
import { userApiSlice }        from './userApiSlice';
import { permissionApi }       from './permissionApiSlice';
import {alertsApi}              from './alertsApi'; 

// REGULAR REDUCERS
import notificationReducer   from './notificationSlice';
import userModPermReducer     from './userModulePermission';
import chartSettingsReducer   from './chartSettings';


/* ================= APP REDUCER ================= */

const appReducer = combineReducers({
  notification:  notificationReducer,
  userModPerm:   userModPermReducer,
  chartSettings: chartSettingsReducer,

  [apiSlice.reducerPath]:          apiSlice.reducer,
  [userApiSlice.reducerPath]:      userApiSlice.reducer,
  [storageFlagApi.reducerPath]:    storageFlagApi.reducer,
  [devicesApi.reducerPath]:        devicesApi.reducer,
  [ipMonitoringApi.reducerPath]:   ipMonitoringApi.reducer,
  [permissionApi.reducerPath]:     permissionApi.reducer,
  [portFlagApi.reducerPath]:       portFlagApi.reducer,
  [alertFilterApi.reducerPath]:    alertFilterApi.reducer,
  [eventLogFilterApi.reducerPath]: eventLogFilterApi.reducer,
  [roleApi.reducerPath]:           roleApi.reducer,
  [globalApiSlice.reducerPath]:    globalApiSlice.reducer,
  [auditLogsApi.reducerPath]:      auditLogsApi.reducer,
  [jobsApi.reducerPath]:           jobsApi.reducer,
  [dashboardApi.reducerPath]:      dashboardApi.reducer,
  [alertsApi.reducerPath]:          alertsApi.reducer,
});


/* ================= ROOT REDUCER ================= */

const rootReducer = (state, action) => {
  if (
    action.type === 'auth/logout'      ||
    action.type === 'LOGOUT'           ||
    action.type === 'auth/clearState'  ||
    action.type === 'auth/tokenExpired'
  ) {
    storage.removeItem('persist:root').catch(() => {});
    return appReducer(undefined, action);
  }
  return appReducer(state, action);
};


/* ================= PERSIST CONFIG ================= */

const persistConfig = {
  key:     'root',
  storage,
  version: 1,

  whitelist: ['notification', 'userModPerm', 'chartSettings'],

  throttle:  1000,
  serialize: true,

  writeFailHandler: (err) => {
    
    console.error('[store] Redux persist write failed:', err);
  },
  debug: import.meta.env.DEV,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);


/* ================= STORE ================= */

export const store = configureStore({
  reducer: persistedReducer,

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'persist/REGISTER',
          'persist/PURGE',
          'persist/FLUSH',
          'persist/PAUSE',
          'persist/RESTORE',
        ],
        ignoredActionsPaths: ['meta.arg', 'payload.timestamp'],
        ignoredPaths: [
          apiSlice.reducerPath,
          storageFlagApi.reducerPath,
          portFlagApi.reducerPath,
          userApiSlice.reducerPath,
          devicesApi.reducerPath,
          ipMonitoringApi.reducerPath,
          permissionApi.reducerPath,
          alertFilterApi.reducerPath,
          eventLogFilterApi.reducerPath,
          roleApi.reducerPath,
          globalApiSlice.reducerPath,
          auditLogsApi.reducerPath,
          jobsApi.reducerPath,
          dashboardApi.reducerPath,
          alertsApi.reducerPath,
        ],
      },
      immutableCheck: {
        ignoredPaths: [
          apiSlice.reducerPath,
          storageFlagApi.reducerPath,
          portFlagApi.reducerPath,
          userApiSlice.reducerPath,
          devicesApi.reducerPath,
          ipMonitoringApi.reducerPath,
          permissionApi.reducerPath,
          alertFilterApi.reducerPath,
          eventLogFilterApi.reducerPath,
          roleApi.reducerPath,
          globalApiSlice.reducerPath,
          auditLogsApi.reducerPath,
          jobsApi.reducerPath,
          dashboardApi.reducerPath,
          alertsApi.reducerPath,
        ],
      },
    })
    .concat(apiSlice.middleware)
    .concat(userApiSlice.middleware)
    .concat(permissionApi.middleware)
    .concat(storageFlagApi.middleware)
    .concat(portFlagApi.middleware)
    .concat(devicesApi.middleware)
    .concat(alertFilterApi.middleware)
    .concat(eventLogFilterApi.middleware)
    .concat(roleApi.middleware)
    .concat(globalApiSlice.middleware)
    .concat(ipMonitoringApi.middleware)
    .concat(auditLogsApi.middleware)
    .concat(jobsApi.middleware)
    .concat(dashboardApi.middleware)
    .concat(alertsApi.middleware),

  devTools: import.meta.env.MODE !== 'production' && {
    name:       'Device Management Store',
    trace:      true,
    traceLimit: 25,
  },
});


/* ================= LISTENERS + PERSISTOR ================= */

setupListeners(store.dispatch);

export const persistor = persistStore(store);


/* ================= UTILITY FUNCTIONS ================= */


export const clearPersistedState = async () => {
  try {
    await storage.removeItem('persist:root');
    return true;
  } catch {
    return false;
  }
};


export const getPersistedState = async () => {
  try {
    const persistedState = await storage.getItem('persist:root');
    return persistedState ? JSON.parse(persistedState) : null;
  } catch {
    return null;
  }
};



/* ================= RESET ALL CACHES ================= */

export const resetAllApiCaches = () => {
  store.dispatch(apiSlice.util.resetApiState());
  store.dispatch(userApiSlice.util.resetApiState());
  store.dispatch(permissionApi.util.resetApiState());
  store.dispatch(storageFlagApi.util.resetApiState());
  store.dispatch(portFlagApi.util.resetApiState());
  store.dispatch(devicesApi.util.resetApiState());
  store.dispatch(alertFilterApi.util.resetApiState());
  store.dispatch(eventLogFilterApi.util.resetApiState());
  store.dispatch(roleApi.util.resetApiState());
  store.dispatch(globalApiSlice.util.resetApiState());
  store.dispatch(ipMonitoringApi.util.resetApiState());
  store.dispatch(auditLogsApi.util.resetApiState());
  store.dispatch(jobsApi.util.resetApiState());
  store.dispatch(dashboardApi.util.resetApiState());
  store.dispatch(alertsApi.util.resetApiState());
};


/* ================= API INSTANCES ================= */

export const apis = {
  main:           apiSlice,
  user:           userApiSlice,
  permission:     permissionApi,
  storageFlag:    storageFlagApi,
  portFlag:       portFlagApi,
  alertFilter:    alertFilterApi,
  eventLogFilter: eventLogFilterApi,
  role:           roleApi,
  devices:        devicesApi,
  global:         globalApiSlice,
  ipMonitoring:   ipMonitoringApi,
  auditLogs:      auditLogsApi,
  jobs:           jobsApi,
  dashboard:      dashboardApi,
  alert:          alertsApi,
};