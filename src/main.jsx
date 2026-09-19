import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const categories = ['Housing', 'Food & dining', 'Transport', 'Shopping', 'Health', 'Fun', 'Bills', 'Other'];
const palette = ['#6d5dfc', '#f59e61', '#3dbca5', '#ed7192', '#5aa5eb', '#d5a947', '#9c7dd9', '#8291a6'];
const blank = { name: '', amount: '', type: 'expense', category: 'Food & dining', occurredOn: new Date().toISOString().slice(0, 10) };
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Request failed.');
  return response.status === 204 ? null : response.json();
}

function Donut({ items, total }) {
  let current = 0;
  const gradient = items.length ? items.map((item, i) => {
    const from = (current / total) * 360; current += item.amount;
    return `${palette[i % palette.length]} ${from}deg ${(current / total) * 360}deg`;
  }).join(', ') : '#e9edf5 0deg 360deg';
  return <div className="donut" style={{ background: `conic-gradient(${gradient})` }}><div><b>{money.format(total)}</b><span>spent</span></div></div>;
}

function TransactionForm({ value, onChange, onSubmit, onCancel, saving }) {
  return <form className="transaction-form" onSubmit={onSubmit}>
    <div className="form-heading"><h2>{value.id ? 'Edit entry' : 'Add an entry'}</h2>{onCancel && <button type="button" className="text-button" onClick={onCancel}>Cancel</button>}</div>
    <label>Description<input required placeholder="e.g. Weekly groceries" value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} /></label>
    <div className="form-grid"><label>Amount<input required type="number" min="0.01" step="0.01" placeholder="0.00" value={value.amount} onChange={e => onChange({ ...value, amount: e.target.value })} /></label><label>Date<input required type="date" value={value.occurredOn} onChange={e => onChange({ ...value, occurredOn: e.target.value })} /></label></div>
    <div className="segmented"><button type="button" className={value.type === 'expense' ? 'selected expense' : ''} onClick={() => onChange({ ...value, type: 'expense' })}>Expense</button><button type="button" className={value.type === 'income' ? 'selected income' : ''} onClick={() => onChange({ ...value, type: 'income' })}>Income</button></div>
    <label>Category<select value={value.category} onChange={e => onChange({ ...value, category: e.target.value })}>{(value.type === 'income' ? ['Paycheck', 'Freelance', 'Investment', 'Other income'] : categories).map(x => <option key={x}>{x}</option>)}</select></label>
    <button className="primary wide" disabled={saving}>{saving ? 'Saving…' : value.id ? 'Save changes' : 'Add transaction'}</button>
  </form>;
}

