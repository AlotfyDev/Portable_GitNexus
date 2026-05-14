import fs from 'fs/promises';
import { getGlobalDir, getGlobalConfigPath } from './paths.js';
export const loadCLIConfig = async () => {
    try {
        const raw = await fs.readFile(getGlobalConfigPath(), 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
};
export const saveCLIConfig = async (config) => {
    const dir = getGlobalDir();
    await fs.mkdir(dir, { recursive: true });
    const configPath = getGlobalConfigPath();
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    if (process.platform !== 'win32') {
        try {
            await fs.chmod(configPath, 0o600);
        }
        catch {
            /* best-effort */
        }
    }
};
