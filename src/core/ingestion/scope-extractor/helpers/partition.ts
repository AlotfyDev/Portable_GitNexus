import type { CaptureMatch } from 'gitnexus-shared';
import type { Partitioned } from '../types.js';

type Topic = 'scope' | 'declaration' | 'import' | 'type-binding' | 'reference' | 'unknown';

function topicOf(match: CaptureMatch): Topic {
  for (const name of Object.keys(match)) {
    if (name.startsWith('@scope.')) return 'scope';
    if (name.startsWith('@declaration.')) return 'declaration';
    if (name.startsWith('@import.')) return 'import';
    if (name.startsWith('@type-binding.')) return 'type-binding';
    if (name.startsWith('@reference.')) return 'reference';
  }
  return 'unknown';
}

export function partitionByTopic(matches: readonly CaptureMatch[]): Partitioned {
  const scope: CaptureMatch[] = [];
  const declaration: CaptureMatch[] = [];
  const import_: CaptureMatch[] = [];
  const typeBinding: CaptureMatch[] = [];
  const reference: CaptureMatch[] = [];

  for (const match of matches) {
    const topic = topicOf(match);
    switch (topic) {
      case 'scope':
        scope.push(match);
        break;
      case 'declaration':
        declaration.push(match);
        break;
      case 'import':
        import_.push(match);
        break;
      case 'type-binding':
        typeBinding.push(match);
        break;
      case 'reference':
        reference.push(match);
        break;
      case 'unknown':
        break;
    }
  }

  return { scope, declaration, import_, typeBinding, reference };
}
