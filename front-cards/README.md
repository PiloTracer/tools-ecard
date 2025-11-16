# front-cards

E-Cards public-facing web application built with Next.js 16.

## Features

- Template Designer
- Batch Import & Management
- Real-time card preview
- User authentication integration

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

All development variables now live in the repository root `.env.dev.example`. Copy that file to `.env` (or export the same values in your shell) before running local commands. When running the frontend outside of Docker, make sure the following values are present:

```bash
NEXT_PUBLIC_API_URL=http://localhost:7400
NEXT_PUBLIC_WS_URL=ws://localhost:7400
```

## Project Structure

```
/app                    # Next.js App Router pages
/features               # Feature modules
  /auth                 # Authentication
  /template-designer    # Template editor
  /batch-import         # Data import
  /batch-management     # Batch viewing
/shared                 # Shared components and utilities
  /components           # Reusable UI components
  /hooks                # Reusable React hooks
  /lib                  # Utility functions
```

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Zod (validation)

## License

MIT
