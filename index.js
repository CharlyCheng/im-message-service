const Koa = require("koa");
const Router = require("koa-router");
const logger = require("koa-logger");
const bodyParser = require("koa-bodyparser");
const fs = require("fs");
const path = require("path");
const { init: initDB, Counter } = require("./db");
const axios = require('axios');
const qs = require('qs');
const crypto = require('crypto');

const router = new Router();

const homePage = fs.readFileSync(path.join(__dirname, "index.html"), "utf-8");


// 首页
router.get("/", async (ctx) => {
  ctx.body = homePage;
});

// 更新计数
router.post("/api/count", async (ctx) => {
  const { request } = ctx;
  const { action } = request.body;
  if (action === "inc") {
    await Counter.create();
  } else if (action === "clear") {
    await Counter.destroy({
      truncate: true,
    });
  }

  ctx.body = {
    code: 0,
    data: await Counter.count(),
  };
});

// 获取accessToken
const getAccessToken = async () => {
  const wxUrl = ' https://api.weixin.qq.com/cgi-bin/token?';

  const wxParams = {
    "grant_type": "client_credential",
    "appid": "wx9decb412f9fec6e1",
    "secret": "99867c73064dc2b494ddd0bd02ba0e21"
  }
  let wxRes = {};
  try {
    wxRes = await axios.post(`${wxUrl}${qs.stringify(wxParams)}`);
  } catch (err) {
    throw new Error('微信===>getAccessToken获取失败')
  }
  console.log('wxRes==>token', wxRes.data)
  return  wxRes.data;
}

// 获取qrcodeTicket
const getQrcodeTicket = async () => {
  const { access_token } = await getAccessToken();
  const wxUrl = `https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=${access_token}`;
  const wxParams = {
    "expire_seconds": 604800,
    "action_name": "QR_STR_SCENE",
    "action_info": {
        "scene": {
            "scene_id": "test"
        }
    }
  }
  let wxRes = {};
  try {
    wxRes = await axios.post(`${wxUrl}`, wxParams);
  } catch (err) {
    throw new Error('微信===>getQrcodeTicket获取失败')
  }
  console.log('wxRes==>ticket', wxRes.data)
  return  wxRes.data;
}

// 获取qrcode
const getQrcodeUrl = async () => {
  const { ticket } = await getQrcodeTicket();
  const wxUrl = `https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${encodeURIComponent(ticket)}`;
  let wxRes = {};
  try {
    wxRes = await axios.get(`${wxUrl}`, {
      responseType: "arraybuffer"
    });
  } catch (err) {
    throw new Error('微信===>getQrcodeUrl获取失败')
  }
  console.log('wxRes==>qrcodeUrl', wxRes.data)
  return  `data:iamge/png;base64,${Buffer.from(wxRes.data, "binary").toString("base64")}`;
}

// 微信Token消息验证
router.get("/api/wx/check_token", async (ctx) => {
  const token = "wx_check_token";
  const { signature, timestamp, echostr, nonce } = ctx.request.query
  const oriArr = [nonce, timestamp, token];
  const oriStr = oriArr.sort().join("");
  let sha1 = crypto.createHash("sha1").update(oriStr).digest("hex");
  console.log('sha1 !== signature', ctx.request.query)
  if (sha1 !== signature) {
    ctx.body = 'token验证失败';
  } else {
    ctx.body = echostr
  }
});

// 获取access_token
router.get("/api/wx/get_access_token", async (ctx) => {
  const wxRes = await getAccessToken();
  ctx.body = {
    code: 0,
    data: wxRes.data
  }
});

// 获取access_token
router.get("/api/wx/get_access_token", async (ctx) => {
  const wxRes = await getAccessToken();
  ctx.body = {
    code: 0,
    data: wxRes.data
  }
});

// 获取二维码的ticket
router.get("/api/wx/get_qrcode_ticket", async (ctx) => {
  const wxRes = await getQrcodeTicket();
  ctx.body = {
    code: 0,
    data: wxRes
  }
});

// 获取二维码的url
router.get("/api/wx/get_qrcode_url", async (ctx) => {
  const wxRes = await getQrcodeUrl();
  ctx.body = {
    code: 0,
    data: wxRes
  }
});

// 获取计数
router.get("/api/count", async (ctx) => {
  const result = await Counter.count();
  ctx.body = {
    code: 0,
    data: result,
  };
});

// 小程序调用，获取微信 Open ID
router.get("/api/wx_openid", async (ctx) => {
  if (ctx.request.headers["x-wx-source"]) {
    ctx.body = ctx.request.headers["x-wx-openid"];
  }
});

const app = new Koa();
app
  .use(logger())
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods());

const port = process.env.PORT || 80;
async function bootstrap() {
  await initDB();
  app.listen(port, () => {
    console.log("启动成功", port);
  });
}
bootstrap();
