import fs from "node:fs/promises";
import vm from "node:vm";
import crypto from "node:crypto";

const EXT = "F:/github/kaodes_vip/extension";
const rsaJs = await fs.readFile(EXT + "/rsa.js", "utf8");
const injectSrc = await fs.readFile(EXT + "/inject.js", "utf8");
const token = process.env.EGO_TOKEN || "";

const ctx = {
  atob: (s) => Buffer.from(s, "base64").toString("binary"),
  TextDecoder, BigInt, Uint8Array, String, Number, Math, JSON, Object, Array, Error, Promise, console,
  setTimeout, clearTimeout,
  fetch: (...a) => fetch(...a),
  document: { cookie: "token=" + token + "; user=" + encodeURIComponent(JSON.stringify({ userId: 8319835, userName: "t" })) },
  CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
  listeners: {},
};
ctx.window = ctx;
ctx.window.addEventListener = (t, fn) => { (ctx.listeners[t] = ctx.listeners[t] || []).push(fn); };
ctx.window.dispatchEvent = (ev) => { (ctx.listeners[ev.type] || []).forEach((f) => f(ev)); };
ctx.globalThis = ctx;
vm.createContext(ctx);

vm.runInContext(rsaJs, ctx);
vm.runInContext(injectSrc, ctx);
console.log("__KDS ready:", ctx.__KDS && ctx.__KDS.ready);

const result = await new Promise((resolve) => {
  ctx.window.addEventListener("kds-sign-result", (ev) => resolve(ev.detail));
  ctx.window.dispatchEvent(new ctx.CustomEvent("kds-sign", {
    detail: { id: "t", payload: { vid: "207898457", cstId: 35392, courseId: "24085", catId: "1209868", materialType: 1 } },
  }));
  setTimeout(() => resolve({ ok: false, error: "timeout" }), 25000);
});

console.log("结果:", JSON.stringify({ ok: result.ok, error: result.error, len: result.token?.length, q: result.quality, dur: result.duration }));

if (result.ok) {
  const r = await fetch("https://beegoapi.beeeeego.com/mobile/special/playVideo", {
    method: "POST", headers: { "content-type": "application/json", agencyId: "9922", platform: "Pc", token },
    body: JSON.stringify({ vid: "207898457", cstId: 35392, courseId: "24085", catId: "1209868", materialType: 1 }),
  });
  const j = await r.json();
  const K = ["play", "Bj", "Sign", "Secret"].join("");
  const pem = (await fs.readFile("F:/github/kaodes_vip/data/rsa_private_key.pem", "utf8")).replace(/\\n/g, "\n").trim();
  const priv = crypto.createPrivateKey({ key: pem, format: "pem", type: "pkcs1" });
  const ref = crypto.privateDecrypt({ key: priv, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(j.data[K], "base64")).toString("utf8");
  console.log("签名与 Node 参考一致:", result.token === ref);
}
