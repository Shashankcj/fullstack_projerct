import { createSlice } from '@reduxjs/toolkit';

const charts_names = [
    'cpu_utilization', 'memory_utilization', 'ctx_switches',
    'hw_irq', 'sw_irq', 'syscalls',
    'bytes_received', 'bytes_sent', 'network_utilization',
    'packets_received', 'packets_sent', 'drop_in',
    'drop_out', 'error_in', 'error_out',
    'disk_usage_percent', 'total_disk_size', 'total_disk_usage',
    'unallocated_disk_space', 'allocated_disk_space', 'used_space_perc',
    'used_space', 'free_space', 'ip_status', 'min_latency', 'max_latency',
    'jitter', 'read_count_io', 'write_count_io', 'bytes_read_io',
    'bytes_write_io', 'read_time_io', 'write_time_io',
];

export const charts_with_data_unit = [
    'bytes_received', 'bytes_sent', 'total_disk_size',
    'unallocated_disk_space', 'allocated_disk_space', 'used_space', 'free_space',
    'bytes_read_io', 'bytes_write_io',
];

let initialState_chartSettings = {};

charts_names.forEach((chart) => {
    initialState_chartSettings[chart] = {
        x_axis_tick_line: true,
        x_axis_line: true,
        y_axis_tick_line: true,
        y_axis_line: true,
        dot: false,
    };
    if( charts_with_data_unit.includes(chart) ) {
        initialState_chartSettings[chart]['data_unit'] = 'MB';
    }
});

export const chartSettingsSlice = createSlice({
    name: 'chartSettings',
    initialState: initialState_chartSettings,
    reducers: {
     toggleSetting: (state, action) => {
            const { chart, setting } = action.payload;
            state[chart][setting] = !state[chart][setting];
            // console.log("state after toggle:", state);
        },
     setDataUnit: (state, action) => {
            const { chart, data_unit } = action.payload;
            state[chart]['data_unit'] = data_unit;
            // console.log("state after setting data unit:", state);
        },
    },
});

export const { toggleSetting, setDataUnit } = chartSettingsSlice.actions;

export default chartSettingsSlice.reducer;