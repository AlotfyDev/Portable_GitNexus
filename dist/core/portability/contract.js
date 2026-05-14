import { DEV_APP_ROOT_URL } from '../../generated/constants.js';
import { dirname, basename } from 'path';
import { fileURLToPath } from 'url';
/**
 * Returns true when the current process runs under Node.js (not bun-compiled).
 * bun-compiled binaries have process.execPath = the binary path (e.g. gitnexus.exe).
 * Node.js has process.execPath = node.exe or node.
 */
function isNodeRuntime() {
    const name = basename(process.execPath);
    return name === 'node' || name === 'node.exe';
}
class PortableContract {
    isPortable = true;
    hasNativeAddons = false;
    hasWorkerPool = false;
    hasLeidenAlgorithm = false;
    hasVectorExtension = true;
    hasHttpEmbeddings = true;
    hasOnnxRuntimeNode = false;
    hasCuda = false;
    appDir;
    constructor() {
        // 1. Launcher scripts (gitnexus.cmd / gitnexus.ps1) set this explicitly
        if (process.env.GITNEXUS_APP_DIR) {
            this.appDir = process.env.GITNEXUS_APP_DIR;
        }
        else if (isNodeRuntime()) {
            // 2. Node.js portable package: process.execPath is node.exe
            //    appDir is derived from the entry script (process.argv[1]):
            //      <portable_root>/dist/cli/index.js  →  appDir = dirname(dirname(argv[1]))
            this.appDir = (process.argv[1] && !process.argv[1].startsWith('-'))
                ? dirname(dirname(process.argv[1]))
                : dirname(process.execPath);
        }
        else {
            // 3. bun-compiled binary: process.execPath IS the portable binary
            this.appDir = dirname(process.execPath);
        }
    }
}
class DevContract {
    isPortable = false;
    hasNativeAddons = true;
    hasWorkerPool = true;
    hasLeidenAlgorithm = true;
    hasVectorExtension = true;
    hasHttpEmbeddings = true;
    hasOnnxRuntimeNode = true;
    hasCuda = false;
    appDir = DEV_APP_ROOT_URL
        ? dirname(fileURLToPath(DEV_APP_ROOT_URL))
        : process.cwd();
}
export { PortableContract, DevContract };
