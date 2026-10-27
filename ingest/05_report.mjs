import fs from "node:fs/promises";
import path from "node:path";

const OUT = "F:/github/kaodes_vip/data";
const library = JSON.parse(await fs.readFile(path.join(OUT, "library.json"), "utf8"));
let vault = { items: {} };
try { vault = JSON.parse(await fs.readFile(path.join(OUT, "vault.json"), "utf8")); } catch (e) { }

const okSubs = library.filter((s) => s.ok);
const items = Object.values(vault.items || {}).filter((x) => !x.failed);

console.log(`科目 ${okSubs.length}/${library.length} | 视频 ${items.length}`);

// ===== 1. Markdown 课程库清单 =====
const lines = [];
lines.push("# 考得尚网校 · 自考计算机类课程库");
lines.push("");
lines.push(`生成时间：${new Date().toLocaleString("zh-CN")}`);
lines.push("");
lines.push("## 覆盖专业");
lines.push("");
lines.push("| 专业 | 代码 | 主考院校 | 计划课程数 | 已入库 |");
lines.push("| --- | --- | --- | --- | --- |");
lines.push("| 计算机科学与技术 | 080901 | 集美大学 | 15 | 见下表 |");
lines.push("| 软件工程 | 080902 | 华侨大学 | 15 | 见下表 |");
lines.push("");
lines.push("## 科目与资源对照");
lines.push("");
lines.push("| 课程代码 | 课程名称 | 班型 | 视频数 | 总时长 | courseId | cstId | 状态 |");
lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");

for (const s of library) {
  if (s.ok) {
    const got = items.filter((x) => x.subjectCode === s.code).length;
    lines.push(`| ${s.code} | ${s.courseName} | ${s.specialName || "-"} | ${s.videos.length} | ${s.formatVideoTime || "-"} | ${s.courseId} | ${s.cstId} | ✅ 已签发 ${got} |`);
  } else {
    lines.push(`| ${s.code} | ${s.name} | - | 0 | - | - | - | ⚠️ ${s.note || "平台无此课程"} |`);
  }
}

lines.push("");
lines.push("## 说明");
lines.push("");
lines.push("- 「软件质量保证与测试(13008)」在考得尚全站商品库中无对应课程，属平台未开设。");
lines.push("- 播放地址由百家云 VOD 下发，有效期与签发 token 绑定，需在客户端实时拉取。");
lines.push("- 每次播放前调用签发脚本即可刷新凭据。");

await fs.writeFile(path.join(OUT, "课程库.md"), lines.join("\n"), "utf8");
console.log("已写 课程库.md");

// ===== 2. 结构化 JSON =====
const catalog = okSubs.map((s) => ({
  code: s.code, name: s.courseName, courseNo: s.courseNo,
  plans: s.plans, productId: s.productId,
  courseId: String(s.courseId), cstId: s.cstId,
  specialName: s.specialName, videoCount: s.videos.length,
  totalTime: s.formatVideoTime,
  videos: s.videos.map((v) => ({
    vid: v.bVideoId || v.vid, catId: v.catId,
    materialType: v.materialType, duration: v.formatTime,
    path: v.path,
    credentialKey: `${v.cstId}_${v.catId}_${v.bVideoId || v.vid}`,
  })),
}));
await fs.writeFile(path.join(OUT, "catalog.json"), JSON.stringify({ generatedAt: new Date().toISOString(), subjects: catalog }, null, 1), "utf8");
console.log("已写 catalog.json");
