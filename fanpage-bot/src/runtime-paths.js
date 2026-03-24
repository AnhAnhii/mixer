import path from 'node:path';

function isLikelyReadOnlyBundleRoot(cwd = process.cwd()) {
  return cwd === '/var/task' || cwd.startsWith('/var/task/');
}

export function resolveWritableDataPath(relativePath) {
  if (process.env.VERCEL || isLikelyReadOnlyBundleRoot()) {
    return path.resolve('/tmp/fanpage-bot', relativePath);
  }

  return path.resolve(process.cwd(), relativePath);
}
