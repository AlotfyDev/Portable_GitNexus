import { type SyntaxNode } from '../../utils/ast-helpers.js';
import type { PendingAssignment } from '../../type-extractors/types.js';
export declare const substituteThisReceiver: (item: PendingAssignment, node: SyntaxNode) => PendingAssignment;
