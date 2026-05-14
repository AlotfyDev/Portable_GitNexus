import { IS_PORTABLE_BUILD, DEV_APP_ROOT_URL } from '../../generated/constants.js';
import { dirname, basename } from 'path';
import { fileURLToPath } from 'url';

export interface PortabilityContract {
  readonly isPortable: boolean;
  readonly hasNativeAddons: boolean;
  readonly hasWorkerPool: boolean;
  readonly hasLeidenAlgorithm: boolean;
  readonly hasVectorExtension: boolean;
  readonly hasHttpEmbeddings: boolean;
  readonly hasOnnxRuntimeNode: boolean;
  readonly hasCuda: boolean;
  readonly appDir: string;
}

/**
 * Returns true when the current process runs under Node.js (not bun-compiled).
 * bun-compiled binaries have process.execPath = the binary path (e.g. gitnexus.exe).
 * Node.js has process.execPath = node.exe or node.
 */
function isNodeRuntime(): boolean {
  const name = basename(process.execPath);
  return name === 'node' || name === 'node.exe';
}

class PortableContract implements PortabilityContract {
  readonly isPortable = true;
  readonly hasNativeAddons = false;
  readonly hasWorkerPool = false;
  readonly hasLeidenAlgorithm = false;
  readonly hasVectorExtension = true;
  readonly hasHttpEmbeddings = true;
  readonly hasOnnxRuntimeNode = false;
  readonly hasCuda = false;
  readonly appDir: string;

  constructor() {
    // 1. Launcher scripts (gitnexus.cmd / gitnexus.ps1) set this explicitly
    if (process.env.GITNEXUS_APP_DIR) {
      this.appDir = process.env.GITNEXUS_APP_DIR;
    } else if (isNodeRuntime()) {
      // 2. Node.js portable package: process.execPath is node.exe
      //    appDir is derived from the entry script (process.argv[1]):
      //      <portable_root>/dist/cli/index.js  →  appDir = dirname(dirname(argv[1]))
      this.appDir = (process.argv[1] && !process.argv[1].startsWith('-'))
        ? dirname(dirname(process.argv[1]))
        : dirname(process.execPath);
    } else {
      // 3. bun-compiled binary: process.execPath IS the portable binary
      this.appDir = dirname(process.execPath);
    }
  }
}

class DevContract implements PortabilityContract {
  readonly isPortable = false;
  readonly hasNativeAddons = true;
  readonly hasWorkerPool = true;
  readonly hasLeidenAlgorithm = true;
  readonly hasVectorExtension = true;
  readonly hasHttpEmbeddings = true;
  readonly hasOnnxRuntimeNode = true;
  readonly hasCuda = false;
  readonly appDir = DEV_APP_ROOT_URL
    ? dirname(fileURLToPath(DEV_APP_ROOT_URL))
    : process.cwd();
}

export { PortableContract, DevContract };
