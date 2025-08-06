import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

const AdminDashboard = ({ token }) => {
    // State management
    const [workflows, setWorkflows] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [workflowTasks, setWorkflowTasks] = useState([]);
    const [message, setMessage] = useState('');

    // Form state
    const [newWorkflowName, setNewWorkflowName] = useState('');
    const [newNodeTitle, setNewNodeTitle] = useState('');
    const [newNodeAssignee, setNewNodeAssignee] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [dueTimeInHours, setDueTimeInHours] = useState('');

    // --- Data Fetching ---
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
            const response = await axios.get(`${API_URL}/users`, {
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
            const response = await axios.get(`${API_URL}/workflows/${workflow.id}`, {
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

    const handleAddTask = async (e) => {
        e.preventDefault();
        let finalDueDate;
        if (dueTimeInHours) {
            // Calculate due date from hours from now
            finalDueDate = new Date(Date.now() + dueTimeInHours * 60 * 60 * 1000);
        } else if (dueDate) {
            // Use the specific date provided
            finalDueDate = new Date(dueDate);
        } else {
            setMessage("Please set a due date or a time limit.");
            return;
        }

        const taskData = {
            title: newNodeTitle,
            assignee_id: newNodeAssignee,
            due_date: finalDueDate.toISOString() // Always send as ISO string
        };

        try {
            await axios.post(`${API_URL}/workflows/${selectedWorkflow.id}/nodes`, taskData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(`Task "${newNodeTitle}" added.`);
            // Reset form and refresh tasks
            setNewNodeTitle('');
            setDueDate('');
            setDueTimeInHours('');
            handleSelectWorkflow(selectedWorkflow);
        } catch (error) {
            setMessage('Could not add task.');
        }
    };

    // --- Render ---
    return (
        <div style={{ display: 'flex', gap: '20px' }}>
            {/* Left Column: Workflows List */}
            <div style={{ flex: 1 }}>
                <h2>Workflows</h2>
                {message && <p><em>{message}</em></p>}
                <form onSubmit={handleCreateWorkflow}>
                    <input
                        type="text"
                        value={newWorkflowName}
                        onChange={(e) => setNewWorkflowName(e.target.value)}
                        placeholder="New workflow name"
                        required
                    />
                    <button type="submit">Create Workflow</button>
                </form>
                <hr />
                {workflows.map(w => (
                    <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px' }}>
                        <span>{w.name}</span>
                        <div>
                            <button onClick={() => handleSelectWorkflow(w)}>Select</button>
                            <button onClick={() => handleDeleteWorkflow(w.id)} style={{ marginLeft: '5px' }}>Delete</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Right Column: Tasks for Selected Workflow */}
            <div style={{ flex: 2, borderLeft: '1px solid #ccc', paddingLeft: '20px' }}>
                {selectedWorkflow ? (
                    <>
                        <h2>Tasks for: {selectedWorkflow.name}</h2>
                        {workflowTasks.length > 0 ? (
                             <ul>{workflowTasks.map(task => <li key={task.id}>{task.title} (Assigned to: {task.assignee || 'N/A'}) - Status: {task.status}</li>)}</ul>
                        ) : <p>No tasks yet.</p>}
                       
                        <hr />
                        <h3>Add New Task</h3>
                        <form onSubmit={handleAddTask}>
                            <div>
                                <label>Title: </label>
                                <input type="text" value={newNodeTitle} onChange={(e) => setNewNodeTitle(e.target.value)} required />
                            </div>
                            <div>
                                <label>Assign To: </label>
                                <select value={newNodeAssignee} onChange={(e) => setNewNodeAssignee(e.target.value)}>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                </select>
                            </div>
                            <div>
                                <label>Due Date (e.g., Aug 7 2025): </label>
                                <input type="datetime-local" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setDueTimeInHours(''); }} />
                            </div>
                            <p>OR</p>
                             <div>
                                <label>Time Limit (in hours from now): </label>
                                <input type="number" value={dueTimeInHours} onChange={(e) => { setDueTimeInHours(e.target.value); setDueDate(''); }} />
                            </div>
                            <button type="submit" style={{marginTop: '10px'}}>Add Task</button>
                        </form>
                    </>
                ) : (
                    <h2>Select a workflow to see its tasks</h2>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;