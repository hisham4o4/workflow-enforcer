import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminFlowChart from './AdminFlowChart';

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

  // Data Fetching Hooks
  const fetchWorkflows = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/workflows`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkflows(response.data);
    } catch (error) {
      setMessage('Could not fetch workflows.');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/assignable-users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
      if (response.data.length > 0) {
        setNewNodeAssignee(response.data[0].id);
      }
    } catch (error) {
      setMessage('Could not fetch users.');
    }
  };

  useEffect(() => {
    fetchWorkflows();
    fetchUsers();
  }, [token]);

  // Event Handlers
  const handleSelectWorkflow = async (workflow) => {
    setSelectedWorkflow(workflow);
    try {
      const response = await axios.get(`${API_URL}/api/admin/workflow-stats/${workflow.id}`, {
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
      const response = await axios.post(`${API_URL}/api/workflows`, { name: newWorkflowName }, {
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
      await axios.delete(`${API_URL}/api/workflows/${workflowId}`, {
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

  const handleAddTaskToWorkflow = async (e) => {
    e.preventDefault();
    if (!selectedWorkflow) {
      setMessage("Please select a workflow first.");
      return;
    }

    const taskData = {
      title: newNodeTitle,
      assignee_id: newNodeAssignee,
      supervisor_id: newNodeSupervisor || null,
      due_date: dueDate,
      is_urgent: isUrgent,
    };

    try {
      await axios.post(`${API_URL}/workflows/${selectedWorkflow.id}/nodes`, taskData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(`Task "${newNodeTitle}" added to workflow.`);
      // Reset form and refresh tasks
      setNewNodeTitle('');
      setDueDate('');
      setIsUrgent(false);
      setNewNodeSupervisor('');
      handleSelectWorkflow(selectedWorkflow);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not add task to workflow.');
    }
  };

  return (
    <div className="admin-dashboard">
      {/* Left Column: Workflows List & Creation */}
      <div className="admin-left-column">
        <h2>Workflows</h2>
        {message && <div className="message error"><em>{message}</em></div>}
        
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
        
        <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
        
        {workflows.map(w => (
          <div key={w.id} className="admin-workflow-item">
            <span>{w.name}</span>
            <div>
              <button onClick={() => handleSelectWorkflow(w)}>Manage</button>
              <button onClick={() => handleDeleteWorkflow(w.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Right Column: Details for Selected Workflow */}
      <div className="admin-right-column">
        {selectedWorkflow ? (
          <>
            <h2>Managing: {selectedWorkflow.name}</h2>
            
            {/* Section to add a new task to the selected workflow */}
            <div className="admin-add-task-section">
              <h3>Add New Task to Workflow</h3>
              <form onSubmit={handleAddTaskToWorkflow}>
                <div>
                  <label>Title:</label>
                  <input 
                    type="text" 
                    value={newNodeTitle} 
                    onChange={(e) => setNewNodeTitle(e.target.value)} 
                    required 
                  />
                </div>
                
                <div>
                  <label>Assign To:</label>
                  <select 
                    value={newNodeAssignee} 
                    onChange={(e) => setNewNodeAssignee(e.target.value)}
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label>Optional Supervisor:</label>
                  <select 
                    value={newNodeSupervisor} 
                    onChange={(e) => setNewNodeSupervisor(e.target.value)}
                  >
                    <option value="">None</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label>Due Date:</label>
                  <input 
                    type="datetime-local" 
                    value={dueDate} 
                    onChange={(e) => setDueDate(e.target.value)} 
                    required 
                  />
                </div>
                
                <div>
                  <label>
                    <input 
                      type="checkbox" 
                      checked={isUrgent} 
                      onChange={(e) => setIsUrgent(e.target.checked)} 
                    /> 
                    Mark as Urgent
                  </label>
                </div>
                
                <button type="submit">Add Task to "{selectedWorkflow.name}"</button>
              </form>
            </div>

            {/* The Flow Chart Hub component */}
            <AdminFlowChart workflow={selectedWorkflow} token={token} />
          </>
        ) : (
          <div className="admin-select-message">
            <h2>Select a workflow to manage it.</h2>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;