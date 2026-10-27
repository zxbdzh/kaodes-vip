import crypto from "node:crypto";
import fs from "node:fs/promises";

// 从 PEM 提取 RSA 参数，输出为扩展可直接使用的 base64 大数
const pem = (await fs.readFile("F:/github/kaodes_vip/data/rsa_private_key.pem", "utf8")).replace(/\\n/g, "\n").trim();
const jwk = crypto.createPrivateKey({ key: pem, format: "pem", type: "pkcs1" }).export({ format: "jwk" });

const b64urlToB64 = (s) => s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);

const params = {
  n: b64urlToB64(jwk.n),
  e: b64urlToB64(jwk.e),
  d: b64urlToB64(jwk.d),
  p: b64urlToB64(jwk.p),
  q: b64urlToB64(jwk.q),
  dp: b64urlToB64(jwk.dp),
  dq: b64urlToB64(jwk.dq),
  qinv: b64urlToB64(jwk.qi),
};

await fs.writeFile("F:/github/kaodes_vip/extension/rsa.json", JSON.stringify(params, null, 1), "utf8");
console.log("rsa.json 已生成 | n 长度:", params.n.length, "| d 长度:", params.d.length);
console.log("字段:", Object.keys(params).join(","));
