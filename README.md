# 白色蜂巢 WhiteHive

`WhiteHive` 是一个面向中国市场的线上交付协作与交易平台原型。它借鉴了 Fiverr 的“服务上架 + 平台交易”模式，但不是简单翻译一个国外产品，而是围绕中国团队和自由职业者的真实协作场景来设计：服务展示、需求确认、托管支付、阶段交付、验收修改、评价沉淀。

这一版先不追求生产可用，而是把最重要的 0 到 1 问题定下来：

- 我们卖的到底是什么：只做线上可交付结果，不碰线下到场服务。
- 平台先解决什么：撮合、信任、托管、交付、验收。
- 中国场景差异在哪里：实名认证、企业认证、微信/支付宝、发票、内容审核、争议处理。

## 这次已经搭好的内容

- 一个可运行的中文首页与市场原型
- 中国化定位、交易流程和 MVP 路线图
- 以零依赖 Python 服务提供的种子数据 API
- 可筛选的服务市场、需求墙、买家/自由职业者双视角工作台

## 启动

```bash
python3 server.py
```

然后打开 [http://127.0.0.1:8000](http://127.0.0.1:8000)。

如果 `8000` 端口已经被其他本地服务占用，可以这样启动：

```bash
PORT=8001 python3 server.py
```

## 当前 API

- `GET /api/health`
- `GET /api/bootstrap`
- `GET /api/gigs`
- `GET /api/briefs`
- `GET /api/workspace`
- `GET /api/roadmap`

其中 `GET /api/gigs` 支持这些查询参数：

- `search`
- `category`
- `delivery`
- `sort`

## 为什么第一版先做原型而不是直接上完整后端

从 0 开始做这类平台，最容易浪费时间的地方不是代码，而是范围失控。先做一个带交易模型的高保真原型，有几个好处：

- 能先验证“线上交付”这个切口是不是足够清晰
- 能先对齐买家、自由职业者、平台三方流程
- 能尽早发现中国市场必须补的能力，而不是后期返工
- 后续迁移到 Next.js、FastAPI、PostgreSQL 时，产品骨架已经稳定

## 我建议的开发顺序

1. 先把产品边界定死

- 只做线上可交付类服务
- 先做服务上架与购买，不先做开放竞标大广场
- 订单强制经过托管、里程碑和验收

2. 再做 MVP 的 4 个核心模块

- 用户与身份：买家、自由职业者、企业买家
- 服务市场：服务详情、套餐、筛选、搜索
- 订单交易：托管、里程碑、交付、验收、退款
- 站内协作：聊天、需求澄清、文件交付、修改记录

3. 最后补中国化能力

- 实名认证和企业认证
- 微信/支付宝/银行卡支付
- 发票申请
- 内容审核和争议仲裁

## 下一步最值得继续做的功能

- 用户注册 / 登录
- 自由职业者发布服务
- 买家创建订单
- 订单详情页与里程碑状态流转
- 上传文件与交付验收
- 平台托管和退款规则

## 目录说明

- [index.html](/Users/zhouyuhao/Documents/New%20project/index.html)
- [styles.css](/Users/zhouyuhao/Documents/New%20project/styles.css)
- [app.js](/Users/zhouyuhao/Documents/New%20project/app.js)
- [server.py](/Users/zhouyuhao/Documents/New%20project/server.py)
- 旧版获客工具备份在 [archive/client-radar](/Users/zhouyuhao/Documents/New%20project/archive/client-radar)
