import crypto from "node:crypto";
import fs from "node:fs/promises";

// 验证 WebCrypto 能否做 RSAES-PKCS1-v1_5 解密（插件后台用它替代 JSEncrypt）
const pem = (await fs.readFile("F:/github/kaodes_vip/data/rsa_private_key.pem", "utf8")).replace(/\\n/g, "\n").trim();

function pemToPkcs8(pemStr) {
  const b64 = pemStr
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const der = Buffer.from(b64, "base64");
  return der;
}

// PKCS#1 -> PKCS#8 需要用 node 转换一次
const keyObj = crypto.createPrivateKey({ key: pem, format: "pem", type: "pkcs1" });
const pkcs8 = keyObj.export({ type: "pkcs8", format: "der" });
console.log("PKCS8 DER 长度:", pkcs8.length);

const subtle = globalThis.crypto.subtle;
const key = await subtle.importKey("pkcs8", pkcs8, { name: "RSAES-PKCS1-v1_5", hash: "SHA-1" }, false, ["decrypt"])
  .catch((e) => { console.log("importKey 失败:", e.message); return null; });
console.log("importKey:", key ? "OK" : "FAIL");

if (key) {
  // 用真实密文测试
  const TOKEN = process.env.EGO_TOKEN || "";
  const r = await fetch("https://beegoapi.beeeeego.com/mobile/special/playVideo", {
    method: "POST",
    headers: { "content-type": "application/json", agencyId: "9922", platform: "Pc", token: TOKEN },
    body: JSON.stringify({ vid: "207898457", cstId: 35392, courseId: "24085", catId: "1209868", materialType: 1 }),
  });
  const j = await r.json();
  console.log("playVideo:", j.code);

  const K_BJ = ["play", "Bj", "Sign", "Secret"].join("");
  const enc = j.data && j.data[K_BJ];
  if (enc) {
    const buf = Buffer.from(enc, "base64");
    try {
      const plain = await subtle.decrypt({ name: "RSAES-PKCS1-v1_5" }, key, buf);
      const txt = new TextDecoder().decode(plain);
      console.log("WebCrypto 解密成功:", txt.slice(0, 50) + "...");
    } catch (e) {
      console.log("WebCrypto 解密失败:", e.message);
    }
  }
}
