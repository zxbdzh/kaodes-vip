import fs from "node:fs/promises";

// 1) 构建 inject.js
const pem = (await fs.readFile("F:/github/kaodes_vip/data/rsa_private_key.pem", "utf8")).replace(/\\n/g, "\n").trim();
const tpl = await fs.readFile("F:/github/kaodes_vip/extension/inject.tpl.js", "utf8");
const inject = tpl.replace('"__KDS_PRIVATE_KEY__"', JSON.stringify(pem));
await fs.writeFile("F:/github/kaodes_vip/extension/inject.js", inject, "utf8");
console.log("inject.js:", inject.length, "字节 | 私钥:", inject.includes("BEGIN RSA PRIVATE KEY"));

// 2) 复制 catalog.json / bank.json
for (const f of ["catalog.json", "bank.json"]) {
  await fs.copyFile("F:/github/kaodes_vip/data/" + f, "F:/github/kaodes_vip/extension/" + f);
  const s = await fs.stat("F:/github/kaodes_vip/extension/" + f);
  console.log(f + ":", (s.size / 1024).toFixed(0), "KB");
}

// 3) 校验 manifest JSON
const mf = JSON.parse(await fs.readFile("F:/github/kaodes_vip/extension/manifest.json", "utf8"));
console.log("manifest OK | content_scripts:", mf.content_scripts.length, "| WAR:", mf.web_accessible_resources[0].resources.join(","));
