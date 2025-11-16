# render-worker

Background job processor for E-Cards rendering.

## Purpose

Processes card rendering jobs from Redis queue (BullMQ):
- Fetches template and staff data
- Renders cards with node-canvas or Puppeteer
- Applies InDesign-equivalent layout logic
- Generates QR codes
- Exports to PNG/JPG
- Uploads results to SeaweedFS

## Development

```bash
# Install dependencies
npm install

# Run worker
npm run worker

# Development mode (watch)
npm run dev

# Build for production
npm run build
```

## Environment Variables

Use the root-level `.env.dev.example` as the canonical source for worker settings (database, Redis, SeaweedFS, concurrency, etc.). Copy it to `.env` and the Docker workflow will inject everything automatically.

## Job Processing

The worker listens to the `card-rendering` queue and processes jobs with:
- Concurrency: 4 (configurable)
- Max attempts: 3
- Timeout: 60 seconds
- Rate limit: 10 jobs/second

## Tech Stack

- Node.js 20+
- BullMQ (job queue)
- node-canvas (rendering)
- sharp (image processing)
- qrcode (QR generation)

## License

MIT
