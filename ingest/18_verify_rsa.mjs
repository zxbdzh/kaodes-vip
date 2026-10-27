import fs from "node:fs/promises";
import crypto from "node:crypto";

const params = JSON.parse(await fs.readFile("F:/github/kaodes_vip/extension/rsa.json", "utf8"));
const rsaJs = await fs.readFile("F:/github/kaodes_vip/extension/rsa.js", "utf8");

// rsa.js 挂到 globalThis；用独立 vm 上下文模拟浏览器
import vm from "node:vm";
const ctx = vm.createContext({
  atob: (s) => Buffer.from(s, "base64").toString("binary"),
  TextDecoder, BigInt, Uint8Array, String, parseInt, Math, Error, console,
});
vm.runInContext(rsaJs, ctx);
const factory = ctx.createKdsRsa;
console.log("工厂函数:", typeof factory);
const decrypt = factory(params);

const TOKEN = process.env.EGO_TOKEN || "";
const r = await fetch("https://beegoapi.beeeeego.com/mobile/special/playVideo", {
  method: "POST",
  headers: { "content-type": "application/json", agencyId: "9922", platform: "Pc", token: TOKEN },
  body: JSON.stringify({ vid: "207898457", cstId: 35392, courseId: "24085", catId: "1209868", materialType: 1 }),
});
const j = await r.json();
if (j.code !== 200) { console.log("playVideo 失败:", j.code, j.message); process.exit(1); }

const K_BJ = ["play", "Bj", "Sign", "Secret"].join("");
const enc = j.data[K_BJ];

const jsResult = decrypt(enc);
console.log("JS 实现:", jsResult.slice(0, 60) + "...");

const pem = (await fs.readFile("F:/github/kaodes_vip/data/rsa_private_key.pem", "utf8")).replace(/\\n/g, "\n").trim();
const priv = crypto.createPrivateKey({ key: pem, format: "pem", type: "pkcs1" });
const nodeResult = crypto.privateDecrypt({ key: priv, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(enc, "base64")).toString("utf8");
console.log("Node 参考:", nodeResult.slice(0, 60) + "...");
console.log("\n完全一致:", jsResult === nodeResult);
