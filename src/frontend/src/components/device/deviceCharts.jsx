import React, { useState, useEffect } from 'react';
import { ResponsiveContainer } from 'recharts';
import { useParams, useNavigate, useSearchParams, data } from 'react-router-dom';
import { Monitor, Cpu, Calendar, CalendarDays, ChevronDown, AlertCircle, RefreshCw, Clock, SlidersHorizontal } from 'lucide-react';
import RenderIfAllowed from '../shared/RenderIfAllowed';
import { useWebSocket } from '../../Contexts/WebSocketContext';
import { CustomTooltip } from './customTooltips';
import {
    AreaChart,
    LineChart,
    Area,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    Brush
} from 'recharts';
import backendApi from '../../api/backendAxiosInstance';
import { filteredMonDataTransformer, data_unit_transformer } from '../features/Device/monDataTransformers';
import { convert_DateObj_to_input_strformat, ChartSettingsCard } from './utils';
import { useSelector } from 'react-redux';
import { charts_with_data_unit } from '../../redux/chartSettings';


const populatePlaceholderData = (size) => {
    return Array.from({ length: size }, (_, i) => ({
        timestamp: "",
        series1: 0,
        isPlaceholder: true,
    }))
};

export const Chart = (props) => {
    // Props
    const isDarkMode = props.isDarkMode || false;

    // Params
    const params = useParams();
    const agentId = params.agentId || params.ipMonitorUUID;
    const [searchParams, setSearchParams] = useSearchParams();
    const graphType = searchParams.get('graph') || 'line';
    const fromDT = searchParams.get('fromDT') || null;
    const toDT = searchParams.get('toDT') || null;
    const component = searchParams.get('component') || null;

    //loading state 
    const [isLoading, setIsLoading] = useState(false);

    // States and Hooks
    const { agentSubscribe } = useWebSocket();
    const [isFilterationApplied, setIsFilterationApplied] = useState(fromDT && toDT ? true : false);
    const [isChartDataPlaceholder, setisChartDataPlaceholder] = useState(true);
    const [unsubscribeFunc, setUnsubscribeFunc] = useState(null);
    const [chartData, setChartData] = useState(populatePlaceholderData(props.chartSize));
    const chartSettings = useSelector((state) => state.chartSettings[props.mon_type]);

    useEffect(() => {
        if (chartData.length > 0 && "isPlaceholder" in chartData[chartData.length - 1]) {
            setisChartDataPlaceholder(true);
        }
    }, [chartData]);

    useEffect(() => {
    let unsubscribe = null;
    let isMounted = true;

    if (fromDT && toDT) {
        setIsFilterationApplied(true);
        setChartData([]);
        setIsLoading(true);

        const payload = { key: props.mon_type, fromDT, toDT, agent_uuid: agentId };
        if (component != null) payload.component = component;

        backendApi.post(`monitoring/charts/`, payload)
            .then(response => {
                if (!isMounted) return;
                setSeriesCount(3);
                setChartData(filteredMonDataTransformer(response.data.data));
                setisChartDataPlaceholder(false);
            })
            .catch(error => {
                if (!isMounted) return;
                console.error("Error fetching filtered data:", error); // ✅ Keep
                setChartData([]);
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });
    } else {
        setIsFilterationApplied(false);
        setSeriesCount(props.seriesCount || 1);
        setChartData(populatePlaceholderData(props.chartSize));
        setIsLoading(true);

        let hasReceivedData = false;

        const handleRealtimeData = (newData) => {
            if (!isMounted) return;
            hasReceivedData = true;
            handleChartData(newData);
            setIsLoading(false);
            setisChartDataPlaceholder(false);
        };

        unsubscribe = agentSubscribe(agentId, props.mon_type, handleRealtimeData, component);

        const timeout = setTimeout(() => {
            if (!hasReceivedData && isMounted) {
                setIsLoading(false);
                setChartData([]);
            }
        }, 5000);

        return () => {
            isMounted = false;
            if (unsubscribe) unsubscribe();
            clearTimeout(timeout);
        };
    }
}, [fromDT, toDT, agentId, props.mon_type, component, props.chartSize, props.seriesCount]);

    const handleChartData = (newData) => {
        setChartData((prevData) => {
            const updatedData = [...prevData, ...[newData]];
            // Limit data points to last chartSize entries
            if (updatedData.length > props.chartSize) {
                return updatedData.slice(updatedData.length - props.chartSize);
            }
            return updatedData;
        });
        if (isChartDataPlaceholder) setisChartDataPlaceholder(false);
    };

    const [seriesCount, setSeriesCount] = useState(props.seriesCount || 1);
    const seriesNames = Array.from({ length: seriesCount }, (_, i) => `series${i + 1}`).reverse();

    const xAxisProps = {
        dataKey: props.xAxisKey,
        angle: isFilterationApplied ? 0 : -35,
        textAnchor: isFilterationApplied ? 'middle' : 'end',
        height: 50,
        axisLine: chartSettings.x_axis_line,
        tickLine: chartSettings.x_axis_tick_line,
        tick: { fill: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 11 },
        interval: isFilterationApplied ? null : 0,
        tickMargin: 4,
        type: "category",
    };
    const yAxisProps = {
        axisLine: chartSettings.y_axis_line,
        tickLine: chartSettings.y_axis_tick_line,
        tick: { fill: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 12 },
        tickFormatter: (value) => {
            if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
            if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
            return value;
        },
    };
    const customTooltipProps = {
        seriesCount: seriesCount,
        formatToDataUnit: charts_with_data_unit.includes(props.mon_type) ? chartSettings.data_unit : null,
    };

    const dataUnitTransformer = (row, series) => {
        const [data, unit] = data_unit_transformer(row[series], chartSettings.data_unit);
        return data;
    };

    const seriesColors = ['#352bf4ff', '#31ff80ff', '#f6b32dff'].reverse();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    return (
        <div className={`relative rounded-lg shadow-md p-3 sm:p-4 h-48 sm:h-60 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>

            <div className="flex flex-row items-center">
                {/* Heading, Timestamp and Settings Button Section */}
                <div className="justify-self-start flex-grow">
                    {/* Heading Section */}
                    <h4 className="text-md font-semibold mb-2">
                        <span>{props.chartTitle}</span>
                    </h4>
                </div>

                <div className="flex items-center flex-wrap">
                    <span className="text-xs font-bold text-gray-500 ">{fromDT && toDT ? `${convert_DateObj_to_input_strformat(new Date(fromDT), true)} - ${convert_DateObj_to_input_strformat(new Date(toDT), true)}` : `Last ${props.chartSize} DP`}</span>
                    <button
                        onClick={() => { setIsSettingsOpen(true) }}
                        className={`ml-2 p-1 rounded-md transition-colors ${isDarkMode
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        <SlidersHorizontal size={16} className={isDarkMode ? 'text-gray-300' : 'text-gray-700'} />
                    </button>

                </div>

            </div>

            <div className="-ml-2 -mr-2 h-40 sm:h-48 overflow-x-auto custom-scrollbar-horizontal">

                {/* 🔹 LOADING STATE */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 px-4">
                        <div className="text-xs sm:text-sm flex items-center gap-2">
                            <RefreshCw className="animate-spin" size={14} />
                            Loading data...
                        </div>
                    </div>
                ) : chartData.length === 0 ? (

                    /* 🔹 EMPTY STATE */
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 px-4">
                        <div className="text-xs sm:text-sm">No data available</div>
                    </div>

                ) : (

                    /* 🔹 DATA STATE */
                    <ResponsiveContainer width="100%" height="100%">
                        {graphType === 'line' && (
                            <LineChart name={props.name} data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} connectNulls={true}>
                                {
                                    seriesNames.map((series, index) => (
                                        <Line
                                            key={series}
                                            type="monotone"
                                            dataKey={
                                                charts_with_data_unit.includes(props.mon_type)
                                                    ? (row) => dataUnitTransformer(row, series)
                                                    : series
                                            }
                                            stroke={seriesColors[index % seriesColors.length]}
                                            strokeWidth={2}
                                            dot={chartSettings.dot}
                                            isAnimationActive={false}
                                        />
                                    ))
                                }
                                <XAxis {...xAxisProps} />
                                <YAxis {...yAxisProps} />
                                <Tooltip
                                    content={<CustomTooltip {...customTooltipProps} isDarkMode={isDarkMode} />}
                                    cursor={{ stroke: '#9CA3AF', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    isAnimationActive={false}
                                />
                                <Brush dataKey="timestamp" height={30} stroke="#8884d8" travellerWidth={10} />
                            </LineChart>
                        )}

                        {graphType === 'area' && (
                            <AreaChart name={props.name} data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} connectNulls={true}>
                                {
                                    seriesNames.map((series, index) => (
                                        <Area
                                            key={series}
                                            type="monotone"
                                            dataKey={
                                                charts_with_data_unit.includes(props.mon_type)
                                                    ? (row) => dataUnitTransformer(row, series)
                                                    : series
                                            }
                                            stroke={seriesColors[index % seriesColors.length]}
                                            fill={seriesColors[index % seriesColors.length]}
                                            dot={chartSettings.dot}
                                            isAnimationActive={false}
                                        />
                                    ))
                                }
                                <XAxis {...xAxisProps} />
                                <YAxis {...yAxisProps} />
                                <Tooltip
                                    content={<CustomTooltip {...customTooltipProps} isDarkMode={isDarkMode} />}
                                    cursor={{ stroke: '#9CA3AF', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    isAnimationActive={false}
                                />
                                <Brush dataKey="timestamp" height={30} stroke="#8884d8" travellerWidth={10} />
                            </AreaChart>
                        )}
                    </ResponsiveContainer>
                )}
            </div>

            {isSettingsOpen &&
                <ChartSettingsCard chart={props.mon_type} isOpen={[isSettingsOpen, setIsSettingsOpen]} isDarkMode={isDarkMode} />
            }

        </div>
    );

}
