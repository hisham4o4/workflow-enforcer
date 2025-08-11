import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

const MasterFlowView = ({ token }) => {
    const [flowData, setFlowData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMasterFlow = async () => {
            try {
                const res = await axios.get(`${API_URL}/admin/master-flow`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setFlowData(res.data);
            } catch (error) {
                console.error("Failed to fetch master flow", error);
            }
            setLoading(false);
        };
        fetchMasterFlow();
    }, [token]);

    if (loading) return <p>Loading Master Flow...</p>;

    return (
        <div className="master-flow-container">
            <h2>Master Workflow Overview</h2>
            <p>This view shows all tasks from all workflows. For a true visual representation, consider a library like React Flow.</p>
            {flowData && (
                <div className="flow-chart-data">
                    <h4>All Tasks ({flowData.nodes.length})</h4>
                    <ul className="data-list">
                        {flowData.nodes.map(node => (
                            <li key={node.id}>
                                <strong>{node.title}</strong> (Workflow: {node.workflow_name}, Status: {node.status})
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default MasterFlowView;