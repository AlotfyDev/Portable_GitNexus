import { IS_PORTABLE_BUILD } from '../../generated/constants.js';
import { type PortabilityContract, PortableContract, DevContract } from './contract.js';

let instance: PortabilityContract | null = null;

export function getPortability(): PortabilityContract {
  if (!instance) {
    instance = IS_PORTABLE_BUILD ? new PortableContract() : new DevContract();
  }
  return instance;
}

export { type PortabilityContract };
