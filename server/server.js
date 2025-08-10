const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const { authMiddleware, adminMiddleware: oldAdminMiddleware } = require('./authMiddleware'); // Keep old one for reference
const enforcementEngine = require('./enforcementEngine');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- NEW Role-Based Middleware ---
const ROLES = { DESIGNER: 0, SUPERVISOR: 1, MANAGER: 2, ADMIN: 3 };

const supervisorOrHigher = (req, res, next) => {
    if (req.user.role < ROLES.SUPERVISOR) {
        return res.status(403).json({ message: 'Supervisor access or higher required' });
    }
    next();
};

const managerOrHigher = (req, res, next) => {
    if (req.user.role < ROLES.MANAGER) {
        return res.status(403).json({ message: 'Manager access or higher required' });
    }
    next();
};

const adminOnly = (req, res, next) => {
    if (req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};


// --- Auth Routes (No Changes) ---
app.post('/api/register', async (req, res) => {
    const { username, password, role = 0 } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
    const sql = `INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id`;
    try {
        const result = await db.query(sql, [username, hashedPassword, role]);
        res.status(201).json({ "id": result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Could not register user. Username may already be taken." });
    }
});

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
// Get users that the current user is allowed to assign tasks to
app.get('/api/assignable-users', authMiddleware, async (req, res) => {
    const requesterRole = req.user.role;
    // Users can assign tasks to people of their role or lower, but not to Admins.
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
// NEW: Universal task creation
app.post('/api/tasks', authMiddleware, async (req, res) => {
    const { title, description, assignee_id, supervisor_id, due_date, is_urgent } = req.body;
    const creator_id = req.user.id;
    
    // Authorization: Check if assignee has a higher role
    const assigneeResult = await db.query('SELECT role FROM users WHERE id = $1', [assignee_id]);
    const assigneeRole = assigneeResult.rows[0]?.role;
    if (assigneeRole > req.user.role || assigneeRole === ROLES.ADMIN) {
        return res.status(403).json({ message: "You cannot assign tasks to users with a higher role or to Admins." });
    }
    
    const sql = `
        INSERT INTO nodes (title, description, creator_id, assignee_id, supervisor_id, due_date, is_urgent, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING *`;
    try {
        const result = await db.query(sql, [title, description, creator_id, assignee_id, supervisor_id || null, due_date, is_urgent || false]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create task." });
    }
});

// UPDATED: Get user's tasks with new sorting and fields
app.get('/api/mytasks', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    // Get tasks where user is assignee OR supervisor
    const sql = `
        SELECT
            n.id, n.title, n.status, n.due_date, n.is_urgent, n.seen_at,
            creator.username as creator_name,
            assignee.username as assignee_name,
            supervisor.username as supervisor_name,
            (n.assignee_id = $1) as is_assignee -- Flag to know if viewer is the main assignee
        FROM nodes n
        LEFT JOIN users creator ON n.creator_id = creator.id
        LEFT JOIN users assignee ON n.assignee_id = assignee.id
        LEFT JOIN users supervisor ON n.supervisor_id = supervisor.id
        WHERE (n.assignee_id = $1 OR n.supervisor_id = $1) AND n.status NOT IN ('completed')
        ORDER BY
            n.is_urgent DESC, -- Urgent tasks first
            n.due_date ASC;    -- Then closest due date
    `;
    try {
        const result = await db.query(sql, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Could not fetch tasks." });
    }
});

// NEW: Endpoint to mark a task as "seen"
app.post('/api/tasks/:id/seen', authMiddleware, async (req, res) => {
    const nodeId = req.params.id;
    const userId = req.user.id;
    const sql = `
        UPDATE nodes SET seen_at = NOW()
        WHERE id = $1 AND assignee_id = $2 AND seen_at IS NULL`;
    try {
        await db.query(sql, [nodeId, userId]);
        res.status(200).json({ message: 'Task marked as seen.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not update task.' });
    }
});

app.post('/api/tasks/:id/complete', authMiddleware, async (req, res) => {
    // This logic remains largely the same, but you might want to add supervisor checks later
    const nodeId = req.params.id;
    const userId = req.user.id;
    try {
        const nodeResult = await db.query('SELECT assignee_id FROM nodes WHERE id = $1', [nodeId]);
        if (nodeResult.rows.length === 0) return res.status(404).json({ message: "Node not found" });
        if (nodeResult.rows[0].assignee_id !== userId) return res.status(403).json({ message: "You are not the assignee for this task" });
        await db.query(`UPDATE nodes SET status = 'completed' WHERE id = $1`, [nodeId]);
        res.json({ message: 'Task marked as complete' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Could not complete task." });
    }
});


// --- Workflow & Admin Hub Routes (Admin Only) ---
// Admin creates a workflow
app.post('/api/workflows', [authMiddleware, adminOnly], async (req, res) => { /* ... existing code ... */ });
// Admin gets all workflows
app.get('/api/workflows', [authMiddleware, adminOnly], async (req, res) => { /* ... existing code ... */ });
// Admin deletes a workflow
app.delete('/api/workflows/:id', [authMiddleware, adminOnly], async (req, res) => { /* ... existing code ... */ });

// Admin adds a node to a predefined workflow
app.post('/api/workflows/:workflowId/nodes', [authMiddleware, adminOnly], async (req, res) => {
    // This is now for admins building chains, not for universal assignment
    const { title, description, assignee_id, due_date } = req.body;
    const creator_id = req.user.id;
    const { workflowId } = req.params;
    const sql = `INSERT INTO nodes (workflow_id, title, description, creator_id, assignee_id, due_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`;
    try {
        const result = await db.query(sql, [workflowId, title, description, creator_id, assignee_id, due_date]);
        res.status(201).json({ "id": result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not create workflow node." });
    }
});


// NEW: Admin Flow Chart Hub endpoint
app.get('/api/admin/workflow-stats/:id', [authMiddleware, adminOnly], async (req, res) => {
    const { id } = req.params;
    try {
        const workflowSql = `SELECT * FROM workflows WHERE id = $1`;
        const nodesSql = `
            SELECT 
                n.*, 
                creator.username as creator_name,
                assignee.username as assignee_name,
                supervisor.username as supervisor_name
            FROM nodes n
            LEFT JOIN users creator ON n.creator_id = creator.id
            LEFT JOIN users assignee ON n.assignee_id = assignee.id
            LEFT JOIN users supervisor ON n.supervisor_id = supervisor.id
            WHERE n.workflow_id = $1`;
        const edgesSql = `
            SELECT e.* FROM edges e
            JOIN nodes n ON e.source_node_id = n.id
            WHERE n.workflow_id = $1`;
        
        const [workflowResult, nodesResult, edgesResult] = await Promise.all([
            db.query(workflowSql, [id]),
            db.query(nodesSql, [id]),
            db.query(edgesSql, [id])
        ]);

        if (workflowResult.rows.length === 0) {
            return res.status(404).json({ message: "Workflow not found." });
        }
        
        // Basic stats calculation
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
    enforcementEngine.startEngine(); // You can re-enable this when ready
});