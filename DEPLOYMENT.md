# VisionTerra Deployment

## Recommended Setup

Use one hosted HTTPS web app for mobile GPS tracking and one Windows desktop app for monitoring.

- Mobile opens: `https://your-domain/mobile-tracking`
- Desktop app opens the same React app packaged with Electron.
- Both read and write through Supabase.

This avoids changing ngrok URLs. Keep ngrok only for temporary testing.

## Deploy The Web App

### Vercel

1. Push this `frontend` project to GitHub.
2. In Vercel, import the project.
3. Set the root directory to `frontend` if the repository root is one level above it.
4. Add these environment variables:

```text
REACT_APP_SUPABASE_URL
REACT_APP_SUPABASE_ANON_KEY
REACT_APP_GOOGLE_MAP_ID
REACT_APP_GOOGLE_MAPS_API_KEY
```

5. Deploy.
6. Open:

```text
https://your-vercel-domain/mobile-tracking
```

### Netlify

The included `netlify.toml` does the same SPA redirect setup.

## Supabase Realtime

Enable Realtime for:

```text
public.vehicle_positions
public.drone_positions
```

SQL option:

```sql
alter publication supabase_realtime add table public.vehicle_positions;
alter publication supabase_realtime add table public.drone_positions;
```

If Supabase says the table is already in the publication, it is fine.

## Windows Build

From `frontend`:

```bash
npm run dist:win
```

The installer is created in:

```text
frontend/release
```

## Daily Usage

1. Open VisionTerra on the Windows computer.
2. Open `Χάρτης Στόλου` to monitor vehicles.
3. On the phone, open the hosted HTTPS `/mobile-tracking` link.
4. Select the vehicle.
5. Tap `Έναρξη αποστολής θέσης`.
6. Allow GPS permission.

The phone writes GPS positions to Supabase. The map updates from Supabase Realtime.
