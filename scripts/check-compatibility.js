const originalLog = console.log;
console.log = function () {
  // Suppress dotenv logs
  if (arguments[0] && typeof arguments[0] === 'string' && arguments[0].includes('[dotenv@')) {
    return;
  }
  originalLog.apply(console, arguments);
};

require('dotenv').config();
console.log = originalLog;
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const tar = require('tar');
const { version } = require('../package.json');

const CI_PROJECT_ID = process.env.CI_PROJECT_ID;
const CI_API_V4_URL = process.env.CI_API_V4_URL;
const MAXIMUM_VERSIONS = 20;
const requestedVersion = process.argv[2] ?? null;

function getGitlabAuthHeader() {
    if (process.env.CI) {
        // Running in CI
        return { 'JOB-TOKEN': process.env.CI_JOB_TOKEN };
    } else {
        // Local or personal access token
        return { 'PRIVATE-TOKEN': process.env.CI_JOB_TOKEN };
    }
}

function fetchPackageVersions() {
    return new Promise((resolve, reject) => {
        const options = {
            headers: getGitlabAuthHeader()
        };
        https.get(`${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages?sort=desc&per_page=${MAXIMUM_VERSIONS}`, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const packages = JSON.parse(data);
                    // Return both version and id for each package
                    const versions = packages.map(pkg => ({
                        version: pkg.version,
                        id: pkg.id
                    }));
                    resolve(versions);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function getPackagesToTest(releasedPackages) {
    if (!requestedVersion) {
        return releasedPackages;
    }

    return releasedPackages.filter(pkg => pkg.version === requestedVersion);
}

// Download the package artifact for a given package id and extract /testing
function downloadAndExtractTesting(packageId, tempDir) {
    return new Promise((resolve, reject) => {
        // GitLab API endpoint for downloading a package file (adjust if needed)
        const fileUrl = `${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/${packageId}/package_files`;
        const options = {
            headers: getGitlabAuthHeader()
        };
        https.get(fileUrl, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const files = JSON.parse(data);
                    // Find the .tgz file
                    const tarFile = files.find(f => f.file_name.endsWith('.tgz'));
                    if (!tarFile) {
                        return resolve(false);
                    }

                    // Now download the actual .tgz
                    const tarUrl = `${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/npm/@open-dcp/services/-/${tarFile.file_name}`;
                    https.get(tarUrl, options, (tarRes) => {
                        tarRes.pipe(
                            tar.x({
                                C: tempDir,
                                filter: (path) => path.startsWith('package/src') && path.includes('__tests__')
                            })
                        )
                            .on('finish', () => resolve(true))
                            .on('error', reject);
                    }).on('error', reject);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

(async () => {
    const results = {};

    // 1. Run current tests unless a specific published version was requested.
    if (!requestedVersion) {
        console.log('\nChecking compatibility for current version (local /testing)...');
        try {
            execSync('npx jest --runInBand', { stdio: 'inherit' });
            results[version] = 'compatible';
        } catch (e) {
            results[version] = 'incompatible';
        }
    }

    // 2. Get released versions from GitLab
    const releasedPackages = await fetchPackageVersions();
    const packagesToTest = getPackagesToTest(releasedPackages);

    if (requestedVersion && packagesToTest.length === 0) {
        console.log(`\nNo published package found for version ${requestedVersion}.`);
        results[requestedVersion] = 'error';
    }

    // 3. For each version, download and test
    for (const pkg of packagesToTest) {
        const { version, id } = pkg;
        const tempDir = path.join(process.cwd(), 'tmp_version_testing', `testing-${version}`);
        fs.mkdirSync(tempDir, { recursive: true });
        try {
            await downloadAndExtractTesting(id, tempDir);
            console.log(`\nChecking compatibility for ${version} (using /testing from package)...`);
            try {
                execSync(`npx jest --runInBand --testMatch "**/tmp_version_testing/**/*.test.ts"`, { stdio: 'inherit' });
                results[version] = 'compatible';
            } catch (e) {
                results[version] = 'incompatible';
            }
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {
            console.log(`\nError extracting or testing for ${version}:`, e.message);
            results[version] = 'error';
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { }
        }
    }

    console.log('\nCompatibility Results:');
    console.log(JSON.stringify(results, null, 2));
    // Emit a machine-readable single-line payload for generate-version.js.
    console.log(`COMPATIBILITY_RESULTS_JSON=${JSON.stringify(results)}`);
})();