import React, { useEffect, useState } from 'react';
import api, { authHeaders } from './api';
import AdminFlowChart from './AdminFlowChart'; // keep existing chart
import DashboardGreeting from './DashboardGreeting';
import WorkflowTaskView from './WorkflowTaskView';
import MasterFlowView from './MasterFlowView';
import CreateTaskForm from './CreateTaskForm';

/**
 * AdminDashboard
 * - minimal structural fixes for broken buttons and API usage
 * - adds "Master Flow View" for live monitoring
 */
export default function AdminDashboard({ token }) {
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [workflowData, setWorkflowData] = useState({ nodes: [], edges: [] });
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [showMasterFlow, setShowMasterFlow] = useState(false);

  useEffect(() => {
    const fetchWorkflowsAndUsers = async () => {
      try {
        const [workflowsRes, usersRes] = await Promise.all([
          api.get('/workflows', { headers: authHeaders(token) }),
          api.get('/assignable-users', { headers: authHeaders(token) })
        ]);
        setWorkflows(workflowsRes.data || []);
        setUsers(usersRes.data || []);
      } catch (error) {
        setMessage('Failed to load initial data.');
      }
    };
    fetchWorkflowsAndUsers();
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

  const handleCreateWorkflow = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/workflows', { name: e.target.elements.workflowName.value }, { headers: authHeaders(token) });
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

  return (
    <div className="admin-dashboard">
      <div className="admin-left-column">
        <h2>Workflows</h2>
        <form onSubmit={handleCreateWorkflow} aria-label="create-workflow">
          <input name="workflowName" placeholder="New workflow name" required />
          <button type="submit" className="btn-primary">Save</button>
        </form>

        <hr />
        <div className="workflow-list">
          {workflows.map(w => (
            <div key={w.id} className="admin-workflow-item">
              <span>{w.name}</span>
              <div>
                <button onClick={() => handleSelectWorkflow(w)} className="btn-primary">Manage</button>
                <button className="btn-delete" onClick={() => handleDeleteWorkflow(w.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        {/* Master Flow launch */}
        <div style={{ marginTop: 16 }}>
          <button className="btn-secondary" onClick={() => setShowMasterFlow(true)}>Master Flow View</button>
        </div>
      </div>

      <div className="admin-right-column">
        {selectedWorkflow ? (
          <div>
            <h2>Managing: {selectedWorkflow.name}</h2>
            <CreateTaskForm token={token} onTaskCreated={() => handleSelectWorkflow(selectedWorkflow)} />
            <WorkflowTaskView tasks={workflowData.nodes} token={token} onDataChange={() => handleSelectWorkflow(selectedWorkflow)} />
            <AdminFlowChart workflow={selectedWorkflow} token={token} />
          </div>
        ) : (
          <DashboardGreeting userRole="Admin" />
        )}
      </div>

      {showMasterFlow && (
        <div className="master-flow-modal" style={{
          position: 'fixed', inset: 16, background: 'rgba(0,0,0,0.6)', padding: 20, zIndex: 9999, overflow: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ color: 'white' }}>Master Flow</h2>
            <button className="btn-secondary" onClick={() => setShowMasterFlow(false)}>Close</button>
          </div>
          <div style={{ background: '#0b0b0b', padding: 12, borderRadius: 8, marginTop: 8 }}>
            <MasterFlowView token={token} />
          </div>
        </div>
      )}
    </div>
  );
}
