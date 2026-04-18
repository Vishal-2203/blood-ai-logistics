# blood-ai-logistics

## Verification Pipeline

Run the full project verification pipeline from the repo root:

```bash
npm run verify
```

That command runs:

- AI module tests
- frontend React tests
- frontend production build
- backend integration tests

## Live AI Verification

To verify the real Gemini path instead of the deterministic fallback, set `GEMINI_API_KEY` and run:

```bash
npm run verify:live-ai
```

## Secure Auth

The app now uses token-based authentication with persistent SQLite-backed users.

Seeded demo accounts:

- `hospital@bloodagent.demo / hospital123`
- `donor@bloodagent.demo / donor123`
- `requestor@bloodagent.demo / requestor123`

You can also register new accounts directly from the login screen.

## Persistence

Runtime data is stored in a SQLite database under `data/blood-agent.sqlite` by default.

Set `DATA_DIR` to change the database directory:

```bash
DATA_DIR=./custom-data npm run dev
```

## Deployment

The repo now includes:

- `Dockerfile` for containerized deployment
- `.github/workflows/ci.yml` for automated verification on pushes and pull requests
- `.github/workflows/release.yml` to publish a container image to GitHub Container Registry

To build and run locally with Docker:

```bash
docker build -t blood-agent .
docker run -p 4000:4000 -e GEMINI_API_KEY=your_key_here blood-agent
```
