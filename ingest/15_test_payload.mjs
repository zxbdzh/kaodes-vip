import fs from "node:fs/promises";

const catalog = JSON.parse(await fs.readFile("F:/github/kaodes_vip/data/catalog.json", "utf8"));
// 只保留 13003 一科做测试，减小注入体积
const test = {
  generatedAt: catalog.generatedAt,
  subjects: catalog.subjects.filter((s) => s.code === "13003"),
};

const code = `
(function(){
  const CATALOG = ${JSON.stringify(test)};
  const K_BJ = ["play","Bj","Sign","Secret"].join("");
  const K_PV = ["play","Sign","Secret"].join("");
  const API = "https://beegoapi.beeeeego.com/mobile";

  function getCookie(n){var m=document.cookie.match(new RegExp("(?:^|; )"+n+"=([^;]*)"));return m?decodeURIComponent(m[1]):""}
  function getUser(){try{return JSON.parse(getCookie("user"))}catch(e){return null}}

  window.__T = { steps: [], ok: false };

  async function doPlay(s, v){
    const token = getCookie("token");
    window.__T.steps.push("token:" + (token ? "yes" : "no"));
    const r = await fetch(API + "/special/playVideo", {
      method:"POST", credentials:"include",
      headers:{"content-type":"application/json",agencyId:"9922",platform:"Pc",token},
      body: JSON.stringify({vid:v.vid,cstId:Number(s.cstId),courseId:String(s.courseId),catId:String(v.catId),materialType:Number(v.materialType||1)})
    });
    const j = await r.json();
    window.__T.steps.push("playVideo:" + j.code);
    if(j.code!==200) return;

    // 解密（用页面已有的 JSEncrypt + 私钥）
    const PRIVATE_KEY = ${JSON.stringify((await fs.readFile("F:/github/kaodes_vip/data/rsa_private_key.pem","utf8")).replace(/\\n/g,"\n").trim())};
    const c = new window.JSEncrypt();
    c.setPrivateKey(PRIVATE_KEY);
    const bjToken = c.decrypt(j.data[K_BJ]);
    window.__T.steps.push("decrypt:" + (bjToken ? bjToken.length : "FAIL"));
    if(!bjToken) return;

    // 容器
    const holder = document.createElement("div");
    holder.id = "test-player";
    holder.style.cssText = "position:fixed;left:0;top:0;width:900px;height:520px;z-index:999999;background:#000";
    document.body.appendChild(holder);

    const u = getUser()||{};
    window.__player = new window.BPlayer({
      container: holder, memory:true, vid:v.vid, token:bjToken,
      autoplay:true, enableLoop:false, enableDrag:true, enableWaterMark:false, useFFplayerMSE:true,
      user:{name:u.userName||"u", number:String(u.userId||0)}
    });
    window.__T.steps.push("BPlayer:created");
  }

  window.__runTest = function(){
    const s = CATALOG.subjects[0];
    const v = s.videos[0];
    window.__T.steps.push("course:" + s.name + " vid:" + v.vid);
    return doPlay(s, v);
  };
  window.__T.steps.push("injected");
})();
`;

await fs.writeFile("F:/github/kaodes_vip/probes/test_ext_payload.js", code, "utf8");
console.log("测试载荷:", (code.length / 1024).toFixed(1), "KB");
