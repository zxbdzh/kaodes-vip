// 纯 JS RSAES-PKCS1-v1_5 解密（BigInt 实现，无需 JSEncrypt / WebCrypto）
// 用于解密考得尚 playVideo 返回的百家云 token 与 PolyV playsafe
(function (root) {
  "use strict";

  function b64ToBigInt(b64) {
    const bin = atob(b64);
    let hex = "";
    for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
    return BigInt("0x" + (hex || "0"));
  }

  function modPow(base, exp, mod) {
    let r = 1n;
    base %= mod;
    while (exp > 0n) {
      if (exp & 1n) r = (r * base) % mod;
      base = (base * base) % mod;
      exp >>= 1n;
    }
    return r;
  }

  function bigIntToBytes(v, len) {
    let hex = v.toString(16);
    if (hex.length % 2) hex = "0" + hex;
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    if (len && out.length < len) {
      const padded = new Uint8Array(len);
      padded.set(out, len - out.length);
      return padded;
    }
    return out;
  }

  function b64ByteLength(b64) {
    const clean = b64.replace(/=+$/, "");
    return Math.floor((clean.length * 3) / 4);
  }

  function createKdsRsa(params) {
    const n = b64ToBigInt(params.n);
    const d = b64ToBigInt(params.d);
    const k = b64ByteLength(params.n);

    return function decrypt(cipherB64) {
      const c = b64ToBigInt(cipherB64);
      if (c >= n) throw new Error("密文超出模数");
      const m = modPow(c, d, n);
      const em = bigIntToBytes(m, k);

      // PKCS#1 v1.5: 0x00 0x02 <非零随机> 0x00 <明文>
      if (em[0] !== 0x00 || em[1] !== 0x02) throw new Error("填充头错误");
      let i = 2;
      while (i < em.length && em[i] !== 0x00) i++;
      if (i >= em.length) throw new Error("未找到分隔符");
      const body = em.slice(i + 1);

      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(body);
      } catch (e) {
        let s = "";
        for (let j = 0; j < body.length; j++) s += String.fromCharCode(body[j]);
        return s;
      }
    };
  }

  root.createKdsRsa = createKdsRsa;
  return createKdsRsa;
})(typeof window !== "undefined" ? window : globalThis);