function App() {
  const [transactions, setTransactions] = useState([]); const [goal, setGoal] = useState(0); const [form, setForm] = useState(blank); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [editingGoal, setEditingGoal] = useState(false); const [goalDraft, setGoalDraft] = useState(''); const [filter, setFilter] = useState('all');
  const load = async () => { try { const [items, settings] = await Promise.all([request('/api/transactions'), request('/api/settings')]); setTransactions(items); setGoal(settings.savingsGoal); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const summary = useMemo(() => { const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0); const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0); const map = new Map(); transactions.filter(t => t.type === 'expense').forEach(t => map.set(t.category, (map.get(t.category) || 0) + t.amount)); return { income, expenses, balance: income - expenses, categories: [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a,b) => b.amount - a.amount) }; }, [transactions]);
  const saveTransaction = async (e) => { e.preventDefault(); setSaving(true); setError(''); try { const payload = { ...form, amount: Number(form.amount) }; const updated = form.id ? await request(`/api/transactions/${form.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }) : await request('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); setTransactions(previous => form.id ? previous.map(x => x.id === updated.id ? updated : x) : [updated, ...previous]); setForm(blank); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const remove = async (id) => { if (!confirm('Delete this transaction?')) return; try { await request(`/api/transactions/${id}`, { method: 'DELETE' }); setTransactions(list => list.filter(x => x.id !== id)); if (form.id === id) setForm(blank); } catch (err) { setError(err.message); } };
  const saveGoal = async () => { try { const value = Math.max(0, Number(goalDraft) || 0); const settings = await request('/api/settings/savings-goal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ savingsGoal: value }) }); setGoal(settings.savingsGoal); setEditingGoal(false); } catch (err) { setError(err.message); } };
  const goalProgress = goal ? Math.min(100, Math.max(0, summary.balance / goal * 100)) : 0;
  const visibleTransactions = filter === 'all' ? transactions : transactions.filter(t => t.type === filter);
  return <main><header><div className="brand"><span className="brand-mark">⌂</span><span>Harbor</span></div><p><button className="month-arrow" aria-label="Previous month">‹</button> September 2026 <button className="month-arrow" aria-label="Next month">›</button></p><button className="primary add-button" onClick={() => { setForm(blank); document.querySelector('.transaction-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>＋ Add</button></header>
    <section className="hero"><div><p className="eyebrow">REMAINING THIS MONTH</p><h1>{money.format(summary.balance)}</h1><p className="subtle">After {money.format(summary.expenses)} in spending</p></div></section>
    {error && <div className="alert">{error}<button onClick={() => setError('')}>×</button></div>}
    <section className="stats"><article><span className="stat-icon income-bg">↗</span><div><p>Total income</p><strong>{money.format(summary.income)}</strong></div></article><article><span className="stat-icon expense-bg">↘</span><div><p>Total expenses</p><strong>{money.format(summary.expenses)}</strong></div></article><article><span className="stat-icon balance-bg">◌</span><div><p>Transactions</p><strong>{transactions.length}</strong></div></article></section>
    <section className="workspace"><div className="left-column"><article className="goal-card"><div className="goal-top"><div><h2>Emergency fund</h2><p className="goal-caption">Remaining balance counts toward this goal.</p></div><button className="outline-button" onClick={() => { setGoalDraft(String(goal || '')); setEditingGoal(!editingGoal); }}>✎ Edit</button></div>{editingGoal ? <div className="goal-edit"><input type="number" min="0" placeholder="Goal amount" value={goalDraft} onChange={e => setGoalDraft(e.target.value)} /><button className="primary" onClick={saveGoal}>Save goal</button></div> : <><div className="goal-amount">{money.format(Math.max(0, summary.balance))}</div><div className="goal-footer"><span>of {money.format(goal)}</span><span>{Math.round(goalProgress)}%</span></div><div className="progress"><i style={{ width: `${goalProgress}%` }} /></div><p className="goal-note">{goal ? `${money.format(Math.max(0, goal - summary.balance))} to go.` : 'Choose a savings target to track your progress.'}</p></>}</article><article className="panel spending"><div className="panel-title"><div><h2>Spending by category</h2><p>Where this month’s expenses went.</p></div></div><div className="spending-content"><Donut items={summary.categories} total={summary.expenses} /><div className="legend">{summary.categories.length ? summary.categories.map((item, i) => <div key={item.category}><span style={{ background: palette[i % palette.length] }}></span><label>{item.category}</label><b>{money.format(item.amount)}</b><em>{Math.round(item.amount / summary.expenses * 100)}%</em></div>) : <p className="empty">Add an expense to see your breakdown.</p>}</div></div></article>
      <article className="panel transactions"><div className="panel-title"><div><h2>Transactions</h2><p>Tap a row to edit. Delete from the trash control.</p></div><div className="filters"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button><button className={filter === 'expense' ? 'active' : ''} onClick={() => setFilter('expense')}>Expenses</button><button className={filter === 'income' ? 'active' : ''} onClick={() => setFilter('income')}>Income</button></div></div>{loading ? <p className="empty">Loading your shared budget…</p> : visibleTransactions.length === 0 ? <p className="empty">Your budget is ready for its first entry.</p> : <div className="transaction-list">{visibleTransactions.map(t => <div className="transaction" key={t.id} onClick={() => setForm({ ...t, amount: String(t.amount) })}><span className={`transaction-icon ${t.type}`}>{t.type === 'income' ? '↙' : '↗'}</span><div className="transaction-name"><b>{t.name}</b><span>{t.category} · {new Date(`${t.occurredOn}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div><strong className={t.type}>{t.type === 'income' ? '+' : '−'}{money.format(t.amount)}</strong><button className="icon-button delete" title="Delete" onClick={e => { e.stopPropagation(); remove(t.id); }}>♧</button></div>)}</div>}</article></div>
      <aside><TransactionForm value={form} onChange={setForm} onSubmit={saveTransaction} onCancel={form.id ? () => setForm(blank) : null} saving={saving} /></aside>
    </section></main>;
}

createRoot(document.getElementById('root')).render(<App />);
