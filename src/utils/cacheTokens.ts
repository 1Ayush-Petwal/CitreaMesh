import fs from 'fs';
import path from 'path';

export default function cacheToken(mcpDir: string, deployment: any) {
  const file = path.join(mcpDir, 'deployed-tokens.json');
  let data: any[] = [];

  if (fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  data.push(deployment);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
