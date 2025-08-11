const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const { authMiddleware } = require('./authMiddleware');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Role Definitions & Middleware ---
const ROLES = { DESIGNER: 0, SUPERVISOR: 1, MANAGER: 2, ADMIN: 3 };

const adminOnly = (req, res, next) => {
    if (req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// --- Auth Routes ---
// POST /api/register
app.post('/api/register', async (req, res) => {
    const { username, password, role = 0 } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
    const sql = `INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id`;
    try {
        const result = await db.query(sql, [username, hashedPassword, role]);
        res.status(201).json({ "id": result.rows[0].id });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ message: 'Username already exists. Please try another or log in.' });
        }
        console.error(err);
        res.status(500).json({ "error": "Could not register user due to a server error." });
    }
});
// POST /api/login - No changes from your provided file.
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const sql = `SELECT * FROM users WHERE username = $1`;
    try {
        const result = await db.query(sql, [username]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        const user = result.rows[0];
        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) return res.status(401).json({ message: 'Invalid password' });
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Server error during login." });
    }
});


// --- User Management ---
// GET /api/assignable-users - No changes.
app.get('/api/assignable-users', authMiddleware, async (req, res) => {
    const requesterRole = req.user.role;
    const sql = `SELECT id, username, role FROM users WHERE role <= $1 AND role < $2`;
    try {
        const result = await db.query(sql, [requesterRole, ROLES.ADMIN]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not fetch users." });
    }
});


// --- Task Management ---
// POST /api/tasks (Universal Creation) - No changes.
app.post('/api/tasks', authMiddleware, async (req, res) => {
    const { title, description, assignee_id, supervisor_id, due_date, is_urgent } = req.body;
    const creator_id = req.user.id;
    const assigneeResult = await db.query('SELECT role FROM users WHERE id = $1', [assignee_id]);
    const assigneeRole = assigneeResult.rows[0]?.role;
    if (assigneeRole > req.user.role || assigneeRole === ROLES.ADMIN) {
        return res.status(403).json({ message: "You cannot assign tasks to users with a higher role or to Admins." });
    }
    const sql = `INSERT INTO nodes (title, description, creator_id, assignee_id, supervisor_id, due_date, is_urgent, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`;
    try {
        const result = await db.query(sql, [title, description, creator_id, assignee_id, supervisor_id || null, due_date, is_urgent || false]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create task." });
    }
});
// GET /api/mytasks - Updated to include dependency information.
app.get('/api/mytasks', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const sql = `
        SELECT
            n.id, n.title, n.status, n.due_date, n.is_urgent, n.seen_at,
            creator.username as creator_name,
            assignee.username as assignee_name,
            supervisor.username as supervisor_name,
            (n.assignee_id = $1) as is_assignee,
            (SELECT COUNT(*) FROM edges e JOIN nodes dep ON e.source_node_id = dep.id WHERE e.target_node_id = n.id AND dep.status != 'completed') as blocked_by_count
        FROM nodes n
        LEFT JOIN users creator ON n.creator_id = creator.id
        LEFT JOIN users assignee ON n.assignee_id = assignee.id
        LEFT JOIN users supervisor ON n.supervisor_id = supervisor.id
        WHERE (n.assignee_id = $1 OR n.supervisor_id = $1) AND n.status NOT IN ('completed')
        ORDER BY
            n.is_urgent DESC,
            n.due_date ASC;
    `;
    try {
        const result = await db.query(sql, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Could not fetch tasks." });
    }
});

// POST /api/tasks/:id/seen - No changes.
app.post('/api/tasks/:id/seen', authMiddleware, async (req, res) => {
    const nodeId = req.params.id;
    const userId = req.user.id;
    const sql = `UPDATE nodes SET seen_at = NOW() WHERE id = $1 AND assignee_id = $2 AND seen_at IS NULL`;
    try {
        await db.query(sql, [nodeId, userId]);
        res.status(200).json({ message: 'Task marked as seen.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not update task.' });
    }
});

// POST /api/tasks/:id/complete - Updated to check dependencies.
app.post('/api/tasks/:id/complete', authMiddleware, async (req, res) => {
    const nodeId = req.params.id;
    const userId = req.user.id;
    try {
        const nodeResult = await db.query('SELECT assignee_id FROM nodes WHERE id = $1', [nodeId]);
        if (nodeResult.rows.length === 0) return res.status(404).json({ message: "Node not found" });
        if (nodeResult.rows[0].assignee_id !== userId) return res.status(403).json({ message: "You are not the assignee for this task" });

        // [NEW] Check for blocking tasks before allowing completion
        const blockedSql = `SELECT COUNT(*) as count FROM edges e JOIN nodes n ON e.source_node_id = n.id WHERE e.target_node_id = $1 AND n.status != 'completed'`;
        const blockedResult = await db.query(blockedSql, [nodeId]);
        if (blockedResult.rows[0].count > 0) {
            return res.status(400).json({ message: 'Task is blocked by an incomplete dependency.' });
        }

        await db.query(`UPDATE nodes SET status = 'completed' WHERE id = $1`, [nodeId]);
        res.json({ message: 'Task marked as complete' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Could not complete task." });
    }
});

// [NEW] PUT /api/tasks/:id (Edit Task)
app.put('/api/tasks/:id', [authMiddleware, adminOnly], async (req, res) => {
    const { id } = req.params;
    const { title, description, assignee_id, supervisor_id, due_date, is_urgent, status } = req.body;
    try {
        const oldNodeResult = await db.query('SELECT * FROM nodes WHERE id = $1', [id]);
        if (oldNodeResult.rows.length === 0) return res.status(404).json({ message: 'Task not found' });
        
        const oldNode = oldNodeResult.rows[0];
        let changeDescription = `Task edited by ${req.user.username}: `;
        const changes = [];
        if (title !== oldNode.title) changes.push(`title changed to "${title}"`);
        if (assignee_id !== oldNode.assignee_id) changes.push(`assignee changed`);
        // Add more change descriptions as needed...
        changeDescription += changes.join(', ');

        const updateSql = `UPDATE nodes SET title = $1, description = $2, assignee_id = $3, supervisor_id = $4, due_date = $5, is_urgent = $6, status = $7 WHERE id = $8 RETURNING *`;
        const updatedNodeResult = await db.query(updateSql, [title, description, assignee_id, supervisor_id, due_date, is_urgent, status, id]);
        
        // Log the edit
        if (changes.length > 0) {
            const logSql = `INSERT INTO task_logs (node_id, editor_id, change_description) VALUES ($1, $2, $3)`;
            await db.query(logSql, [id, req.user.id, changeDescription]);
        }
        
        res.json(updatedNodeResult.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update task.' });
    }
});

// [NEW] DELETE /api/tasks/:id (Delete Task)
app.delete('/api/tasks/:id', [authMiddleware, adminOnly], async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM nodes WHERE id = $1', [id]);
        res.status(200).json({ message: 'Task deleted successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete task.' });
    }
});

// [NEW] GET /api/tasks/:id/logs (View Edit Logs)
app.get('/api/tasks/:id/logs', [authMiddleware, adminOnly], async (req, res) => {
    const { id } = req.params;
    try {
        const logSql = `SELECT tl.*, u.username as editor_name FROM task_logs tl JOIN users u ON tl.editor_id = u.id WHERE tl.node_id = $1 ORDER BY tl.created_at DESC`;
        const result = await db.query(logSql, [id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch task logs.' });
    }
});


// --- Workflow & Admin Hub Routes ---
// [FIXED] DELETE /api/workflows/:id
app.delete('/api/workflows/:id', [authMiddleware, adminOnly], async (req, res) => {
    const { id } = req.params;
    // Your ON DELETE CASCADE in the database schema handles the cleanup of nodes, edges, etc.
    const sql = 'DELETE FROM workflows WHERE id = $1';
    try {
        const result = await db.query(sql, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Workflow not found' });
        }
        res.json({ message: 'Workflow and all its tasks have been deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Failed to delete workflow." });
    }
});

// [NEW] POST /api/edges (Create a dependency)
app.post('/api/edges', [authMiddleware, adminOnly], async (req, res) => {
    const { source_node_id, target_node_id } = req.body;
    if (source_node_id === target_node_id) {
        return res.status(400).json({ message: "A task cannot depend on itself." });
    }
    const sql = `INSERT INTO edges (source_node_id, target_node_id) VALUES ($1, $2) RETURNING *`;
    try {
        const result = await db.query(sql, [source_node_id, target_node_id]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create dependency.' });
    }
});

// [NEW] GET /api/admin/master-flow (For the Master Flow Chart)
app.get('/api/admin/master-flow', [authMiddleware, adminOnly], async (req, res) => {
    try {
        const nodesSql = `SELECT n.id, n.title, n.status, w.name as workflow_name FROM nodes n JOIN workflows w ON n.workflow_id = w.id`;
        const edgesSql = `SELECT * FROM edges`;
        const [nodesResult, edgesResult] = await Promise.all([
            db.query(nodesSql),
            db.query(edgesSql)
        ]);
        res.json({ nodes: nodesResult.rows, edges: edgesResult.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch master flow data.' });
    }
});

// Other admin routes (GET /workflows, POST /workflows/:id/nodes, etc.) remain as they were in your provided code.
// GET /api/admin/workflow-stats/:id endpoint remains the same.
app.get('/api/admin/workflow-stats/:id', [authMiddleware, adminOnly], async (req, res) => {
    const { id } = req.params;
    try {
        const workflowSql = `SELECT * FROM workflows WHERE id = $1`;
        const nodesSql = `SELECT n.*, creator.username as creator_name, assignee.username as assignee_name, supervisor.username as supervisor_name FROM nodes n LEFT JOIN users creator ON n.creator_id = creator.id LEFT JOIN users assignee ON n.assignee_id = assignee.id LEFT JOIN users supervisor ON n.supervisor_id = supervisor.id WHERE n.workflow_id = $1`;
        const edgesSql = `SELECT e.* FROM edges e JOIN nodes n ON e.source_node_id = n.id WHERE n.workflow_id = $1`;
        
        const [workflowResult, nodesResult, edgesResult] = await Promise.all([
            db.query(workflowSql, [id]),
            db.query(nodesSql, [id]),
            db.query(edgesSql, [id])
        ]);

        if (workflowResult.rows.length === 0) {
            return res.status(404).json({ message: "Workflow not found." });
        }
        
        const stats = {
            totalTasks: nodesResult.rows.length,
            completedTasks: nodesResult.rows.filter(n => n.status === 'completed').length,
            overdueTasks: nodesResult.rows.filter(n => n.status === 'overdue').length,
            urgentTasks: nodesResult.rows.filter(n => n.is_urgent).length,
        };

        res.json({
            workflow: workflowResult.rows[0],
            nodes: nodesResult.rows,
            edges: edgesResult.rows,
            stats: stats
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch workflow data.' });
    }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});