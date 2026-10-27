import fs from "node:fs/promises";

const B = "https://beegoapi.beeeeego.com/mobile";
const TOKEN = process.env.EGO_TOKEN || "";
const H = { agencyId: "9922", token: TOKEN, platform: "Pc" };

async function api(method, p, body) {
  const r = await fetch(B + p, {
    method, headers: { ...H, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { return {}; }
}

// 补 高等数学（工本）：productId 25239038
const d = await api("GET", "/product/productsDetail?productId=25239038&agencyId=9922");
const pd = d.data && d.data.productDetail;
console.log("高等数学（工本）:", pd.name, pd.specialName, "| cstIds:", pd.cstIds, "| courseSet:", pd.courseSet);

for (const cstId of String(pd.cstIds).split(",")) {
  for (const cid of [pd.courseSet, String(pd.courseSet || "").replace(/^0+/, "")]) {
    if (!cid) continue;
    const cat = await api("POST", "/course/specialCatV2", { cstId: Number(cstId), courseId: cid });
    if (cat.code === 200 && cat.data && cat.data.courseName) {
      console.log(`  cstId=${cstId} courseId=${cid} => ${cat.data.courseName} | 视频 ${cat.data.videoNum} | ${cat.data.formatVideoTime}`);
    }
  }
}

// 软件质量：全站搜关键字
console.log("\n软件质量 全站搜索:");
for (const kw of ["软件质量", "CMM", "质量保证"]) {
  const r = await api("POST", "/product/agencyProducts", { pageNum: 1, pageSize: 30, agencyId: 9922, keywords: kw, productClassId: "", specialType: "" });
  const list = (r.data && (r.data.list || r.data.rows)) || [];
  console.log(`  "${kw}" -> ${list.length}`, list.slice(0, 3).map((x) => x.name).join(" / "));
}
