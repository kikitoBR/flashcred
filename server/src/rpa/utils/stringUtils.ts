export class StringUtils {
    /**
     * Finds the best matching option from a list of options based on token overlap.
     * Useful for matching vehicle models/versions where word order or casing might differ.
     * 
     * @param target The string we want to find (e.g. "DRIVE 1.3 8V FIREFLY")
     * @param options The available strings to pick from
     */
    static findBestMatch(target: string, options: string[]): string | null {
        if (!options || options.length === 0) return null;
        if (!target) return options[0]; // If no target provided, fallback to first option

        const cleanString = (str: string) =>
            str.toLowerCase()
                .replace(/[^a-z0-9]/g, ' ') // Replace punctuation with space
                .replace(/\s+/g, ' ')      // Collapse multiple spaces
                .trim();

        const getTokens = (str: string) => new Set(cleanString(str).split(' ').filter(t => t.length > 0));

        const targetTokens = getTokens(target);

        // Exact clean match shortcut
        const cleanTarget = cleanString(target);
        for (const opt of options) {
            if (cleanString(opt) === cleanTarget) {
                return opt;
            }
        }

        let bestMatch: string | null = null;
        let highestScore = -1;

        for (const option of options) {
            const optionTokens = getTokens(option);
            let score = 0;

            // Simple intersection score
            for (const token of targetTokens) {
                if (optionTokens.has(token)) {
                    score += 1;

                    // Boost score for numeric matches (often engine size like 1.0, 1.3, year)
                    if (/\d/.test(token)) {
                        score += 0.5;
                    }
                }
            }

            // Penalize slightly for options that have way too many extra words compared to the target
            // It prevents picking extremely long options that just happen to include some words
            const lengthDiff = Math.abs(optionTokens.size - targetTokens.size);
            const penalty = lengthDiff * 0.1;
            const finalScore = score - penalty;

            if (finalScore > highestScore) {
                highestScore = finalScore;
                bestMatch = option;
            }
        }

        // Return the best match. Even an imperfect overlap is returned as long as it's the maximal score.
        // It guarantees we pick something reasonable.
        return bestMatch;
    }
}
