import React, { useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

const AdminFlowChart = ({ workflow, token }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/admin/workflow-stats/${workflow.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setData(res.data);
        } catch (error) {
            console.error("Failed to fetch workflow stats", error);
        }
        setLoading(false);
    };

    return (
        <div style={{ border: '2px solid blue', padding: '15px', marginTop: '20px' }}>
            <h3>Flow Chart Hub: {workflow.name}</h3>
            <button onClick={fetchData} disabled={loading}>
                {loading ? 'Loading...' : 'Load Workflow & Stats'}
            </button>
            
            {data && (
                <div>
                    <h4>Statistics</h4>
                    <ul>
                        <li>Total Tasks: {data.stats.totalTasks}</li>
                        <li>Completed: {data.stats.completedTasks}</li>
                        <li>Overdue: {data.stats.overdueTasks}</li>
                        <li>Urgent: {data.stats.urgentTasks}</li>
                    </ul>

                    <h4>Tasks (Nodes)</h4>
                    <pre style={{ backgroundColor: '#f0f0f0', padding: '10px', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(data.nodes, null, 2)}
                    </pre>

                    <h4>Dependencies (Edges)</h4>
                     <pre style={{ backgroundColor: '#f0f0f0', padding: '10px', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(data.edges, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default AdminFlowChart;