# Clarity Budget

A shared, self-hosted budget planner with PostgreSQL persistence. Income, expenses, savings goal, and category totals are stored in one database, so every device sees the same budget.

## Run it

1. Install Node.js 20+ and PostgreSQL.
2. Create a database, then set the connection string:

   ```sh
   cp .env.example .env
   # edit .env with your DATABASE_URL
   ```

3. Install and launch:

   ```sh
   npm install
   npm run dev
   ```

   Visit `http://localhost:5173`. The frontend proxies API calls to the server at port 3001 while developing.

## Deploy

Set `DATABASE_URL` and `PORT` in your host's environment, then run:

```sh
npm install
npm run build
npm start
```

The Node server automatically serves the compiled `dist/` frontend and the API from one origin, so a reverse proxy only needs to forward traffic to `PORT`. The server creates its `transactions` and `settings` tables on first launch.

## API

- `GET /api/transactions`
- `POST /api/transactions`
- `PUT /api/transactions/:id`
- `DELETE /api/transactions/:id`
- `GET /api/settings`
- `PUT /api/settings/savings-goal`

All monetary amounts are validated by the API and persisted as PostgreSQL `NUMERIC(12,2)` values.
