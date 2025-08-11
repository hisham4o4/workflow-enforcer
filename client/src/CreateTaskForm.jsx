import React, { useEffect, useState } from 'react';
import api, { authHeaders } from './api';

/**
 * CreateTaskForm
 * - validates inputs
 * - warns about existing blocking dependencies for chosen assignee
 * - uses POST /tasks
 */
export default function CreateTaskForm({ token, onTaskCreated }) {
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [assigneeWarnings, setAssigneeWarnings] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/assignable-users', { headers: authHeaders(token) });
        setAssignableUsers(res.data || []);
        if (res.data && res.data.length) setAssigneeId(res.data[0].id);
      } catch (err) {
        console.error('Could not fetch users', err);
        setMessage('Failed to fetch users');
      }
    };
    fetchUsers();
  }, [token]);

  useEffect(() => {
    if (!assigneeId) return;
    // fetch brief stats for assignee (blocked tasks / overdue)
    (async () => {
      try {
        const res = await api.get(`/users/${assigneeId}/summary`, { headers: authHeaders(token) }).catch(() => null);
        if (res?.data) {
          setAssigneeWarnings({
            blocked_by_count: res.data.blocked_by_count,
            overdue_count: res.data.overdue_count,
          });
        } else {
          setAssigneeWarnings(null);
        }
      } catch (err) {
        setAssigneeWarnings(null);
      }
    })();
  }, [assigneeId, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setMessage('Title is required');
    if (!assigneeId) return setMessage('Choose an assignee');
    if (!dueDate) return setMessage('Due date is required');

    // Dependency warning: if assignee already has many overdue tasks we show a confirm
    if (assigneeWarnings?.overdue_count > 3) {
      if (!window.confirm('Selected assignee has multiple overdue tasks. Continue?')) return;
    }

    try {
      const payload = {
        title,
        assignee_id: assigneeId,
        supervisor_id: supervisorId || null,
        due_date: dueDate,
        is_urgent: isUrgent,
      };
      await api.post('/tasks', payload, { headers: authHeaders(token) });
      setMessage('Task created successfully!');
      setTitle('');
      setDueDate('');
      setIsUrgent(false);
      setSupervisorId('');
      onTaskCreated && onTaskCreated();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to create task.');
    }
  };

  return (
    <div className="create-task-container" aria-live="polite">
      <h3>Create a New Task</h3>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Task Title:</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter task title" required />
        </div>

        <div>
          <label>Assign To:</label>
          <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} required>
            {assignableUsers.map(u => <option key={u.id} value={u.id}>{u.username} {u.role !== undefined ? `(${u.role})` : ''}</option>)}
          </select>
          {assigneeWarnings && (
            <div style={{ marginTop: 6, fontSize: 13, color: '#c53030' }}>
              <strong>Warning:</strong> Assignee has {assigneeWarnings.overdue_count ?? 0} overdue task(s)
            </div>
          )}
        </div>

        <div>
          <label>Optional Supervisor:</label>
          <select value={supervisorId} onChange={e => setSupervisorId(e.target.value)}>
            <option value="">None</option>
            {assignableUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
        </div>

        <div>
          <label>Due Date:</label>
          <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
        </div>

        <div>
          <label>
            <input type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)} />
            Mark as Urgent
          </label>
        </div>

        <button type="submit" className="btn-primary">Create Task</button>
      </form>

      {message && <div className={`message ${message.includes('success') ? 'success' : 'error'}`} style={{ marginTop: 12 }}>{message}</div>}
    </div>
  );
}
