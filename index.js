import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, initializeDatabase } from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

const allowedTypes = new Set(['income', 'expense']);
function validateTransaction(body) {
  const { name, amount, type, category, occurredOn } = body;
  if (!name?.trim() || !category?.trim() || !allowedTypes.has(type) || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return 'Name, a positive amount, type, and category are required.';
  }
  if (occurredOn && !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) return 'Date must use YYYY-MM-DD.';
  return null;
}
function row(transaction) {
  return { ...transaction, amount: Number(transaction.amount) };
}

app.get('/api/transactions', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, name, amount, type, category, occurred_on AS "occurredOn" FROM transactions ORDER BY occurred_on DESC, id DESC');
    res.json(rows.map(row));
  } catch (error) { next(error); }
});

app.post('/api/transactions', async (req, res, next) => {
  const error = validateTransaction(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { name, amount, type, category, occurredOn } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO transactions (name, amount, type, category, occurred_on) VALUES ($1,$2,$3,$4,COALESCE($5, CURRENT_DATE)) RETURNING id, name, amount, type, category, occurred_on AS "occurredOn"',
      [name.trim(), Number(amount), type, category.trim(), occurredOn || null]
    );
    res.status(201).json(row(rows[0]));
  } catch (error) { next(error); }
});

app.put('/api/transactions/:id', async (req, res, next) => {
  const error = validateTransaction(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { name, amount, type, category, occurredOn } = req.body;
    const { rows } = await pool.query(
      'UPDATE transactions SET name=$1, amount=$2, type=$3, category=$4, occurred_on=COALESCE($5, occurred_on) WHERE id=$6 RETURNING id, name, amount, type, category, occurred_on AS "occurredOn"',
      [name.trim(), Number(amount), type, category.trim(), occurredOn || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Transaction not found.' });
    res.json(row(rows[0]));
  } catch (error) { next(error); }
});

app.delete('/api/transactions/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Transaction not found.' });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get('/api/settings', async (_req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key = 'savings_goal'");
    res.json({ savingsGoal: rows[0] ? Number(rows[0].value) : 0 });
  } catch (error) { next(error); }
});

app.put('/api/settings/savings-goal', async (req, res, next) => {
  const goal = Number(req.body.savingsGoal);
  if (!Number.isFinite(goal) || goal < 0) return res.status(400).json({ error: 'Savings goal must be zero or greater.' });
  try {
    await pool.query("INSERT INTO settings (key, value) VALUES ('savings_goal', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [String(goal)]);
    res.json({ savingsGoal: goal });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Something went wrong connecting to the budget database.' });
});

// In production the same Node process can serve the compiled React app and API.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientDist = path.join(projectRoot, 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));

const port = process.env.PORT || 3001;
initializeDatabase().then(() => app.listen(port, () => console.log(`Budget API listening on ${port}`))).catch((error) => {
  console.error('Could not initialize database:', error.message);
  process.exit(1);
});
