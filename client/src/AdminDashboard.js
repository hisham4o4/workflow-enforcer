import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminFlowChart from './AdminFlowChart';
import DashboardGreeting from './DashboardGreeting'; // Assuming this component exists

const API_URL = process.env.REACT_APP_API_URL;

const AdminDashboard = ({ token }) => {
    // Component State
    const [workflows, setWorkflows] = useState([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [workflowData, setWorkflowData] = useState({ nodes: [], edges: [] });
    const [users, setUsers] = useState([]);
    const [message, setMessage] = useState('');

    // UI Toggle State for cleaner forms
    const [showCreateWorkflow, setShowCreateWorkflow] = useState(false);
    const [showCreateTask, setShowCreateTask] = useState(false);

    // Form Input State
    const [newWorkflowName, setNewWorkflowName] = useState('');
    const [newNodeTitle, setNewNodeTitle] = useState('');
    // ... other form states

    // --- Data Fetching ---
    useEffect(() => {
        const fetchWorkflowsAndUsers = async () => {
            try {
                const [workflowsRes, usersRes] = await Promise.all([
                    axios.get(`${API_URL}/workflows`, { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get(`${API_URL}/assignable-users`, { headers: { Authorization: `Bearer ${token}` } })
                ]);
                setWorkflows(workflowsRes.data);
                setUsers(usersRes.data);
            } catch (error) {
                setMessage('Failed to load initial data.');
            }
        };
        fetchWorkflowsAndUsers();
    }, [token]);
    
    // --- Handlers ---
    const handleSelectWorkflow = async (workflow) => {
        setSelectedWorkflow(workflow);
        setShowCreateTask(false); // Hide form when switching
        try {
            const response = await axios.get(`${API_URL}/admin/workflow-stats/${workflow.id}`, { headers: { Authorization: `Bearer ${token}` } });
            setWorkflowData(response.data);
        } catch (error) {
            setMessage(`Could not fetch data for ${workflow.name}.`);
        }
    };
    
    const handleCreateWorkflow = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(`${API_URL}/workflows`, { name: newWorkflowName }, { headers: { Authorization: `Bearer ${token}` } });
            setWorkflows([...workflows, response.data]);
            setNewWorkflowName('');
            setShowCreateWorkflow(false);
            setMessage(`Workflow "${response.data.name}" created.`);
        } catch (error) {
            setMessage('Could not create workflow.');
        }
    };

    const handleDeleteWorkflow = async (workflowId) => {
        if (!window.confirm("Are you sure? This will delete the workflow and all associated tasks.")) return;
        try {
            await axios.delete(`${API_URL}/workflows/${workflowId}`, { headers: { Authorization: `Bearer ${token}` } });
            setWorkflows(workflows.filter(w => w.id !== workflowId));
            if (selectedWorkflow?.id === workflowId) {
                setSelectedWorkflow(null);
                setWorkflowData({ nodes: [], edges: [] });
            }
            setMessage('Workflow deleted.');
        } catch (error) {
            setMessage(error.response?.data?.message || 'Could not delete workflow.');
        }
    };

    // --- JSX Render ---
    return (
        <div className="admin-dashboard">
            <div className="admin-left-column">
                <h2>Workflows</h2>
                <button onClick={() => setShowCreateWorkflow(!showCreateWorkflow)}>
                    {showCreateWorkflow ? 'Cancel' : '+ New Workflow'}
                </button>
                {showCreateWorkflow && (
                    <form onSubmit={handleCreateWorkflow} className="create-workflow-form">
                        <input type="text" value={newWorkflowName} onChange={(e) => setNewWorkflowName(e.target.value)} placeholder="New workflow name" required />
                        <button type="submit">Save</button>
                    </form>
                )}
                <hr />
                <div className="workflow-list">
                    {workflows.map(w => (
                        <div key={w.id} className="admin-workflow-item">
                            <span>{w.name}</span>
                            <div>
                                <button onClick={() => handleSelectWorkflow(w)}>Manage</button>
                                <button className="btn-delete" onClick={() => handleDeleteWorkflow(w.id)}>Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="admin-right-column">
                {selectedWorkflow ? (
                    <div>
                        <h2>Managing: {selectedWorkflow.name}</h2>
                        {/* Task list, dependency creation, etc. will go here */}
                        <WorkflowTaskView tasks={workflowData.nodes} token={token} onDataChange={() => handleSelectWorkflow(selectedWorkflow)} />
                        <AdminFlowChart workflow={selectedWorkflow} token={token} />
                    </div>
                ) : (
                    <DashboardGreeting userRole="Admin" />
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;