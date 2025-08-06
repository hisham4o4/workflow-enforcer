const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const { authMiddleware, adminMiddleware } = require('./authMiddleware');
const enforcementEngine = require('./enforcementEngine');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Auth Routes ---
app.post('/api/register', (req, res) => {
    const { username, password, role = 0 } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
    const sql = `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`;
    db.run(sql, [username, hashedPassword, role], function (err) {
        if (err) return res.status(400).json({ "error": err.message });
        res.status(201).json({ "id": this.lastID });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const sql = `SELECT * FROM users WHERE username = ?`;
    db.get(sql, [username], (err, user) => {
        if (err || !user) return res.status(404).json({ message: 'User not found' });
        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) return res.status(401).json({ message: 'Invalid password' });
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    });
});

app.get('/api/profile', authMiddleware, (req, res) => {
    const sql = `SELECT id, username, role, score FROM users WHERE id = ?`;
    db.get(sql, [req.user.id], (err, row) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json(row);
    });
});

// --- User Management (for Admin) ---
app.get('/api/users', [authMiddleware, adminMiddleware], (req, res) => {
    db.all("SELECT id, username FROM users WHERE role = 0", [], (err, rows) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json(rows);
    });
});

// --- Workflow Routes (NEW + MODIFIED) ---
app.post('/api/workflows', [authMiddleware, adminMiddleware], (req, res) => {
    const { name, description } = req.body;
    const sql = `INSERT INTO workflows (name, description) VALUES (?, ?)`;
    db.run(sql, [name, description], function (err) {
        if (err) return res.status(400).json({ "error": err.message });
        res.status(201).json({ id: this.lastID, name, description });
    });
});

// NEW: Get all workflows
app.get('/api/workflows', [authMiddleware, adminMiddleware], (req, res) => {
    const sql = "SELECT * FROM workflows";
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json(rows);
    });
});

// Get full workflow details for Admin
app.get('/api/workflows/:id', [authMiddleware, adminMiddleware], (req, res) => {
    const workflowId = req.params.id;
    const response = { nodes: [], edges: [] };
    const nodesSql = `
        SELECT n.id, n.title, n.status, n.due_date, u.username as assignee
        FROM nodes n
        LEFT JOIN users u ON n.assignee_id = u.id
        WHERE n.workflow_id = ?`;
    db.all(nodesSql, [workflowId], (err, nodes) => {
        if (err) return res.status(500).json({ error: err.message });
        response.nodes = nodes;
        // Edge fetching can be added back if visualization is needed
        res.json(response);
    });
});

// NEW: Delete a workflow and all its contents
app.delete('/api/workflows/:id', [authMiddleware, adminMiddleware], (req, res) => {
    const workflowId = req.params.id;
    // Use a transaction to ensure all or nothing is deleted
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        // Note: In a real app with complex dependencies, this should be more robust.
        // For this MVP, we delete fines and nodes associated with the workflow.
        const nodesToDeleteSql = 'SELECT id FROM nodes WHERE workflow_id = ?';
        db.all(nodesToDeleteSql, [workflowId], (err, nodes) => {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: "Failed to fetch nodes for deletion." });
            }
            if (nodes.length > 0) {
                const nodeIds = nodes.map(n => n.id);
                db.run(`DELETE FROM fines WHERE node_id IN (${nodeIds.join(',')})`);
                db.run(`DELETE FROM edges WHERE source_node_id IN (${nodeIds.join(',')}) OR target_node_id IN (${nodeIds.join(',')})`);
            }
            db.run('DELETE FROM nodes WHERE workflow_id = ?', [workflowId]);
            db.run('DELETE FROM workflows WHERE id = ?', [workflowId], (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: "Failed to delete workflow." });
                }
                db.run("COMMIT");
                res.json({ message: 'Workflow deleted successfully' });
            });
        });
    });
});

// --- Node (Task) Routes ---
app.post('/api/workflows/:workflowId/nodes', [authMiddleware, adminMiddleware], (req, res) => {
    const { title, description, assignee_id, due_date } = req.body;
    const { workflowId } = req.params;
    const sql = `INSERT INTO nodes (workflow_id, title, description, assignee_id, due_date, status) VALUES (?, ?, ?, ?, ?, 'pending')`;
    db.run(sql, [workflowId, title, description, assignee_id, due_date], function(err) {
        if (err) return res.status(400).json({ "error": err.message });
        res.status(201).json({ "id": this.lastID });
    });
});

// --- User's Task Routes ---
app.get('/api/mytasks', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const sql = `
        SELECT
            n.id, n.title, n.description, n.due_date, n.status,
            (SELECT COUNT(*) FROM edges e WHERE e.target_node_id = n.id AND (SELECT status FROM nodes WHERE id = e.source_node_id) != 'completed') as blocked_by_count
        FROM nodes n
        WHERE n.assignee_id = ? AND n.status NOT IN ('completed')
        ORDER BY n.due_date ASC
    `;
    db.all(sql, [userId], (err, rows) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json(rows);
    });
});

app.post('/api/tasks/:id/complete', authMiddleware, (req, res) => {
    const nodeId = req.params.id;
    const userId = req.user.id;
    const checkSql = `SELECT assignee_id FROM nodes WHERE id = ?`;
    db.get(checkSql, [nodeId], (err, node) => {
        if (err || !node) return res.status(404).json({ message: "Node not found" });
        if (node.assignee_id !== userId) return res.status(403).json({ message: "You are not assigned to this task" });
        const blockedSql = `SELECT COUNT(*) as count FROM edges e JOIN nodes n ON e.source_node_id = n.id WHERE e.target_node_id = ? AND n.status != 'completed'`;
        db.get(blockedSql, [nodeId], (err, row) => {
            if (row.count > 0) return res.status(400).json({ message: 'Cannot complete task, it is blocked by dependencies.' });
            const updateSql = `UPDATE nodes SET status = 'completed' WHERE id = ?`;
            db.run(updateSql, [nodeId], function (err) {
                if (err) return res.status(400).json({ "error": err.message });
                res.json({ message: 'Task marked as complete' });
            });
        });
    });
});

// --- Fine Management (no changes needed for this update) ---
app.get('/api/fines', [authMiddleware, adminMiddleware], (req, res) => {
    const sql = `
        SELECT f.id, f.reason, f.amount, f.created_at, f.resolved, u.username, n.title as node_title
        FROM fines f JOIN users u ON f.user_id = u.id JOIN nodes n ON f.node_id = n.id
        ORDER BY f.created_at DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json(rows);
    });
});

app.post('/api/fines/:id/resolve', [authMiddleware, adminMiddleware], (req, res) => {
    const sql = `UPDATE fines SET resolved = 1 WHERE id = ?`;
    db.run(sql, [req.params.id], function(err) {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ message: 'Fine resolved successfully' });
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    enforcementEngine.startEngine();
});