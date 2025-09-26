import fs from "fs";
import path from "path";
export default function cacheToken(mcpDir, deployment) {
    const file = path.join(mcpDir, "deployed-tokens.json");
    let data = [];
    if (fs.existsSync(file)) {
        data = JSON.parse(fs.readFileSync(file, "utf8"));
    }
    data.push(deployment);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
