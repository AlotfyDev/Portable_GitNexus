import { THIS_RECEIVERS } from '../constants.js';
import { findEnclosingClassName } from './class-lookup.js';
export const substituteThisReceiver = (item, node) => {
    if (item.kind !== 'fieldAccess' && item.kind !== 'methodCallResult')
        return item;
    if (!THIS_RECEIVERS.has(item.receiver))
        return item;
    const className = findEnclosingClassName(node);
    if (!className)
        return item;
    return { ...item, receiver: className };
};
