const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./workflow.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the workflow database.');
});

// Create tables if they don't exist
db.serialize(() => {
    // Users table: role 0 = User, role 1 = Admin
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role INTEGER DEFAULT 0,
        score REAL DEFAULT 100
    )`);

    // Workflows table
    db.run(`CREATE TABLE IF NOT EXISTS workflows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT
    )`);

    // Nodes (tasks) table
    db.run(`CREATE TABLE IF NOT EXISTS nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id INTEGER,
        title TEXT,
        description TEXT,
        assignee_id INTEGER,
        due_date TEXT,
        status TEXT DEFAULT 'pending', -- pending, in_progress, completed, overdue
        FOREIGN KEY (workflow_id) REFERENCES workflows(id),
        FOREIGN KEY (assignee_id) REFERENCES users(id)
    )`);

    // Edges (dependencies) table
    db.run(`CREATE TABLE IF NOT EXISTS edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_node_id INTEGER,
        target_node_id INTEGER,
        FOREIGN KEY (source_node_id) REFERENCES nodes(id),
        FOREIGN KEY (target_node_id) REFERENCES nodes(id)
    )`);

    // Fines table
    db.run(`CREATE TABLE IF NOT EXISTS fines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        node_id INTEGER,
        amount REAL DEFAULT 10,
        reason TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        resolved BOOLEAN DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (node_id) REFERENCES nodes(id)
    )`);
});

module.exports = db;