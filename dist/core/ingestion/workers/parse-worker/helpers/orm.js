import { PRISMA_QUERY_RE, SUPABASE_QUERY_RE } from '../constants.js';
export function extractORMQueries(filePath, content, out) {
    const hasPrisma = content.includes('prisma.');
    const hasSupabase = content.includes('supabase.from');
    if (!hasPrisma && !hasSupabase)
        return;
    if (hasPrisma) {
        PRISMA_QUERY_RE.lastIndex = 0;
        let m;
        while ((m = PRISMA_QUERY_RE.exec(content)) !== null) {
            const model = m[1];
            if (model.startsWith('$'))
                continue;
            out.push({
                filePath,
                orm: 'prisma',
                model,
                method: m[2],
                lineNumber: content.substring(0, m.index).split('\n').length - 1,
            });
        }
    }
    if (hasSupabase) {
        SUPABASE_QUERY_RE.lastIndex = 0;
        let m;
        while ((m = SUPABASE_QUERY_RE.exec(content)) !== null) {
            out.push({
                filePath,
                orm: 'supabase',
                model: m[1],
                method: m[2],
                lineNumber: content.substring(0, m.index).split('\n').length - 1,
            });
        }
    }
}
