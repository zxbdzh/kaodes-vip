import fs from "node:fs/promises";

const pem = await fs.readFile("F:/github/kaodes_vip/data/rsa_private_key.pem", "utf8");
const body = pem.replace(/\\n/g, "\n");

const js = `// 考得尚签名私钥（前端 7959ccc.js 硬编码 setPrivateKey）
// 用于解密 /special/playVideo 返回的百家云 token 与 PolyV playsafe
const KAODES_RSA_PRIVATE_KEY = ${JSON.stringify(body)};
`;

await fs.writeFile("F:/github/kaodes_vip/extension/key.js", js, "utf8");
const back = JSON.parse(js.match(/KAODES_RSA_PRIVATE_KEY = (".*");/s)[1]);
console.log("key.js 已写入，长度:", back.length, "| 含BEGIN:", back.includes("BEGIN RSA PRIVATE KEY"));
