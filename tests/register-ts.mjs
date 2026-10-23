// Loads the extensionless TypeScript under lib/ for node:test. Registered via --import.
import { register } from 'node:module';

register(new URL('./ts-hooks.mjs', import.meta.url));
