import { createSlice } from '@reduxjs/toolkit';

// {                                                                                                                                                              
//     rbac: { create: false, read: false, update: false, delete: false },                                                                                          
//     users_management: { create: false, read: false, update: false, delete: false },                                                                                                                                                                                                                       
//     monitoring: { create: false, read: false, update: false, delete: false },
//     global_config: { read:false, update:false},                                                                                   
// }
const module_names = [
  ['rbac', 'Roles'],
  ['users_management', 'Users'],
  ['monitoring', 'Monitoring'],
  ['custom_groups', 'Custom Groups'],
  ['ip_monitoring', 'IP Monitoring'],
  ['audit_logs', 'Audit Logs'],
  ['global_configuration', 'Global Configuration'],
];

// Restricted Modules (NO create / delete)
const NO_CREATE_DELETE = ['audit_logs', 'global_configuration'];

// Map for display names
const MODULE_NAME_MAP = Object.fromEntries(module_names);

// ---------- Initial State ----------
let initialState_modules = {};

for (let [key, displayName] of module_names) {
  if (NO_CREATE_DELETE.includes(key)) {
    initialState_modules[key] = {
      name: displayName,
      read: false,
      update: false,
    };
  } else {
    initialState_modules[key] = {
      name: displayName,
      create: false,
      read: false,
      update: false,
      delete: false,
    };
  }
}

// ---------- Slice ----------
export const userModPermSlice = createSlice({
  name: 'userModPerm',
  initialState: initialState_modules,

  reducers: {
    setPermissions: (state, action) => {
      const incoming = action.payload;

      Object.keys(incoming).forEach((moduleKey) => {
        const moduleData = incoming[moduleKey] || {};
        const name =
          MODULE_NAME_MAP[moduleKey] ||
          moduleData.name ||
          moduleKey;

        if (NO_CREATE_DELETE.includes(moduleKey)) {
          state[moduleKey] = {
            name,
            read: !!moduleData.read,
            update: !!moduleData.update,
          };
        } else {
          state[moduleKey] = {
            name,
            create: !!moduleData.create,
            read: !!moduleData.read,
            update: !!moduleData.update,
            delete: !!moduleData.delete,
          };
        }
      });
    },

    updatePermissions: (state, action) => {
      const { module, newPermission } = action.payload;

      if (!state[module]) return;

      const name =
        state[module].name ||
        MODULE_NAME_MAP[module] ||
        module;

      if (NO_CREATE_DELETE.includes(module)) {
        state[module] = {
          name,
          read: newPermission?.read ?? state[module].read,
          update: newPermission?.update ?? state[module].update,
        };
      } else {
        state[module] = {
          name,
          create: newPermission?.create ?? state[module].create,
          read: newPermission?.read ?? state[module].read,
          update: newPermission?.update ?? state[module].update,
          delete: newPermission?.delete ?? state[module].delete,
        };
      }
    },

    resetPermissions: () => initialState_modules,
  },
});

export const {
  setPermissions,
  updatePermissions,
  resetPermissions,
} = userModPermSlice.actions;

export default userModPermSlice.reducer;
