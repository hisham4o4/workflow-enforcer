const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database'); // This now imports from your new pg-compatible database.js
const { authMiddleware, adminMiddleware } = require('./authMiddleware');
const enforcementEngine = require('./enforcementEngine');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize the database connection and tables
// We only need to do this if our database.js exports an init function
// db.initializeDb().catch(console.error);;

// --- Auth Routes ---
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
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const user = result.rows[0];
        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) {
            return res.status(401).json({ message: 'Invalid password' });
        }
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Server error during login." });
    }
});

app.get('/api/profile', authMiddleware, async (req, res) => {
    const sql = `SELECT id, username, role, score FROM users WHERE id = $1`;
    try {
        const result = await db.query(sql, [req.user.id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Could not fetch profile." });
    }
});

// --- User Management (for Admin) ---
app.get('/api/users', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const result = await db.query("SELECT id, username FROM users WHERE role = 0");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Could not fetch users." });
    }
});

// --- Workflow Routes ---
app.post('/api/workflows', [authMiddleware, adminMiddleware], async (req, res) => {
    const { name, description } = req.body;
    const sql = `INSERT INTO workflows (name, description) VALUES ($1, $2) RETURNING *`;
    try {
        const result = await db.query(sql, [name, description]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Could not create workflow." });
    }
});

app.get('/api/workflows', [authMiddleware, adminMiddleware], async (req, res) => {
    const sql = "SELECT * FROM workflows";
    try {
        const result = await db.query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Could not fetch workflows." });
    }
});

app.get('/api/workflows/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    const workflowId = req.params.id;
    const nodesSql = `
        SELECT n.id, n.title, n.status, n.due_date, u.username as assignee
        FROM nodes n
        LEFT JOIN users u ON n.assignee_id = u.id
        WHERE n.workflow_id = $1`;
    try {
        const nodesResult = await db.query(nodesSql, [workflowId]);
        res.json({ nodes: nodesResult.rows, edges: [] }); // Edges can be added later if needed
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Could not fetch workflow details." });
    }
});

app.delete('/api/workflows/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    const workflowId = req.params.id;
    // Because you used ON DELETE CASCADE in your schema, we only need to delete the workflow.
    // The database will automatically delete all related nodes, edges, and fines.
    const sql = 'DELETE FROM workflows WHERE id = $1';
    try {
        await db.query(sql, [workflowId]);
        res.json({ message: 'Workflow deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Failed to delete workflow." });
    }
});

// --- Node (Task) Routes ---
app.post('/api/workflows/:workflowId/nodes', [authMiddleware, adminMiddleware], async (req, res) => {
    const { title, description, assignee_id, due_date } = req.body;
    const { workflowId } = req.params;
    const sql = `INSERT INTO nodes (workflow_id, title, description, assignee_id, due_date, status) VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`;
    try {
        const result = await db.query(sql, [workflowId, title, description, assignee_id, due_date]);
        res.status(201).json({ "id": result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Could not create task node." });
    }
});

// --- User's Task Routes ---
app.get('/api/mytasks', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const sql = `
        SELECT
            n.id, n.title, n.description, n.due_date, n.status,
            (SELECT COUNT(*) FROM edges e WHERE e.target_node_id = n.id AND (SELECT status FROM nodes WHERE id = e.source_node_id) != 'completed') as blocked_by_count
        FROM nodes n
        WHERE n.assignee_id = $1 AND n.status NOT IN ('completed')
        ORDER BY n.due_date ASC`;
    try {
        const result = await db.query(sql, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Could not fetch tasks." });
    }
});

app.post('/api/tasks/:id/complete', authMiddleware, async (req, res) => {
    const nodeId = req.params.id;
    const userId = req.user.id;
    
    try {
        // Check if the task is assigned to this user
        const nodeResult = await db.query('SELECT assignee_id FROM nodes WHERE id = $1', [nodeId]);
        if (nodeResult.rows.length === 0) {
            return res.status(404).json({ message: "Node not found" });
        }
        if (nodeResult.rows[0].assignee_id !== userId) {
            return res.status(403).json({ message: "You are not assigned to this task" });
        }

        // Check for blocking tasks
        const blockedSql = `SELECT COUNT(*) as count FROM edges e JOIN nodes n ON e.source_node_id = n.id WHERE e.target_node_id = $1 AND n.status != 'completed'`;
        const blockedResult = await db.query(blockedSql, [nodeId]);
        if (blockedResult.rows[0].count > 0) {
            return res.status(400).json({ message: 'Cannot complete task, it is blocked by dependencies.' });
        }

        // Update the task status
        await db.query(`UPDATE nodes SET status = 'completed' WHERE id = $1`, [nodeId]);
        res.json({ message: 'Task marked as complete' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Could not complete task." });
    }
});


// --- Fine Management ---
app.get('/api/fines', [authMiddleware, adminMiddleware], async (req, res) => {
    const sql = `
        SELECT f.id, f.reason, f.amount, f.created_at, f.resolved, u.username, n.title as node_title
        FROM fines f JOIN users u ON f.user_id = u.id JOIN nodes n ON f.node_id = n.id
        ORDER BY f.created_at DESC`;
    try {
        const result = await db.query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Could not fetch fines." });
    }
});

app.post('/api/fines/:id/resolve', [authMiddleware, adminMiddleware], async (req, res) => {
    const sql = `UPDATE fines SET resolved = true WHERE id = $1`;
    try {
        await db.query(sql, [req.params.id]);
        res.json({ message: 'Fine resolved successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ "error": "Could not resolve fine." });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    enforcementEngine.startEngine();
});