// Bun build plugin for standalone binary compilation

export default {
  name: 'gitnexus-standalone',
  setup(build) {
    // ── Stub native-only modules ────────────────────────────────────
    build.onResolve({ filter: /@ladybugdb/ }, (args) => {
      return { path: 'lbug-stub:' + args.path, namespace: 'lbug-stub' };
    });
    build.onLoad({ filter: /^lbug-stub:/, namespace: 'lbug-stub' }, () => {
      return {
        contents: [
          'const _err = () => { throw new Error("@ladybugdb/core not available in portable binary"); };',
          'const Database = class Database { constructor() { _err(); } };',
          'export { Database };',
          'export default Database;',
          'export const connect = _err;',
          'export const init = _err;',
          'export const close = _err;',
        ].join('\n'),
        loader: 'js',
      };
    });
  },
};
