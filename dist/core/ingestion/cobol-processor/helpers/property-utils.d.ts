/** Generate a deterministic Property node ID using composite key (section:level:name). */
declare function generatePropertyId(filePath: string, item: {
    section: string;
    level: number;
    name: string;
}): string;
export { generatePropertyId };
