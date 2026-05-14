import { type SyntaxNode } from '../../utils/ast-helpers.js';
import type { PendingAssignment } from '../../type-extractors/types.js';
import { THIS_RECEIVERS } from '../constants.js';
import { findEnclosingClassName } from './class-lookup.js';

export const substituteThisReceiver = (item: PendingAssignment, node: SyntaxNode): PendingAssignment => {
  if (item.kind !== 'fieldAccess' && item.kind !== 'methodCallResult') return item;
  if (!THIS_RECEIVERS.has(item.receiver)) return item;
  const className = findEnclosingClassName(node);
  if (!className) return item;
  return { ...item, receiver: className };
};
