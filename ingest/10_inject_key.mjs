import fs from "node:fs/promises";

let pem = await fs.readFile("F:/github/kaodes_vip/data/rsa_private_key.pem", "utf8");
pem = pem.replace(/\\n/g, "\n").trim();

const target = "F:/github/kaodes_vip/extension/inject.js";
let src = await fs.readFile(target, "utf8");

if (!src.includes("const PRIVATE_KEY")) {
  console.error("未找到 PRIVATE_KEY 声明");
  process.exit(1);
}

src = src.replace(/const PRIVATE_KEY = [\s\S]*?;\n/, "const PRIVATE_KEY = " + JSON.stringify(pem) + ";\n");
await fs.writeFile(target, src, "utf8");

console.log("inject.js 私钥写入:", src.includes("BEGIN RSA PRIVATE KEY"), "| 占位符残留:", src.includes("{{PRIVATE_KEY"), "| 长度:", src.length);
