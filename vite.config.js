import { defineConfig } from 'vite';

const repository = process.env.GITHUB_REPOSITORY;
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const repoName = repository?.split('/')[1];

export default defineConfig({
  base: isGitHubActions && repoName ? `/${repoName}/` : '/'
});
