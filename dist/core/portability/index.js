import { IS_PORTABLE_BUILD } from '../../generated/constants.js';
import { PortableContract, DevContract } from './contract.js';
let instance = null;
export function getPortability() {
    if (!instance) {
        instance = IS_PORTABLE_BUILD ? new PortableContract() : new DevContract();
    }
    return instance;
}
