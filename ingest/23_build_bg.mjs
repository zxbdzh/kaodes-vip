import fs from "node:fs/promises";

const EXT = "F:/github/kaodes_vip/extension";

// 1) background.js 内联 RSA 参数
const params = JSON.parse(await fs.readFile(EXT + "/rsa.json", "utf8"));
let bg = await fs.readFile(EXT + "/background.js", "utf8");
bg = bg.replace("__KDS_RSA_PARAMS__", JSON.stringify(params));
await fs.writeFile(EXT + "/background.js", bg, "utf8");
console.log("background.js 内联 RSA:", bg.includes('"n"'), "| 大小:", bg.length);

// 2) manifest
const manifest = {
  manifest_version: 3,
  name: "考得尚解锁器 · 课程视频与题库",
  version: "1.0.0",
  description: "解锁考得尚网校全部课程视频（758 讲），内置真题题库 1903 题，支持章节练习与真题模拟。",
  permissions: ["cookies", "storage", "scripting", "tabs"],
  host_permissions: [
    "*://*.kaodes.com/*",
    "*://beegoapi.beeeeego.com/*",
    "*://*.baijiayun.com/*",
    "*://*.polyv.net/*",
    "*://*.beeeeego.com/*"
  ],
  background: { service_worker: "background.js" },
  action: { default_title: "考得尚解锁器", default_popup: "popup.html" },
  content_scripts: [
    { matches: ["*://*.kaodes.com/*"], js: ["content.js"], run_at: "document_idle", all_frames: false }
  ],
  web_accessible_resources: [
    { resources: ["catalog.json", "bank.json", "player.html"], matches: ["*://*.kaodes.com/*"] }
  ]
};
await fs.writeFile(EXT + "/manifest.json", JSON.stringify(manifest, null, 2), "utf8");
console.log("manifest.json 已写入");

// 3) 清理旧文件
for (const f of ["inject.js"]) {
  await fs.unlink(EXT + "/" + f).catch(() => { });
}
const files = await fs.readdir(EXT);
console.log("扩展文件:", files.join(", "));
