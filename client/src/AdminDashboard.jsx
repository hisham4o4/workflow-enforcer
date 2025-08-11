import React, { useEffect, useState } from 'react';
import api, { authHeaders } from './api';
import {
  Plus,
  Settings,
  Trash2,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Eye,
  Zap,
  Activity
} from 'lucide-react';

// Your existing components are kept
import AdminFlowChart from './AdminFlowChart';
import MasterFlowView from './MasterFlowView';
import CreateTaskForm from './CreateTaskForm';

export default function AdminDashboard({ token }) {
  // States from both versions, including 'loading' for better UX
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [workflowData, setWorkflowData] = useState({ nodes: [], edges: [] });
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [showMasterFlow, setShowMasterFlow] = useState(false);
  const [loading, setLoading] = useState(true); // From UI version
  const [masterFlowData, setMasterFlowData] = useState({ nodes: [], edges: [] }); // For the modal

  // --- DATA FETCHING (Your original logic with loading state) ---

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [workflowsRes, usersRes] = await Promise.all([
        api.get('/workflows', { headers: authHeaders(token) }),
        api.get('/assignable-users', { headers: authHeaders(token) })
      ]);
      setWorkflows(workflowsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error) {
      setMessage('Failed to load initial data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [token]);

  const handleSelectWorkflow = async (workflow) => {
    setSelectedWorkflow(workflow);
    try {
      const response = await api.get(`/admin/workflow-stats/${workflow.id}`, { headers: authHeaders(token) });
      setWorkflowData(response.data || { nodes: [], edges: [] });
    } catch (error) {
      setMessage(`Could not fetch data for ${workflow.name}.`);
    }
  };

  const fetchMasterFlow = async () => {
      try {
          const response = await api.get('/admin/master-flow', { headers: authHeaders(token) });
          setMasterFlowData(response.data);
      } catch (error) {
          setMessage('Failed to load master flow data.');
      }
  };


  // --- WORKFLOW & TASK ACTIONS (Your original logic) ---

  const handleCreateWorkflow = async (e) => {
    e.preventDefault();
    const name = e.target.workflowName.value.trim();
    if (!name) return;

    try {
      const response = await api.post('/workflows', { name }, { headers: authHeaders(token) });
      setWorkflows(prev => [...prev, response.data]);
      setMessage(`Workflow "${response.data.name}" created.`);
      e.target.reset();
    } catch (error) {
      setMessage('Could not create workflow.');
    }
  };

  const handleDeleteWorkflow = async (workflowId) => {
    if (!window.confirm("Are you sure? This will delete the workflow and all associated tasks.")) return;
    try {
      await api.delete(`/workflows/${workflowId}`, { headers: authHeaders(token) });
      setWorkflows(prev => prev.filter(w => w.id !== workflowId));
      if (selectedWorkflow?.id === workflowId) {
        setSelectedWorkflow(null);
        setWorkflowData({ nodes: [], edges: [] });
      }
      setMessage('Workflow deleted.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not delete workflow.');
    }
  };
  
  const handleForceComplete = async (taskId) => {
    if (!window.confirm('Force complete this task?')) return;
    try {
        // Assumes an endpoint like this exists.
        await api.post(`/admin/tasks/${taskId}/force-complete`, {}, { headers: authHeaders(token) });
        setMessage('Task marked as completed.');
        // Refresh the data for the currently selected workflow
        if (selectedWorkflow) {
            handleSelectWorkflow(selectedWorkflow);
        }
    } catch (error) {
        setMessage('Failed to complete task.');
    }
  };


  // --- HELPER FUNCTIONS (From UI version) ---

  const formatTime = (milliseconds) => {
    if (!milliseconds) return 'N/A';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const getStatusColor = (status, isUrgent) => {
    if (status === 'completed') return 'var(--status-completed)';
    if (status === 'overdue') return 'var(--status-overdue)';
    if (isUrgent) return 'var(--status-urgent)';
    return 'var(--text-secondary)';
  };

  // Loading spinner from the UI mock
  if (loading) {
    return (
      <div className="dashboard-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
          <div className="loading-spinner"></div>
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // --- JSX (New UI structure with your functionality) ---
  return (
    <div className="dashboard-content">
      <div style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Admin Dashboard</h2>
        {message && (
          <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>

      {/* Master Flow Modal using your MasterFlowView component */}
      {showMasterFlow && (
        <div className="modal-backdrop">
            <div className="modal-content">
                <div className="modal-header">
                  <h2 style={{ color: 'white', margin: 0 }}>Master Flow Monitor</h2>
                  <button className="btn-secondary" onClick={() => setShowMasterFlow(false)}>
                    Close
                  </button>
                </div>
                <div style={{ padding: '2rem' }}>
                    {/* Your component is rendered here */}
                    <MasterFlowView token={token} />
                </div>
            </div>
        </div>
      )}

      <div className="admin-dashboard">
        {/* Left Column - Workflows */}
        <div className="admin-left-column">
          <h3 className="section-title">Workflows</h3>
          <form onSubmit={handleCreateWorkflow} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input name="workflowName" className="form-input" placeholder="New workflow name" required style={{ flex: '1' }}/>
              <button type="submit" className="btn-primary">
                <Plus size={16} /> Create
              </button>
            </div>
          </form>

          <div className="workflow-list">
            {workflows.map(workflow => (
              <div key={workflow.id} className="workflow-item">
                <div>
                  <h4 className="workflow-name">{workflow.name}</h4>
                  <p className="workflow-description">{workflow.description}</p>
                </div>
                <div className="workflow-actions">
                  <button onClick={() => handleSelectWorkflow(workflow)} className="btn-primary" style={{ flex: '1' }}>
                    <Settings size={16} /> Manage
                  </button>
                  <button className="btn-danger" onClick={() => handleDeleteWorkflow(workflow.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-primary)' }}>
            <button className="btn-secondary" onClick={() => { setShowMasterFlow(true); fetchMasterFlow(); }} style={{ width: '100%' }}>
              <Activity size={16} /> Master Flow Monitor
            </button>
          </div>
        </div>

        {/* Right Column - Selected Workflow Details */}
        <div className="admin-right-column">
          {selectedWorkflow ? (
            <div>
              <h3 className="section-title">Managing: {selectedWorkflow.name}</h3>
              
              {/* Your CreateTaskForm component */}
              <CreateTaskForm 
                token={token}
                users={users}
                workflowId={selectedWorkflow.id}
                onTaskCreated={() => handleSelectWorkflow(selectedWorkflow)} // Refreshes data on creation
              />
              
              {/* Your AdminFlowChart component */}
              <div style={{ margin: '2rem 0' }}>
                  <h4 className="section-subtitle">Workflow Chart</h4>
                  <AdminFlowChart data={workflowData} />
              </div>

              {/* Task List from the new UI */}
              <div>
                <h4 className="section-subtitle">Workflow Tasks</h4>
                {workflowData.nodes && workflowData.nodes.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {workflowData.nodes.map(task => (
                      <div key={task.id} className={`task-card ${getStatusColor(task.status, task.is_urgent)}`}>
                        <div className="task-header">
                            <h5 className="task-title">{task.title}</h5>
                            <span className="badge" style={{ background: `${getStatusColor(task.status, task.is_urgent)}20`, color: getStatusColor(task.status, task.is_urgent) }}>
                                {task.status}
                            </span>
                        </div>
                        <div className="task-details">
                            <div><Users size={14} /> <strong>Assignee:</strong> {task.assignee_name || 'N/A'}</div>
                            <div><Clock size={14} /> <strong>Due:</strong> {new Date(task.due_date).toLocaleDateString()}</div>
                            {task.time_taken_ms && (
                                <div><BarChart3 size={14} /> <strong>Time:</strong> {formatTime(task.time_taken_ms)}</div>
                            )}
                        </div>
                        <div className="task-actions" style={{ marginTop: '1rem' }}>
                            <button className="btn-primary" onClick={() => handleForceComplete(task.id)} disabled={task.status === 'completed'}>
                                <Zap size={14} /> Force Complete
                            </button>
                            {/* Add other actions like 'Apply Penalty' here if needed */}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                    <div className="no-tasks-card">
                        <BarChart3 size={48} />
                        <h4>No Tasks Yet</h4>
                        <p>Create the first task for this workflow.</p>
                    </div>
                )}
              </div>
            </div>
          ) : (
            <div className="no-tasks-card">
              <Settings size={48} />
              <h4>Select a Workflow</h4>
              <p>Choose a workflow from the left to manage it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}