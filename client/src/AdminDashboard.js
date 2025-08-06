import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

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
        <div className="admin-grid">
          <div className="workflows-panel">
            <h2 className="panel-title">Workflows</h2>
            {message && <p className={`message ${message.includes('created') || message.includes('deleted') ? 'success' : 'error'}`}>{message}</p>}
            
            <form className="create-form" onSubmit={handleCreateWorkflow}>
              <input
                className="form-input"
                type="text"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                placeholder="New workflow name"
                required
              />
              <button className="btn-primary" type="submit">Create Workflow</button>
            </form>
            
            {workflows.map(w => (
              <div key={w.id} className="workflow-item">
                <span className="workflow-name">{w.name}</span>
                <div className="workflow-actions">
                  <button className="btn-select" onClick={() => handleSelectWorkflow(w)}>Select</button>
                  <button className="btn-delete" onClick={() => handleDeleteWorkflow(w.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
      
          <div className="tasks-panel">
            {selectedWorkflow ? (
              <>
                <h2 className="panel-title">Tasks for: {selectedWorkflow.name}</h2>
                {workflowTasks.length === 0 ? (
                  <div className="empty-state">
                    <h3>No tasks yet</h3>
                    <p>Add your first task below</p>
                  </div>
                ) : (
                  <div className="task-grid">
                    {workflowTasks.map(task => (
                      <div key={task.id} className="task-card">
                        <h3 className="task-title">{task.title}</h3>
                        <span className={`task-status ${task.status}`}>{task.status}</span>
                        <p className="task-due">Assigned to: {task.assignee || 'Unassigned'}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="create-form">
                  <h3 className="panel-title">Add New Task</h3>
                  <form onSubmit={handleAddTask}>
                    <div className="form-group">
                      <label className="form-label">Title</label>
                      <input 
                        className="form-input"
                        type="text" 
                        value={newNodeTitle} 
                        onChange={(e) => setNewNodeTitle(e.target.value)}
                        required 
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Assign To</label>
                        <select 
                          className="select-input"
                          value={newNodeAssignee} 
                          onChange={(e) => setNewNodeAssignee(e.target.value)}
                        >
                          {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Due Date</label>
                        <input 
                          className="form-input"
                          type="datetime-local" 
                          value={dueDate} 
                          onChange={(e) => { setDueDate(e.target.value); setDueTimeInHours(''); }} 
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">OR Hours from now</label>
                        <input 
                          className="form-input"
                          type="number" 
                          value={dueTimeInHours} 
                          onChange={(e) => { setDueTimeInHours(e.target.value); setDueDate(''); }} 
                        />
                      </div>
                    </div>
                    <button className="btn-primary" type="submit">Add Task</button>
                  </form>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <h3>Select a workflow</h3>
                <p>Choose a workflow from the left to view and manage its tasks</p>
              </div>
            )}
          </div>
        </div>
      );
};

export default AdminDashboard;