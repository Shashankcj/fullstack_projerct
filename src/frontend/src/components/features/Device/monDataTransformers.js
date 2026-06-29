import { use } from "react";
import { useSelector } from "react-redux";
import {charts_with_data_unit} from '../../../redux/chartSettings';

const extractTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// export const data_unit_transformer = (data, data_unit, strform=false) => {
    
//     const unit_dividers = {
//         'KB': 1024,
//         'MB': 1024 * 1024,
//         'GB': 1024 * 1024 * 1024,
//     };
//     if(data_unit && data_unit in unit_dividers){
//         const convertedData = parseFloat(data) / unit_dividers[data_unit];
//         // console.log(`Converted data: ${data} to ${convertedData.toFixed(2)} ${data_unit}`);
//         return strform ? `${convertedData.toFixed(2)} ${data_unit}` :  [convertedData.toFixed(2), data_unit];
//     }
//     return strform ? `${data}` : [data, ''];
// };

export const data_unit_transformer = (data, data_unit, strform = false) => {
    // 1. Handle null/undefined data immediately
    if (data === null || data === undefined) return strform ? "0" : [0, ''];

    const unit_dividers = {
        'B': 1,
        'KB': 1024,
        'MB': 1024 ** 2, // cleaner syntax for 1024 * 1024
        'GB': 1024 ** 3,
        'TB': 1024 ** 4,
    };

    if (data_unit && data_unit in unit_dividers) {
        const divider = unit_dividers[data_unit];
        const convertedData = parseFloat(data) / divider;
        
        // Use Number() to ensure we return a numeric value when not in string mode
        const formattedValue = parseFloat(convertedData.toFixed(2));

        return strform 
            ? `${formattedValue} ${data_unit}` 
            : [formattedValue, data_unit];
    }

    // Fallback for unknown units
    return strform ? `${data}` : [parseFloat(data), ''];
};

export const cpuMonDataTransformer = (data) => {
    let trasformedData = {};
    const timestamp = extractTimestamp(data.timestamp);
    const cpuData = Array.isArray(data.data) ? data.data : [data.data];


    cpuData.forEach(entry => {
        let uuid = entry['cpu_uuid'];
        Object.keys(entry).forEach(key => {
            if (['cpu_utilization','ctx_switches','hw_irq','sw_irq','syscalls'].includes(key)) {

                trasformedData[`${key}_${uuid}`] = {
                    series1: parseFloat(entry[key]),
                    timestamp: timestamp,
                    series1_name: key,
                    series1_suffix: key === 'cpu_utilization' ? '%' : ''
                };
            }
        });
    });

    return trasformedData;
};
    
export const memoryMonDataTransformer = (data) => {
    let trasformedData = {};
    const timestamp = extractTimestamp(data.timestamp);
    Object.keys(data.data).forEach(key => {
        if(['memory_utilization'].includes(key)){ 
            trasformedData[key] = {
                series1: parseFloat(data.data[key]),
                timestamp: timestamp,
                series1_name : key,
                series1_suffix : key === 'memory_utilization' ? '%' : ''
            };
        }
    });
    // console.log("Transformed Memory Monitoring Data:", trasformedData);
    return trasformedData;
};

export const networkMonDataTransformer = (data) => {
    let  trasformedData = {};
    const timestamp = extractTimestamp(data.timestamp);
    let series1_name = '';
    let series1_suffix = '';

    // console.log("Network Monitoring Data Received:", data);

    data.data.forEach(entry => {
        let uuid = entry['port_uuid'];
        // console.log("Processing data for port UUID:", uuid, entry);
        Object.keys(entry).forEach(key => {
            let data = null;
            if([
                'network_utilization', 
                'bytes_received', 
                'bytes_sent', 
                'packets_received', 
                'packets_sent', 
                'drop_in', 
                'drop_out', 
                'error_in', 
                'error_out'
            ].includes(key)){ 
                if(key === 'network_utilization'){
                    series1_name = 'Network Utilization';
                    series1_suffix = '%';
                }
                else if(key === 'bytes_received'){
                    series1_name = 'Data Received';
                    series1_suffix = ' MB';
                    
                }
                else if(key === 'bytes_sent'){
                    series1_name = 'Data Sent';
                    series1_suffix = ' MB';
                }
                else if(key === 'packets_received'){
                    series1_name = 'Packets Received';
                    series1_suffix = ' pkts';
                }
                else if(key === 'packets_sent'){
                    series1_name = 'Packets Sent';
                    series1_suffix = ' pkts';
                }
                else if(key === 'drop_in'){
                    series1_name = 'Drop In';
                    series1_suffix = ' pkts';
                }
                else if(key === 'drop_out'){
                    series1_name = 'Drop Out';
                    series1_suffix = ' pkts';
                }
                else if(key === 'error_in'){
                    series1_name = 'Error In';
                    series1_suffix = ' pkts';
                }
                else if(key === 'error_out'){
                    series1_name = 'Error Out';
                    series1_suffix = ' pkts';
                }   
                trasformedData[`${key}_${uuid}`] = {
                    series1: data == null ? parseFloat(entry[key]) : data.toFixed(2),
                    timestamp: timestamp,
                    series1_name : series1_name,
                    series1_suffix : series1_suffix
                };
            }
        })
    });
    // console.log("Transformed Network Monitoring Data:", trasformedData);
    return trasformedData;
};

