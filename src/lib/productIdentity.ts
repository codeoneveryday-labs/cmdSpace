const GITHUB_OWNER = "codeoneveryday-labs";
const GITHUB_REPOSITORY = "cmdSpace";
const GITHUB_REPOSITORY_PATH = `${GITHUB_OWNER}/${GITHUB_REPOSITORY}`;

export const PRODUCT_IDENTITY = {
  github: {
    repoUrl: `https://github.com/${GITHUB_REPOSITORY_PATH}`,
    latestReleaseApiUrl: `https://api.github.com/repos/${GITHUB_REPOSITORY_PATH}/releases/latest`,
    updaterManifestUrl: `https://github.com/${GITHUB_REPOSITORY_PATH}/releases/latest/download/latest.json`,
  },
} as const;
