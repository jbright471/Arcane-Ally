# First Run

Arcane Ally is distributed as a blank application. The public repository contains no campaign database, character sheets, maps, notes, encounter history, or host-specific configuration.

## Before Starting

1. Copy `server/.env.example` to `server/.env`.
2. Replace the sample `DM_PIN` with a private value.
3. Set `DB_PATH` to a persistent writable location when using containers.
4. Configure `OLLAMA_URL` and `OLLAMA_MODEL` only if you want local AI features.
5. Use HTTPS or `localhost` if players need browser microphone access.

## Start the App

Backend:

```bash
cd server
npm ci
npm start
```

Frontend:

```bash
cd client
npm ci --legacy-peer-deps
npm run dev
```

The backend creates an empty SQLite database and applies schema migrations automatically. Open `http://localhost:5173`, create or import the first character, then open **DM Dashboard** and enter your configured DM PIN.

The **Start Combat** control can begin an ad hoc encounter even when the encounter library is empty. Saved encounters remain available for prepared combat workflows.

## Confirm the Blank State

On a new installation:

- **Dashboard** shows no characters.
- **Party Notes**, **Session Archive**, **World Map**, and shared loot are empty.
- **DM Dashboard** requires the configured PIN.
- No database exists in Git; it is created only on the host at runtime.

## Keep It Private

Do not add runtime files to a public commit. The repository ignores databases and journals, `data/`, `backups/`, `uploads/`, environment files, PDFs, private keys, certificates, and common character-export filenames.

Before publishing a change, run:

```bash
git status --short --ignored
git ls-files | grep -E '(\.db|\.sqlite|\.pdf|\.pem|\.key)$'
```

The second command should print nothing. Review every staged file before pushing.

Continue with [Self-Hosting & Upgrades](./SELF_HOSTING.md) for persistent storage, reverse proxies, backups, and upgrades.
