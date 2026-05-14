import { createReadStream, createWriteStream } from 'fs';
import { createInterface } from 'readline';
import { once } from 'events';
import { finished } from 'stream/promises';
import path from 'path';
export const splitRelCsvByLabelPair = async (csvPath, csvDir, validTables, getNodeLabel, wsFactory = (p) => createWriteStream(p, 'utf-8')) => {
    let relHeader = '';
    const relsByPairMeta = new Map();
    const pairWriteStreams = new Map();
    let skippedRels = 0;
    let totalValidRels = 0;
    const inputStream = createReadStream(csvPath, 'utf-8');
    const rl = createInterface({ input: inputStream, crlfDelay: Infinity });
    const abortOnError = new AbortController();
    let streamError = null;
    const markStreamError = (err) => {
        streamError ??= err;
        abortOnError.abort(err);
    };
    try {
        let isFirst = true;
        for await (const line of rl) {
            if (streamError)
                throw streamError;
            if (isFirst) {
                relHeader = line;
                isFirst = false;
                continue;
            }
            if (!line.trim())
                continue;
            const match = line.match(/"([^"]*)","([^"]*)"/);
            if (!match) {
                skippedRels++;
                continue;
            }
            const fromLabel = getNodeLabel(match[1]);
            const toLabel = getNodeLabel(match[2]);
            if (!validTables.has(fromLabel) || !validTables.has(toLabel)) {
                skippedRels++;
                continue;
            }
            const pairKey = `${fromLabel}|${toLabel}`;
            let ws = pairWriteStreams.get(pairKey);
            if (!ws) {
                const pairCsvPath = path.join(csvDir, `rel_${fromLabel}_${toLabel}.csv`);
                ws = wsFactory(pairCsvPath);
                ws.on('error', markStreamError);
                pairWriteStreams.set(pairKey, ws);
                relsByPairMeta.set(pairKey, { csvPath: pairCsvPath, rows: 0 });
                if (!ws.write(relHeader + '\n')) {
                    await once(ws, 'drain', { signal: abortOnError.signal });
                }
            }
            if (!ws.write(line + '\n')) {
                await once(ws, 'drain', { signal: abortOnError.signal });
            }
            relsByPairMeta.get(pairKey).rows++;
            totalValidRels++;
        }
        if (streamError)
            throw streamError;
    }
    catch (err) {
        for (const ws of pairWriteStreams.values())
            ws.destroy();
        inputStream.destroy();
        throw streamError ?? err;
    }
    finally {
        await finished(inputStream).catch(() => { });
    }
    return { relHeader, relsByPairMeta, pairWriteStreams, skippedRels, totalValidRels };
};