export const diskMonDataTransformer = (data) => {
    let trasformedData = {};
    const timestamp = extractTimestamp(data.timestamp);
    let series1_name = '';
    let series1_suffix = '';

    data.data.forEach(entry => {
        let uuid = entry['disk_uuid'];
        let override_key = null;

        Object.keys(entry).forEach(key => {
            if([
                'total_disk_size', 
                'total_disk_usage', 
                'unallocated_disk_space', 
                'allocated_disk_space',
                'disk_utilization',
                'read_count_io',
                'write_count_io',
                'bytes_read_io',
                'bytes_write_io',
                'read_time_io',
                'write_time_io'
            ].includes(key)){
                switch(key){
                    case 'disk_utilization':
                        series1_name = 'Disk Utilization';
                        series1_suffix = '%';
                        override_key = 'disk_usage_percent';
                        // console.log("Disk Utilization detected : ", entry[key]);
                        break;
                    case 'total_disk_size':
                        series1_name = 'Disk Size';
                        series1_suffix = ' GB';
                        break;
                    case 'total_disk_usage':
                        series1_name = 'Disk Usage';
                        series1_suffix = ' GB';
                        break;
                    case 'unallocated_disk_space':
                        series1_name = 'Unallocated Disk Space';
                        series1_suffix = ' GB';
                        break;
                    case 'allocated_disk_space':
                        series1_name = 'Allocated Disk Space';
                        series1_suffix = ' GB';
                        break;
                    case 'read_count_io':
                        series1_name = 'Read Count';
                        series1_suffix = ' Ops';
                        break;
                    case 'write_count_io':
                        series1_name = 'Write Count';
                        series1_suffix = ' Ops';
                        break;
                    case 'bytes_read_io':
                        series1_name = 'Bytes Read';
                        series1_suffix = ' Bytes';
                        break;
                    case 'bytes_write_io':
                        series1_name = 'Bytes Written';
                        series1_suffix = ' Bytes';
                        break;
                    case 'read_time_io':
                        series1_name = 'Read Time';
                        series1_suffix = ' ms';
                        break;
                    case 'write_time_io':
                        series1_name = 'Write Time';
                        series1_suffix = ' ms';
                        break;
                    default:
                        break;
                }
                trasformedData[override_key === null ? `${key}_${uuid}` : `${override_key}_${uuid}`] = {
                    series1: parseFloat(entry[key]),
                    timestamp: timestamp,
                    series1_name : series1_name,
                    series1_suffix : series1_suffix
                };
            }
        });
    });

    return trasformedData;
};


export const partitionMonDataTransformer = (data) => {
    let trasformedData = {};
    const timestamp = extractTimestamp(data.timestamp);
    let series1_name = '';
    let series1_suffix = '';

    data.data.forEach(entry => {
        let uuid = entry['partition_uuid'];

        Object.keys(entry).forEach(key => {
            if([
                'used_space_perc', 
                'used_space', 
                'free_space'
            ].includes(key)){
                switch(key){
                    case 'used_space_perc':
                        series1_name = 'Partition Utilization';
                        series1_suffix = '%';
                        break;
                    case 'used_space':
                        series1_name = 'Partition Used Space';
                        series1_suffix = ' GB';
                        break;
                    case 'free_space':
                        series1_name = 'Partition Free Space';
                        series1_suffix = ' GB';
                        break;
                    default:
                        break;
                }
                trasformedData[`${key}_${uuid}`] = {
                    series1: parseFloat(entry[key]),
                    timestamp: timestamp,
                    series1_name : series1_name,
                    series1_suffix : series1_suffix
                };
            }
        });
    });

    return trasformedData;
}


export const ipMonDataTransformer = (data) => {
    let trasformedData = {};
    const timestamp = extractTimestamp(data.timestamp);
    let series1_name = '';
    let series1_suffix = 'ms';

    Object.keys(data.data).forEach(key => {
        if(['ip_status', 'min_latency', 'max_latency', 'jitter'].includes(key)){ 
            trasformedData[key] = {
                series1: parseFloat(data.data[key]),
                series1_name : key,
                series1_suffix : key === 'ip_status' ? '%' : series1_suffix,
                timestamp: timestamp
            };
        }
    });

    return trasformedData;
};

export const filteredMonDataTransformer = (data={}) => {
    data.forEach(entry => {
        for(let i = 1; i <= 3; i++){
            
            if (typeof entry[`series${i}`] === "string" && entry[`series${i}`].includes(".")) {
            entry[`series${i}`] = parseFloat(entry[`series${i}`]);
            }else{
                entry[`series${i}`] = parseInt(entry[`series${i}`], 10);
            }
            
            
        }
    });
    return data;

};