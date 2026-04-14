# WhiteHive Frontend

`WhiteHive` 是一个面向中国市场的线上数字服务交易平台前端原型，当前版本聚焦官网展示、服务分类、可信机制、交易流程和品牌叙事。

线上访问地址：

- [https://whitehive.cn](https://whitehive.cn)
- [https://www.whitehive.cn](https://www.whitehive.cn)

## 技术栈

- React 18
- Vite 5
- Tailwind CSS
- Framer Motion
- React Router

## 本地开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

本地预览地址通常为：

```text
http://127.0.0.1:5173
```

## 生产构建

```bash
npm run build
```

Vite 会输出静态产物到 `dist/`，当前 Vercel 项目会直接部署该产物。

## 目录结构

```text
.
├── index.html
├── package.json
├── public/
│   ├── favicon.svg
│   └── og-cover.svg
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── components/
│   ├── data/
│   └── pages/
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── vercel.json
```

## 页面

- `/` 首页
- `/services` 服务分类
- `/trust` 可信机制
- `/how-it-works` 交易流程
- `/about` 关于我们

## 部署说明

当前线上部署链路已经绑定到现有 Vercel 项目和 `whitehive.cn` 域名。

发布方式：

1. 本地提交代码
2. 推送到当前已绑定的 Git 仓库分支
3. Vercel 自动触发重新部署

`vercel.json` 已包含 SPA 路由重写配置，确保 `react-router-dom` 的子路由在生产环境不会 404。
