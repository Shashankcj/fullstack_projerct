import backendApi from '../../../../api/backendAxiosInstance';

export const fetchComponentUUIDs = (agentId, component, setUUIDs) => {
    backendApi.get(`component-uuid-pair/${agentId}/${component}/`)
    .then(response => {
        setUUIDs(response.data);
    })
    .catch(error => {
        console.error("Error fetching UUIDs:", error);
    });
}