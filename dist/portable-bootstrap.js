import { createRequire } from 'module';
import { dirname, join } from 'path';
// Use the real exe location (not virtual import.meta.url path)
const exeDir = dirname(process.execPath);
createRequire(join(exeDir, 'package.json'));
// Set up NODE_PATH for module resolution relative to the binary
process.env.NODE_PATH = [
    process.env.NODE_PATH || '',
    join(exeDir, 'node_modules'),
    join(dirname(exeDir), 'node_modules'),
].filter(Boolean).join(';');
// Load the real GitNexus CLI (bundled in the binary)
await import('./cli/index.js');
