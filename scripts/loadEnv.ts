// Load .env / .env.local the same way `next dev` does, so scripts see the app's configuration.
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());
