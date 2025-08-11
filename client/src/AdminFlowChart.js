import React, { useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

const AdminFlowChart = ({ workflow, token }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // FIX: Add this guard clause to prevent rendering if the workflow prop is missing.
  if (!workflow) {
    return null; // Or return a loading message like <div>Loading...</div>
  }

  const fetchData = async () => {
    setLoading(true);
    try {
      // This is now safe because we've confirmed 'workflow' exists.
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
    <div className="flow-chart-hub">
      {/* This is now safe to access */}
      <h3>Flow Chart Hub: {workflow.name}</h3>
      <button onClick={fetchData} disabled={loading}>
        {loading ? 'Loading...' : 'Load Visual Data'}
      </button>
      
      {data && (
        <div className="flow-chart-data">
          <h4>Statistics</h4>
          <ul>
            <li>Total Tasks: {data.stats.totalTasks}</li>
            <li>Completed: {data.stats.completedTasks}</li>
            <li>Overdue: {data.stats.overdueTasks}</li>
            <li>Urgent: {data.stats.urgentTasks}</li>
          </ul>

          <h4>Tasks (Nodes)</h4>
          <ul className="data-list">
            {data.nodes.map(node => (
              <li key={node.id}><strong>{node.title}</strong> (Status: {node.status}, Assignee: {node.assignee_name || 'N/A'})</li>
            ))}
          </ul>
          
          <h4>Dependencies (Edges)</h4>
          <ul className="data-list">
            {data.edges.map(edge => {
                const sourceNode = data.nodes.find(n => n.id === edge.source_node_id);
                const targetNode = data.nodes.find(n => n.id === edge.target_node_id);
                return (
                    <li key={edge.id}>
                        "{sourceNode?.title}" must be completed before "{targetNode?.title}"
                    </li>
                );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AdminFlowChart;