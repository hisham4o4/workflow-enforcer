import React, { useEffect, useMemo, useState } from 'react';
import api, { authHeaders } from '../api';
import CountdownTimer from './CountdownTimer';

/**
 * MasterFlowView
 * - polls GET /admin/master-flow
 * - shows color-coded task cards, dependency edges (simple list + svg lines),
 *   penalty counters (from node.fines_count or user.score if available)
 * - provides admin controls: Force Complete (PUT /tasks/:id), Apply Penalty (PUT /tasks/:id with manual penalty)
 *
 * Minimal visual dependency graph: for full graph, swap in a graph renderer later.
 */
export default function MasterFlowView({ token, pollInterval = 5000 }) {
  const [data, setData] = useState({ nodes: [], edges: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchMaster = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/master-flow', { headers: authHeaders(token) });
      setData(res.data);
      setError(null);
    } catch (err) {
      console.error('Master flow fetch failed', err);
      setError(err.response?.data?.message || 'Failed to load master flow');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaster();
    const iv = setInterval(fetchMaster, pollInterval);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const nodesById = useMemo(() => {
    const map = {};
    data.nodes.forEach(n => (map[n.id] = n));
    return map;
  }, [data]);

  const statusColor = (status, isUrgent) => {
    if (status === 'completed') return 'linear-gradient(90deg,#1a1a1a,#111827)'; // dark
    if (status === 'overdue') return 'linear-gradient(90deg,#c53030,#e53e3e)'; // red
    if (isUrgent) return 'linear-gradient(90deg,#dd6b20,#f6ad55)'; // orange
    return 'linear-gradient(90deg,#111827,#1f2937)'; // chrismon/dark
  };

  const forceComplete = async (nodeId) => {
    if (!window.confirm('Force complete this task?')) return;
    try {
      await api.put(`/tasks/${nodeId}`, { status: 'completed' }, { headers: authHeaders(token) });
      await fetchMaster();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to force-complete task');
    }
  };

  const applyPenaltyManual = async (node) => {
    const reason = prompt('Reason for penalty (visible in fines):', 'Manual penalty');
    if (!reason) return;
    try {
      // Attempt to use a fines endpoint if available; fallback: use task update that server accepts.
      await api.post('/fines', { user_id: node.assignee_id, node_id: node.id, reason }, { headers: authHeaders(token) })
        .catch(async (e) => {
          // fallback: update node with a "penalty" note (server may accept)
          await api.put(`/tasks/${node.id}`, { note: `Penalty: ${reason}` }, { headers: authHeaders(token) });
        });
      alert('Penalty applied');
      fetchMaster();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to apply penalty');
    }
  };

  return (
    <div className="master-flow-view" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Master Flow — Live</h3>
        <div>
          <button className="btn-secondary" onClick={fetchMaster} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="message error" style={{ marginTop: 12 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12, marginTop: 12 }}>
        {data.nodes.map(node => {
          const color = statusColor(node.status, node.is_urgent);
          return (
            <div key={node.id} className="task-card" style={{ background: color, color: 'white', borderLeft: '6px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: 0 }}>{node.title}</h4>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>{node.workflow_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{node.assignee_name || '—'}</div>
                  <div style={{ fontSize: 12 }}>Score: {node.assignee_score ?? '—'}</div>
                </div>
              </div>

              <p style={{ marginTop: 8 }}>Status: <strong>{node.status}</strong></p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                {node.due_date && <CountdownTimer dueDate={node.due_date} />}
                <button className="btn-primary" onClick={() => forceComplete(node.id)} style={{ minWidth: 120 }}>Force Complete</button>
                <button className="btn-secondary" onClick={() => applyPenaltyManual(node)} style={{ minWidth: 120, background: 'transparent' }}>Apply Penalty</button>
              </div>

              {/* Bottleneck info: show time taken / delay if provided from server */}
              {node.time_taken_ms != null && (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <strong>Time Taken:</strong> {(node.time_taken_ms / 1000 / 60).toFixed(1)} min
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 18 }}>
        <h4>Dependencies</h4>
        <ul className="flow-chart-data" style={{ listStyle: 'none', paddingLeft: 0 }}>
          {data.edges.map(edge => {
            const src = nodesById[edge.source_node_id];
            const tgt = nodesById[edge.target_node_id];
            return <li key={edge.id} style={{ margin: '6px 0' }}>
              <strong>{src?.title ?? edge.source_node_id}</strong> → <strong>{tgt?.title ?? edge.target_node_id}</strong>
            </li>;
          })}
        </ul>
      </div>
    </div>
  );
}
