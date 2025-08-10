import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminFlowChart from './AdminFlowChart'; // Import the new hub component

const API_URL = process.env.REACT_APP_API_URL;

const AdminDashboard = ({ token }) => {
    // State management for workflows, users, and UI messages
    const [workflows, setWorkflows] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [workflowTasks, setWorkflowTasks] = useState([]);
    const [message, setMessage] = useState('');

    // State for the "Create Workflow" form
    const [newWorkflowName, setNewWorkflowName] = useState('');

    // State for the "Add Task to Workflow" form
    const [newNodeTitle, setNewNodeTitle] = useState('');
    const [newNodeAssignee, setNewNodeAssignee] = useState('');
    const [newNodeSupervisor, setNewNodeSupervisor] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);

    // --- Data Fetching Hooks ---
    const fetchWorkflows = async () => {
        try {
            const response = await axios.get(`${API_URL}/workflows`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setWorkflows(response.data);
        } catch (error) {
            setMessage('Could not fetch workflows.');
        }
    };

    const fetchUsers = async () => {
        try {
            // Admin should be able to assign to anyone, this endpoint handles the logic
            const response = await axios.get(`${API_URL}/assignable-users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(response.data);
            if (response.data.length > 0) {
                setNewNodeAssignee(response.data[0].id); // Default to the first user
            }
        } catch (error) {
            setMessage('Could not fetch users.');
        }
    };

    useEffect(() => {
        fetchWorkflows();
        fetchUsers();
    }, [token]);

    // --- Event Handlers ---
    const handleSelectWorkflow = async (workflow) => {
        setSelectedWorkflow(workflow);
        try {
            // Note: This endpoint was updated in the last step to provide a simple node list.
            // The new AdminFlowChart component will fetch the richer data.
            const response = await axios.get(`${API_URL}/admin/workflow-stats/${workflow.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setWorkflowTasks(response.data.nodes);
        } catch (error) {
            setMessage(`Could not fetch tasks for ${workflow.name}.`);
            setWorkflowTasks([]);
        }
    };

    const handleCreateWorkflow = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(`${API_URL}/workflows`, { name: newWorkflowName }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setWorkflows([...workflows, response.data]);
            setNewWorkflowName('');
            setMessage(`Workflow "${response.data.name}" created.`);
        } catch (error) {
            setMessage('Could not create workflow.');
        }
    };

    const handleDeleteWorkflow = async (workflowId) => {
        if (!window.confirm("Are you sure you want to delete this workflow and all its tasks?")) return;
        try {
            await axios.delete(`${API_URL}/workflows/${workflowId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setWorkflows(workflows.filter(w => w.id !== workflowId));
            if (selectedWorkflow?.id === workflowId) {
                setSelectedWorkflow(null);
                setWorkflowTasks([]);
            }
            setMessage('Workflow deleted.');
        } catch (error) {
            setMessage('Could not delete workflow.');
        }
    };

    // Modified to include new fields for creating tasks within a workflow
    const handleAddTaskToWorkflow = async (e) => {
        e.preventDefault();
        if (!selectedWorkflow) {
            setMessage("Please select a workflow first.");
            return;
        }

        // Note: Ensure your backend endpoint for adding nodes to a workflow
        // is updated to accept these new fields.
        const taskData = {
            title: newNodeTitle,
            assignee_id: newNodeAssignee,
            supervisor_id: newNodeSupervisor || null,
            due_date: dueDate,
            is_urgent: isUrgent,
        };

        try {
            // This endpoint is for Admins to build pre-defined chains
            await axios.post(`${API_URL}/workflows/${selectedWorkflow.id}/nodes`, taskData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(`Task "${newNodeTitle}" added to workflow.`);
            // Reset form and refresh tasks
            setNewNodeTitle('');
            setDueDate('');
            setIsUrgent(false);
            setNewNodeSupervisor('');
            handleSelectWorkflow(selectedWorkflow); // Refresh the view
        } catch (error) {
            setMessage(error.response?.data?.message || 'Could not add task to workflow.');
        }
    };

    // --- Render Method ---
    return (
        <div style={{ display: 'flex', gap: '20px', fontFamily: 'sans-serif' }}>
            {/* Left Column: Workflows List & Creation */}
            <div style={{ flex: 1 }}>
                <h2>Workflows</h2>
                {message && <p><em>{message}</em></p>}
                <form onSubmit={handleCreateWorkflow} style={{ marginBottom: '20px' }}>
                    <input
                        type="text"
                        value={newWorkflowName}
                        onChange={(e) => setNewWorkflowName(e.target.value)}
                        placeholder="New workflow name"
                        required
                        style={{ padding: '8px', marginRight: '5px' }}
                    />
                    <button type="submit" style={{ padding: '8px' }}>Create Workflow</button>
                </form>
                <hr />
                {workflows.map(w => (
                    <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px', borderBottom: '1px solid #eee' }}>
                        <span>{w.name}</span>
                        <div>
                            <button onClick={() => handleSelectWorkflow(w)}>Manage</button>
                            <button onClick={() => handleDeleteWorkflow(w.id)} style={{ marginLeft: '5px', backgroundColor: '#f44336', color: 'white' }}>Delete</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Right Column: Details for Selected Workflow */}
            <div style={{ flex: 2, borderLeft: '1px solid #ccc', paddingLeft: '20px' }}>
                {selectedWorkflow ? (
                    <>
                        <h2>Managing: {selectedWorkflow.name}</h2>
                        
                        {/* Section to add a new task to the selected workflow */}
                        <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '5px' }}>
                            <h3>Add New Task to Workflow</h3>
                            <form onSubmit={handleAddTaskToWorkflow}>
                                {/* Form fields for the new task */}
                                <div style={{ marginBottom: '10px' }}>
                                    <label>Title: </label>
                                    <input type="text" value={newNodeTitle} onChange={(e) => setNewNodeTitle(e.target.value)} required style={{ width: '100%', padding: '8px' }}/>
                                </div>
                                <div style={{ marginBottom: '10px' }}>
                                    <label>Assign To: </label>
                                    <select value={newNodeAssignee} onChange={(e) => setNewNodeAssignee(e.target.value)} style={{ width: '100%', padding: '8px' }}>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                    </select>
                                </div>
                                <div style={{ marginBottom: '10px' }}>
                                    <label>Optional Supervisor:</label>
                                    <select value={newNodeSupervisor} onChange={(e) => setNewNodeSupervisor(e.target.value)} style={{ width: '100%', padding: '8px' }}>
                                        <option value="">None</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                    </select>
                                </div>
                                <div style={{ marginBottom: '10px' }}>
                                    <label>Due Date: </label>
                                    <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
                                </div>
                                <div style={{ marginBottom: '15px' }}>
                                    <label><input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} /> Mark as Urgent</label>
                                </div>
                                <button type="submit" style={{ padding: '10px 15px', width: '100%' }}>Add Task to "{selectedWorkflow.name}"</button>
                            </form>
                        </div>
                        
                        {/* The new Flow Chart Hub component */}
                        <AdminFlowChart workflow={selectedWorkflow} token={token} />
                    </>
                ) : (
                    <h2>Select a workflow to manage it.</h2>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;