import React, { useEffect, useState } from 'react';
import api, { authHeaders } from './api';

/**
 * WorkflowTaskView
 * - renders tasks list with small inline dependency arrow (→)
 * - provides: delete, delegate (PUT /tasks/:id), mark as seen (POST /tasks/:id/seen)
 * - shows status history (fetched from GET /tasks/:id/history if available)
 */
export default function WorkflowTaskView({ tasks = [], token, onDataChange }) {
  const [history, setHistory] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [assignTo, setAssignTo] = useState({}); // temporary per-task reassignment input
  const [usersForDelegation, setUsersForDelegation] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/assignable-users', { headers: authHeaders(token) });
        setUsersForDelegation(res.data || []);
      } catch (err) {
        // ignore
      }
    })();
  }, [token]);

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task permanently?')) return;
    setLoadingId(taskId);
    try {
      await api.delete(`/tasks/${taskId}`, { headers: authHeaders(token) });
      onDataChange && onDataChange();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete task.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleMarkSeen = async (taskId) => {
    try {
      await api.post(`/tasks/${taskId}/seen`, {}, { headers: authHeaders(token) });
      onDataChange && onDataChange();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark seen.');
    }
  };

  const handleDelegate = async (task) => {
    const newAssignee = assignTo[task.id];
    if (!newAssignee) return alert('Select a user to delegate to.');
    // Role-based permissions should be enforced server-side; attempt PUT
    setLoadingId(task.id);
    try {
      await api.put(`/tasks/${task.id}`, { assignee_id: newAssignee }, { headers: authHeaders(token) });
      onDataChange && onDataChange();
      setAssignTo(prev => ({ ...prev, [task.id]: '' }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delegate task.');
    } finally {
      setLoadingId(null);
    }
  };

  const fetchHistory = async (taskId) => {
    if (history[taskId]) return; // cached
    try {
      const res = await api.get(`/tasks/${taskId}/history`, { headers: authHeaders(token) }).catch(() => null);
      setHistory(prev => ({ ...prev, [taskId]: res?.data || [] }));
    } catch (err) {
      setHistory(prev => ({ ...prev, [taskId]: [] }));
    }
  };

  return (
    <div className="workflow-task-container" style={{ overflowX: 'auto' }}>
      <h3>Task Flow</h3>
      <div className="task-flow-canvas" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {tasks.map((task, index) => (
          <React.Fragment key={task.id}>
            <div className="task-node-card" style={{ minWidth: 260, maxWidth: 340 }}>
              <div className="task-node-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{task.title}</strong>
                <div>
                  {task.seen_at && <span className="seen-indicator" title={`Seen on: ${new Date(task.seen_at).toLocaleString()}`}>✔</span>}
                  <button className="btn-delete-task" onClick={() => handleDeleteTask(task.id)} disabled={loadingId === task.id}>×</button>
                </div>
              </div>

              <div className="task-node-body">
                <p>Assignee: {task.assignee_name || 'N/A'}</p>
                <p>Status: <strong>{task.status}</strong></p>
                {task.due_date && <p>Due: <small>{new Date(task.due_date).toLocaleString()}</small></p>}
                {task.blocked_by_count > 0 && <p style={{ color: '#dd6b20' }}>Blocked by {task.blocked_by_count} task(s)</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn-primary" onClick={() => handleMarkSeen(task.id)}>Mark As Seen</button>
                </div>

                {/* Delegation UI */}
                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'block', fontSize: 13 }}>Delegate to</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select value={assignTo[task.id] || ''} onChange={e => setAssignTo(prev => ({ ...prev, [task.id]: e.target.value }))}>
                      <option value="">Select</option>
                      {usersForDelegation.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                    </select>
                    <button className="btn-secondary" onClick={() => handleDelegate(task)} disabled={loadingId === task.id}>Assign</button>
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <button className="btn-secondary" onClick={() => fetchHistory(task.id)} style={{ marginRight: 8 }}>Show Status History</button>
                  {history[task.id] && history[task.id].length ? (
                    <ul style={{ fontSize: 13 }}>
                      {history[task.id].map((h, i) => <li key={i}>{new Date(h.at).toLocaleString()}: {h.note || h.status}</li>)}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Arrow between tasks for visual flow */}
            {index < tasks.length - 1 && <div className="task-arrow" style={{ alignSelf: 'center', fontSize: 24 }}>→</div>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
