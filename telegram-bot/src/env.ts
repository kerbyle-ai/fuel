import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// Project root `.env` (fuel-map/.env), then local overrides in telegram-bot/.env
config({ path: resolve(here, '../../.env') });
config({ path: resolve(here, '../.env') });
