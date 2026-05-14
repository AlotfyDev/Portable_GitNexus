import { FILE_SCOPE } from './constants.js';
export const seedImportedBindings = (env, importedBindings) => {
    let fileEnv = env.get(FILE_SCOPE);
    if (!fileEnv) {
        fileEnv = new Map();
        env.set(FILE_SCOPE, fileEnv);
    }
    for (const [name, type] of importedBindings) {
        if (!fileEnv.has(name)) {
            fileEnv.set(name, type);
        }
    }
};
