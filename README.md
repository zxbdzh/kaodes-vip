# 考得尚网校 · 自考计算机课程解锁器

面向 **计算机科学与技术（集美大学 080901）** 与 **软件工程（华侨大学 080902）** 两个自考专升本专业的课程资源工具。

包含两部分：Chrome 浏览器扩展（解锁全站课程视频 + 内置题库练习），以及配套的数据抓取流水线。

## 成果

| 指标 | 数值 |
| --- | --- |
| 覆盖科目 | 16 / 17 |
| 课程视频 | **758 讲** |
| 总时长 | **328 小时 27 分** |
| 题库 | **1903 题**（含答案与解析） |
| 试卷 | 35 份（真题 + 模拟） |
| 画质 | 1280×720 / 640×360 |

## 核心原理

考得尚是 Nuxt 前端 + `beegoapi.beeeeego.com` 后端。三个关键发现：

### 1. 播放接口不校验课程归属

`/special/playVideo` 只验证登录态，**不验证是否购买**。未购买课程的 `vid` 同样返回 200 与有效签名。

配套的 `/course/specialCatV2` 也能直接读到未购课完整目录 —— 只是前端页面在 `isHasBuy=0` 时不渲染。

### 2. 前端硬编码了 RSA 私钥

`_nuxt/7959ccc.js` 里：

```js
qr = {
  decrypt(e) {
    var t = new JSEncrypt;
    t.setPrivateKey("-----BEGIN RSA PRIVATE KEY-----\nMIICdgIBADAN...");
    return t.decrypt(e);
  },
  deTransPlaySign(e) {
    var t = e.split("&");
    return { sign: t[0], ts: t[1], playSafe: t[2] };
  }
}
```

`playVideo` 返回的两个字段用该私钥解密后即得：

- `{{SECRET_xxx}}` → 百家云 token
- `playSignSecret` → PolyV `sign&ts&playSafe`

### 3. 播放链路

```
POST /special/playVideo  {vid, cstId, courseId, catId, materialType}
  → RSA 解密得百家云 token
  → GET www.baijiayun.com/vod/video/getPlayUrl?vid=&token=
  → play_info.*.cdn_list[].enc_url   (bjcloudvod:// 私有协议)
  → 官方 BPlayer 内含 ev2-decrypt.wasm 解密 → MSE 播放
```

`enc_url` 是百家云私有加密协议，必须由官方播放器 WASM 解密，不能当普通 URL 用。所以扩展直接实例化 `window.BPlayer`。

## 安装扩展

1. 打开 `chrome://extensions/`（或 `edge://extensions/`）
2. 开启「开发者模式」
3. 点「加载已解压的扩展程序」，选 `extension/` 目录
4. 登录 kaodes.com，页面右下角出现绿色「K」按钮

## 使用

点右下角 **K** → 面板打开：

- **课程视频**：16 科目列表，展开选视频，点「播放」。未购买的课程同样可播。
- **题库练习**：选科目 → 章节练习 / 真题模拟 → 显示题目、选项、正确答案、解析。

`下一讲` 按钮连续播放，`Enter` 播放当前选中，`→` 下一讲。

## 题库现状

已抓取题库的两门课是**当前账号已购买**的：

| 科目 | 章节练习 | 真题/模拟 | 合计 |
| --- | --- | --- | --- |
| 15044 马克思主义基本原理 | 496 | 759（23 套） | 1255 |
| 15040 习近平新时代中国特色社会主义思想概论 | 276 | 372（12 套） | 648 |

**其余 14 门课的题库需要购买后才可抓取** —— 服务端在 `/course/practice` 和 `/mockExam/getExam` 处校验 `未开通该课程,请联系管理员！`，参数绕过（`isTry` / `isFree` / `isBuy` 等 10 种变体）均无效。视频接口则无此校验。

## 文件结构

```
extension/             Chrome 扩展（MV3）
  manifest.json
  background.js        Service Worker：RSA 解密 + 签发播放凭据
  content.js           注入面板：课程库 + 题库
  rsa.js               纯 JS RSAES-PKCS1-v1_5 解密（BigInt 实现）
  rsa.json             RSA 私钥参数（n/e/d/p/q/dp/dq/qinv）
  catalog.json         课程目录（16 科目 / 758 讲）
  bank.json            题库（1903 题 / 答案 / 解析）
  popup.html/js        工具栏弹窗

ingest/                数据抓取流水线
  01_collect.mjs       抓课程目录
  02_resolve.mjs       科目 → courseId 精确映射
  03_missing.mjs       补缺失科目
  04_issue.mjs         批量签发播放凭据（断点续传）
  05_report.mjs        生成报告
  06_player.mjs        生成独立播放器页面
  07_questions.mjs     抓试卷（真题/模拟）
  09_chapter_q.mjs     抓章节练习
  12_bank.mjs          合并去重成 bank.json

serve.mjs              独立本地播放器（不装扩展时用）
player.html            播放器界面
启动播放器.bat         一键启动本地播放器

data/
  rsa_private_key.pem  前端硬编码的 RSA 私钥
  课程库.md            科目对照表
```

## 关键技术细节

### 请求头必须带 `platform: Pc`

漏了这个头，所有写操作接口返回 `找不到请求来源！`：

```js
headers: {
  "content-type": "application/json",
  agencyId: "9922",
  platform: "Pc",     // 必需
  token: "<JWT>"
}
```

### CORS：`credentials: "include"` 会失败

`beegoapi` 返回 `Access-Control-Allow-Origin: *`，带凭据的请求被浏览器拒绝。改为 `omit`，手动传 token 头即可。

### 纯 JS RSA 解密

manifest 里 `world: "MAIN"` 注入拿不到页面的 `JSEncrypt`（Nuxt 内部模块，未挂 window）。WebCrypto 也不支持 PKCS#1 v1.5。

所以用 BigInt 自己实现，`rsa.js` 约 60 行，已验证与 Node `crypto.privateDecrypt` 输出完全一致。

### 题库接口参数

`/course/practice` 需要这些字段，缺一不可：

```json
{
  "catId": "10015414",
  "courseId": "25390",
  "cstId": 40201,
  "isRedo": 0,
  "lastPosition": 0,
  "linkName": "（23版习思想）导论>导论",
  "name": "导论",
  "scoringMethod": 1
}
```

`scoringMethod` 来自 `/course/chapter` 返回的叶子节点。

试卷则用 `/mockExam/getCourseOtherDate` 拿 `specialProjectId`（**不是 `simID`**），再调 `/mockExam/getMockExam?specialProjectId=`。

## 免责

仅供个人学习研究。所有请求都使用你自己的登录态，请遵守平台服务条款。

