const { version } = require('../package.json');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log(`Generating version file for version: ${version}\n`);

function loadExistingCompatibility(versionFilePath) {
    if (!fs.existsSync(versionFilePath)) {
        return [];
    }

    const existingContent = fs.readFileSync(versionFilePath, 'utf-8');
    const match = existingContent.match(/export const COMPATIBILITY = ([\s\S]*?);/);
    if (!match) {
        return [];
    }

    try {
        const parsed = JSON.parse(match[1]);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function parseCompatibilityResults(output) {
    const marker = 'COMPATIBILITY_RESULTS_JSON=';
    const line = output
        .split(/\r?\n/)
        .map(l => l.trim())
        .find(l => l.startsWith(marker));

    if (!line) {
        return null;
    }

    return JSON.parse(line.slice(marker.length));
}

const versionFile = path.resolve(__dirname, '../src/version.ts');
const previousCompatibility = loadExistingCompatibility(versionFile);

// Run compatibility check and capture output
let allResults = null;
let compatibilityKeys = previousCompatibility;
try {
    console.log(`Running compatibility checks...`);
    const output = execSync('node scripts/check-compatibility.js', { 
        encoding: 'utf-8',
        env: { ...process.env }
    });
    const parsed = parseCompatibilityResults(output);
    if (parsed && typeof parsed === 'object') {
        allResults = parsed;
        console.log(`Compatibility check results:\n${JSON.stringify(allResults, null, 2)}`);
        // Only keep compatible versions for writing.
        compatibilityKeys = Object.keys(allResults)
            .filter(key => allResults[key] === 'compatible')
            .map(key => key.startsWith('v') ? key.slice(1) : key);
    } else {
        console.warn('No compatibility JSON marker found in output. Keeping previous compatibility values.');
    }
} catch (e) {
    console.error('Error during compatibility check:', e);
    console.warn('Keeping previous compatibility values due to compatibility check failure.');
}

// Write version and compatibility info to version.ts
const content = `export const VERSION = '${version}';
export const COMPATIBILITY = ${JSON.stringify(compatibilityKeys, null, 2)};
`;

fs.writeFileSync(versionFile, content);
console.log(`Wrote version and compatibility info to ${versionFile}`);