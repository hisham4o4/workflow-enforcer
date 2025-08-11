import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminFlowChart from './AdminFlowChart';

const API_URL = process.env.REACT_APP_API_URL;

// A simple Modal component for editing tasks
const EditTaskModal = ({ task, users, onClose, onSave, token }) => {
    const [formData, setFormData] = useState({ ...task });
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        const fetchLogs = async () => {
            const res = await axios.get(`${API_URL}/tasks/${task.id}/logs`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLogs(res.data);
        };
        fetchLogs();
    }, [task.id, token]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSave = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h2>Edit Task: {task.title}</h2>
                <form onSubmit={handleSave}>
                    {/* Form fields for editing */}
                    <input name="title" value={formData.title} onChange={handleChange} />
                    <select name="assignee_id" value={formData.assignee_id} onChange={handleChange}>
                        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                    </select>
                    {/* Add other fields as needed: supervisor, due_date, status, is_urgent */}
                    <button type="submit">Save Changes</button>
                    <button type="button" onClick={onClose}>Cancel</button>
                </form>
                <div className="task-logs">
                    <h3>Edit History</h3>
                    <ul>
                        {logs.map(log => (
                            <li key={log.id}>
                                {new Date(log.created_at).toLocaleString()}: {log.change_description}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

const AdminDashboard = ({ token }) => {
    const [workflows, setWorkflows] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [workflowData, setWorkflowData] = useState({ nodes: [], edges: [] });
    const [message, setMessage] =useState('');
    const [newWorkflowName, setNewWorkflowName] = useState('');
    
    // State for the modal
    const [editingTask, setEditingTask] = useState(null);

    // State for creating dependencies
    const [sourceNode, setSourceNode] = useState('');
    const [targetNode, setTargetNode] = useState('');

    useEffect(() => {
        // Fetch initial data (workflows and users)
    }, [token]);

    const handleSelectWorkflow = async (workflow) => {
        setSelectedWorkflow(workflow);
        try {
            const response = await axios.get(`${API_URL}/admin/workflow-stats/${workflow.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setWorkflowData(response.data);
        } catch (error) {
            setMessage(`Could not fetch data for ${workflow.name}.`);
        }
    };
    
    const handleUpdateTask = async (taskData) => {
        try {
            await axios.put(`${API_URL}/tasks/${taskData.id}`, taskData, { headers: { Authorization: `Bearer ${token}` } });
            setEditingTask(null);
            handleSelectWorkflow(selectedWorkflow); // Refresh data
            setMessage("Task updated successfully.");
        } catch (error) {
            setMessage("Failed to update task.");
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm("Are you sure you want to delete this task?")) return;
        try {
            await axios.delete(`${API_URL}/tasks/${taskId}`, { headers: { Authorization: `Bearer ${token}` } });
            handleSelectWorkflow(selectedWorkflow); // Refresh data
            setMessage("Task deleted successfully.");
        } catch (error) {
            setMessage("Failed to delete task.");
        }
    };

    const handleCreateDependency = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/edges`, { source_node_id: sourceNode, target_node_id: targetNode }, { headers: { Authorization: `Bearer ${token}` } });
            handleSelectWorkflow(selectedWorkflow); // Refresh
            setMessage("Dependency created.");
        } catch (error) {
            setMessage(error.response?.data?.message || "Failed to create dependency.");
        }
    };

    // Other handlers for create/delete workflow remain the same...

    return (
        <div className="admin-dashboard">
            {editingTask && <EditTaskModal task={editingTask} users={users} onClose={() => setEditingTask(null)} onSave={handleUpdateTask} token={token} />}
            <div className="admin-left-column">
                {/* Workflow list and creation form... */}
            </div>
            <div className="admin-right-column">
                {selectedWorkflow ? (
                    <>
                        <h2>Managing: {selectedWorkflow.name}</h2>
                        
                        {/* Task List Display */}
                        <div className="task-list-container">
                            <h3>Tasks in this Workflow</h3>
                            {workflowData.nodes.map(node => (
                                <div key={node.id} className="admin-task-item">
                                    <span>{node.title} ({node.status})</span>
                                    <div>
                                        <button onClick={() => setEditingTask(node)}>Edit</button>
                                        <button onClick={() => handleDeleteTask(node.id)}>Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Dependency Creation Form */}
                        <div className="dependency-form-container">
                            <h3>Create Task Dependency</h3>
                            <form onSubmit={handleCreateDependency}>
                                <label>When this task...</label>
                                <select value={sourceNode} onChange={e => setSourceNode(e.target.value)} required>
                                    <option value="">Select Source Task</option>
                                    {workflowData.nodes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
                                </select>
                                <label>...is complete, then this task can start:</label>
                                <select value={targetNode} onChange={e => setTargetNode(e.target.value)} required>
                                    <option value="">Select Target Task</option>
                                    {workflowData.nodes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
                                </select>
                                <button type="submit">Create Dependency</button>
                            </form>
                        </div>
                        
                        <AdminFlowChart workflow={selectedWorkflow} token={token} />
                    </>
                ) : (
                    <DashboardGreeting userRole="Admin" />
                )}
            </div>
        </div>
    );
};
export default AdminDashboard;