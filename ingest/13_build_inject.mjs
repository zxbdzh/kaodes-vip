import fs from "node:fs/promises";

const pem = (await fs.readFile("F:/github/kaodes_vip/data/rsa_private_key.pem", "utf8")).replace(/\\n/g, "\n").trim();
const tpl = await fs.readFile("F:/github/kaodes_vip/extension/inject.tpl.js", "utf8");

const out = tpl.replace('"__KDS_PRIVATE_KEY__"', JSON.stringify(pem));
await fs.writeFile("F:/github/kaodes_vip/extension/inject.js", out, "utf8");

console.log("inject.js 构建完成 | 私钥注入:", out.includes("BEGIN RSA PRIVATE KEY"), "| 大小:", out.length);
