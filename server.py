#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import socketserver
import urllib.parse
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path


ROOT = Path(__file__).resolve().parent
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))

STATIC_FILES = {
    "/": "index.html",
    "/index.html": "index.html",
    "/app.js": "app.js",
    "/styles.css": "styles.css",
    "/marketplace-data.json": "marketplace-data.json",
}

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
}

MARKETPLACE_DATA = {
    "brand": {
        "name": "白色蜂巢",
        "englishName": "WhiteHive",
        "tagline": "面向中国市场的线上交付协作与交易平台",
    },
    "hero": {
        "description": "WhiteHive 是一个面向中国市场的线上交付协作与交易平台，服务于企业、团队和自由职业者。它把开发、设计、AI 自动化、视频、PPT、翻译等远程服务整合到同一套流程里：服务上架、需求确认、托管支付、阶段交付、验收修改和评价沉淀。",
        "stats": [
            {"label": "优先服务类目", "value": "6 个"},
            {"label": "标准交易节点", "value": "5 步"},
            {"label": "常见交付形式", "value": "文件 / 链接 / 源码"},
            {"label": "基础信任能力", "value": "实名 / 支付 / 发票"},
        ],
        "pillars": [
            "聚焦可远程交付服务",
            "服务像产品一样标准化上架",
            "默认支持托管与阶段验收",
            "买卖双方在订单里完整留痕",
        ],
        "flowPreview": [
            {"title": "服务上架", "copy": "用清晰的服务说明、价格和交付物替代模糊报价。"},
            {"title": "托管下单", "copy": "买家付款后再启动执行，让双方都有安全感。"},
            {"title": "交付验收", "copy": "文件、源码、链接和素材都在站内留痕，可追踪、可复盘。"},
        ],
    },
    "insights": [
        {
            "title": "中国不缺自由职业者，缺的是标准化交易方式",
            "copy": "今天很多线上项目仍然靠微信、群聊和熟人介绍完成，信息分散、付款无保障、交付难留痕，这正是平台可以补上的地方。",
        },
        {
            "title": "第一阶段适合从远程可交付服务切入",
            "copy": "开发、设计、AI 自动化、视频、PPT、翻译等服务边界更清晰，也更容易做成标准套餐、交付清单和评价体系。",
        },
        {
            "title": "WhiteHive 先做服务市场，再承接定制需求",
            "copy": "先让服务像商品一样被理解和购买，再用需求墙承接复杂项目，会比一开始就做开放竞标更容易建立信任和复购。",
        },
        {
            "title": "中国化能力必须从底层一起设计",
            "copy": "实名认证、企业认证、微信或支付宝、发票和争议处理，不是后补功能，而是影响整条交易链路的基础设施。",
        },
    ],
    "categories": [
        {
            "id": "ai-automation",
            "label": "AI 自动化",
            "description": "表单流转、客服知识库、内容生产、Agent 流程。",
            "averagePrice": "客单价 ¥1,500 - ¥8,000",
        },
        {
            "id": "web-dev",
            "label": "网站与前端",
            "description": "企业官网、活动页、SaaS 落地页、前端重构。",
            "averagePrice": "客单价 ¥2,000 - ¥20,000",
        },
        {
            "id": "branding",
            "label": "品牌与设计",
            "description": "品牌视觉、详情页、Banner、社媒视觉包。",
            "averagePrice": "客单价 ¥800 - ¥6,000",
        },
        {
            "id": "video-editing",
            "label": "视频剪辑",
            "description": "口播剪辑、短视频包装、B 站 / 抖音内容。",
            "averagePrice": "客单价 ¥500 - ¥4,000",
        },
        {
            "id": "deck-copy",
            "label": "PPT 与文案",
            "description": "商业计划书、路演稿、官网文案、品牌故事。",
            "averagePrice": "客单价 ¥800 - ¥5,000",
        },
        {
            "id": "translation",
            "label": "翻译与本地化",
            "description": "官网、APP、营销内容的中英双语交付。",
            "averagePrice": "客单价 ¥300 - ¥3,000",
        },
    ],
    "filters": {
        "delivery": [
            {"value": "three-days", "label": "3 天内"},
            {"value": "one-week", "label": "1 周内"},
            {"value": "two-weeks", "label": "2 周内"},
        ],
        "sort": [
            {"value": "recommended", "label": "推荐优先"},
            {"value": "price-asc", "label": "价格从低到高"},
            {"value": "delivery-asc", "label": "交付速度优先"},
            {"value": "rating-desc", "label": "评分优先"},
        ],
    },
    "gigs": [
        {
            "id": "gig-ai-agent",
            "category": "ai-automation",
            "categoryLabel": "AI 自动化",
            "title": "为团队搭建 AI 客服与表单流转自动化",
            "seller": "季安 · 自动化顾问",
            "city": "杭州",
            "rating": "4.9 / 5",
            "level": "平台认证交付者",
            "completed": "已完成 83 单",
            "summary": "适合客服、线索筛选、FAQ、内部审批等线上流程改造。",
            "detail": "把聊天、表单、知识库和通知工具串起来，交付流程图、可运行节点、提示词模板和交接说明，适合中小团队快速试点。",
            "priceFrom": "¥1,999",
            "deliveryWindow": "5 天",
            "deliveryDays": 5,
            "bestFor": "线索流转",
            "featuredLabel": "热门试点",
            "featuredRank": 95,
            "tags": ["企业效率", "客服自动化", "知识库", "Agent"],
            "deliverables": ["流程架构图", "自动化配置", "提示词模板", "交接文档"],
            "packages": [
                {"name": "Starter", "price": "¥1,999", "note": "单一流程试点，最多 3 个节点。"},
                {"name": "Growth", "price": "¥3,999", "note": "多节点流程，可接入企业微信或飞书。"},
                {"name": "Ops", "price": "¥7,499", "note": "含监控、容错和团队培训。"},
            ],
            "trustBadges": ["托管付款", "需求确认单", "两轮修改", "交接文档"],
            "whyNow": "AI 自动化是高感知价值服务，买家容易理解投入产出，也适合平台沉淀标准模板和复购关系。",
        },
        {
            "id": "gig-saas-landing",
            "category": "web-dev",
            "categoryLabel": "网站与前端",
            "title": "设计并开发一个高转化 SaaS 官网落地页",
            "seller": "林策 · 独立前端设计师",
            "city": "深圳",
            "rating": "5.0 / 5",
            "level": "Top rated",
            "completed": "已完成 46 单",
            "summary": "从信息架构、视觉风格到前端上线，适合新品发布和获客页面。",
            "detail": "交付页面结构、视觉样式、响应式前端页面以及基础埋点建议，可选 Figma + 源码双交付。",
            "priceFrom": "¥3,600",
            "deliveryWindow": "7 天",
            "deliveryDays": 7,
            "bestFor": "产品发布",
            "featuredLabel": "转化优先",
            "featuredRank": 93,
            "tags": ["SaaS", "落地页", "前端开发", "响应式"],
            "deliverables": ["页面原型", "视觉稿", "前端源码", "埋点建议"],
            "packages": [
                {"name": "Starter", "price": "¥3,600", "note": "单页落地页，含基础动画。"},
                {"name": "Growth", "price": "¥6,800", "note": "3-5 个版块，含埋点与表单。"},
                {"name": "Scale", "price": "¥12,000", "note": "完整官网首页方案，含 SEO 结构。"},
            ],
            "trustBadges": ["源码交付", "里程碑拆单", "验收清单", "售后 7 天"],
            "whyNow": "官网开发是平台的基础类目，边界清晰、案例可展示，也容易在站内形成复购和升级套餐。",
        },
        {
            "id": "gig-brand-system",
            "category": "branding",
            "categoryLabel": "品牌与设计",
            "title": "输出品牌视觉基线与电商详情页设计包",
            "seller": "宋未 · 品牌视觉设计师",
            "city": "上海",
            "rating": "4.8 / 5",
            "level": "企业项目经验",
            "completed": "已完成 119 单",
            "summary": "适合新品牌冷启动、电商详情页优化和社媒视觉统一。",
            "detail": "用统一的视觉基线整理品牌色、字体、详情页结构和素材规范，支持电商详情页长图、主图与社媒物料联动交付。",
            "priceFrom": "¥1,280",
            "deliveryWindow": "4 天",
            "deliveryDays": 4,
            "bestFor": "品牌冷启",
            "featuredLabel": "复购高",
            "featuredRank": 89,
            "tags": ["品牌视觉", "详情页", "社媒素材", "电商设计"],
            "deliverables": ["视觉规范", "详情页设计稿", "可编辑源文件", "导出素材包"],
            "packages": [
                {"name": "Starter", "price": "¥1,280", "note": "基础品牌板与主 KV。"},
                {"name": "Growth", "price": "¥2,680", "note": "详情页 + 社媒素材。"},
                {"name": "Studio", "price": "¥5,200", "note": "完整品牌视觉包，适合首发。"},
            ],
            "trustBadges": ["源文件交付", "品牌清单", "一次加急", "风格确认"],
            "whyNow": "设计服务标准化程度高，最容易跑通上架、评价和推荐系统，是平台初期很好的供给入口。",
        },
        {
            "id": "gig-video-growth",
            "category": "video-editing",
            "categoryLabel": "视频剪辑",
            "title": "剪一套适合抖音 / 视频号的转化短视频素材",
            "seller": "周北 · 内容剪辑师",
            "city": "成都",
            "rating": "4.9 / 5",
            "level": "高频复购卖家",
            "completed": "已完成 204 单",
            "summary": "适合口播剪辑、投流素材、产品演示和信息流试投。",
            "detail": "按脚本或原始素材输出成片、封面、字幕规范和适配比例，支持多个渠道版本切分。",
            "priceFrom": "¥699",
            "deliveryWindow": "3 天",
            "deliveryDays": 3,
            "bestFor": "投流试水",
            "featuredLabel": "交付快",
            "featuredRank": 87,
            "tags": ["抖音", "视频号", "素材剪辑", "投流"],
            "deliverables": ["成片文件", "字幕稿", "封面图", "版本适配清单"],
            "packages": [
                {"name": "Starter", "price": "¥699", "note": "1 条 30 秒成片。"},
                {"name": "Growth", "price": "¥1,599", "note": "3 条多版本内容。"},
                {"name": "Campaign", "price": "¥3,299", "note": "一组测试素材与封面。"},
            ],
            "trustBadges": ["样片确认", "修改次数", "版权说明", "平台交付留痕"],
            "whyNow": "视频剪辑是最容易形成高频复购的线上服务类目之一，适合平台在早期建立订单密度和活跃度。",
        },
        {
            "id": "gig-deck-story",
            "category": "deck-copy",
            "categoryLabel": "PPT 与文案",
            "title": "把商业计划写成一版可讲的路演 deck",
            "seller": "沈听 · 商业叙事顾问",
            "city": "北京",
            "rating": "4.9 / 5",
            "level": "融资项目经验",
            "completed": "已完成 37 单",
            "summary": "适合融资、汇报、方案提案、销售 deck 和业务复盘。",
            "detail": "不只是排版，而是帮你理清逻辑、重写叙事、规范视觉层级，并产出可直接演示的 PPT 文件。",
            "priceFrom": "¥1,500",
            "deliveryWindow": "6 天",
            "deliveryDays": 6,
            "bestFor": "方案提案",
            "featuredLabel": "高客单",
            "featuredRank": 86,
            "tags": ["商业计划书", "PPT", "提案", "叙事结构"],
            "deliverables": ["演示文稿", "讲述备注", "视觉模板", "导出 PDF"],
            "packages": [
                {"name": "Starter", "price": "¥1,500", "note": "10 页以内梳理与排版。"},
                {"name": "Growth", "price": "¥3,200", "note": "完整 deck 重构与讲稿。"},
                {"name": "Investor", "price": "¥5,500", "note": "融资级叙事和图表优化。"},
            ],
            "trustBadges": ["内容保密", "版本留痕", "结构确认", "导出格式"],
            "whyNow": "PPT 与商业文案是典型的线上交付物，容易定义交付边界，也适合作为企业买家进入平台的第一笔交易。",
        },
        {
            "id": "gig-localization",
            "category": "translation",
            "categoryLabel": "翻译与本地化",
            "title": "完成官网和产品说明的中英双语本地化",
            "seller": "程诺 · 本地化顾问",
            "city": "广州",
            "rating": "4.8 / 5",
            "level": "双语交付认证",
            "completed": "已完成 64 单",
            "summary": "适合出海产品、海外宣传、双语官网和海外售卖页面。",
            "detail": "除逐句翻译外，还会按目标市场调整措辞、语气、结构和转化表达，适合官网、着陆页和产品说明文档。",
            "priceFrom": "¥420",
            "deliveryWindow": "2 天",
            "deliveryDays": 2,
            "bestFor": "出海页面",
            "featuredLabel": "上线刚需",
            "featuredRank": 84,
            "tags": ["中英翻译", "本地化", "官网", "出海"],
            "deliverables": ["译文文件", "术语表", "风格说明", "疑问清单"],
            "packages": [
                {"name": "Starter", "price": "¥420", "note": "1000 字以内。"},
                {"name": "Growth", "price": "¥1,200", "note": "官网主页面与 CTA 优化。"},
                {"name": "Launch", "price": "¥2,800", "note": "完整站点核心页面本地化。"},
            ],
            "trustBadges": ["版本对照", "术语统一", "交付快", "可复用术语表"],
            "whyNow": "翻译与本地化服务低门槛、高频、强线上属性，适合作为平台的长尾供给基础层。",
        },
    ],
    "briefs": [
        {
            "title": "SaaS 官网首页重做，偏产品叙事",
            "summary": "希望在 10 天内完成信息结构、主视觉和首页前端开发，先做首页，后续再扩展定价页和案例页。",
            "budget": "预算 ¥8,000",
            "deadline": "10 天内",
            "mode": "线上交付",
            "stage": "待报价",
            "tags": ["官网改版", "SaaS", "前端", "视觉"],
        },
        {
            "title": "AI 客服 FAQ 流程试点",
            "summary": "目标是先把售前常见问题自动应答起来，并保留人工接管节点，需要完整的流程说明和交接文档。",
            "budget": "预算 ¥5,000",
            "deadline": "7 天内",
            "mode": "线上交付",
            "stage": "需求澄清",
            "tags": ["AI 自动化", "知识库", "客服"],
        },
        {
            "title": "新品详情页和 6 条视频素材联动",
            "summary": "品牌首发阶段，需要详情页设计、卖点整理和多条短视频剪辑，适合电商冷启动项目。",
            "budget": "预算 ¥6,500",
            "deadline": "2 周内",
            "mode": "线上交付",
            "stage": "正在匹配",
            "tags": ["品牌首发", "详情页", "视频剪辑"],
        },
    ],
    "workspaces": {
        "buyer": {
            "label": "买家视角",
            "tabSummary": "看需求、订单状态和验收节点。",
            "title": "买家在 WhiteHive 上看到的，不只是服务列表，而是一条完整的交付进度",
            "summary": "买家需要清楚知道：需求是否确认、资金是否托管、当前在交付哪一阶段、还有哪些内容待验收。平台的价值，是让每一步都可追踪。",
            "metrics": [
                {"label": "进行中订单", "value": "4", "note": "全部是线上交付物，可按里程碑跟踪。"},
                {"label": "待验收节点", "value": "2", "note": "页面原型和剪辑素材都在等待确认。"},
                {"label": "平均交付周期", "value": "5.8 天", "note": "标准化服务能显著降低延期概率。"},
            ],
            "checklist": [
                "发布需求前，先明确你想拿到的文件、链接、源码或素材格式。",
                "高客单项目先拆成里程碑，不要一次性交付全部范围。",
                "验收页面类服务时，必须对照交付清单而不是只看视觉感受。",
                "需要走发票、合同或企业认证的订单，要在下单前就锁定流程。",
            ],
            "orders": [
                {
                    "title": "SaaS 首页改版",
                    "counterparty": "合作方：林策 · 前端设计师",
                    "stage": "等待首页确认",
                    "copy": "第一阶段已经提交 Figma 原型和页面结构建议。确认方向后，就会进入前端开发和交付排期。",
                    "amount": "订单金额 ¥6,800",
                    "deadline": "剩余 3 天",
                },
                {
                    "title": "AI FAQ 试点",
                    "counterparty": "合作方：季安 · 自动化顾问",
                    "stage": "托管已完成",
                    "copy": "需求已经确认，款项也已托管。当前正在搭建知识库、自动应答逻辑和人工接管流程。",
                    "amount": "订单金额 ¥3,999",
                    "deadline": "剩余 4 天",
                },
            ],
        },
        "freelancer": {
            "label": "自由职业者视角",
            "tabSummary": "看服务、交付、复购和资金节奏。",
            "title": "自由职业者在 WhiteHive 上经营的，不只是个人资料，而是一套可复制的服务产品",
            "summary": "平台要帮助自由职业者把报价、范围、修改次数、交付格式和复购路径标准化，让成交更稳定、沟通成本更低。",
            "metrics": [
                {"label": "近 30 天询盘", "value": "28", "note": "标准化套餐比纯竞标更稳定。"},
                {"label": "准时交付率", "value": "96%", "note": "交付边界清晰后，延期会明显减少。"},
                {"label": "复购率", "value": "31%", "note": "视频剪辑、设计、自动化类目复购表现更好。"},
            ],
            "checklist": [
                "每个服务都要写清楚包含什么、不包含什么，避免范围无限扩张。",
                "报价时把修改次数、交付格式和里程碑写进订单。",
                "大单优先做需求确认单，小单优先走标准套餐。",
                "完成交付后要沉淀模板、术语表或脚本，形成自己的复用资产。",
            ],
            "orders": [
                {
                    "title": "品牌详情页首发包",
                    "counterparty": "买家：某消费品牌",
                    "stage": "待买家二次反馈",
                    "copy": "主视觉和详情页长图已经交付，当前在等买家确认文案和素材替换，再进入最终导出。",
                    "amount": "订单金额 ¥2,680",
                    "deadline": "预计明日验收",
                },
                {
                    "title": "视频投流测试素材",
                    "counterparty": "买家：某教育 SaaS",
                    "stage": "第 1 批成片已交付",
                    "copy": "已经上传 3 条不同比例的视频和封面图，买家会根据投放数据决定是否继续追加第二批素材。",
                    "amount": "订单金额 ¥1,599",
                    "deadline": "可申请尾款",
                },
            ],
        },
    },
    "flow": [
        {
            "step": "01",
            "title": "需求澄清",
            "copy": "买家先确认目标、交付物、修改次数和时间节点，平台据此生成标准需求确认单。",
            "riskControl": "防止范围失控",
        },
        {
            "step": "02",
            "title": "托管支付",
            "copy": "订单创建后，买家先把款项托管到平台，再进入正式执行阶段。",
            "riskControl": "防止先做后赖账",
        },
        {
            "step": "03",
            "title": "阶段性交付",
            "copy": "平台支持文件、源代码、Figma 链接、视频文件、文档和素材包等线上成果物。",
            "riskControl": "过程留痕",
        },
        {
            "step": "04",
            "title": "验收与修改",
            "copy": "买家需要在约定时间内确认交付或提出修改，避免订单长期挂起。",
            "riskControl": "明确修改窗口",
        },
        {
            "step": "05",
            "title": "结算与评价",
            "copy": "尾款释放后形成公开评价；如果产生争议，订单再进入平台仲裁。",
            "riskControl": "沉淀信用体系",
        },
    ],
    "roadmap": [
        {
            "phase": "Phase 01",
            "title": "先把产品边界讲清楚",
            "copy": "先用可运行原型说明 WhiteHive 卖什么、服务谁，以及交易如何发生。",
            "items": ["品牌定位", "服务市场原型", "需求墙", "交易链路说明"],
        },
        {
            "phase": "Phase 02",
            "title": "打通下单与交付基础能力",
            "copy": "让用户、服务、订单、里程碑、文件交付和站内消息真正跑通。",
            "items": ["注册登录", "订单系统", "里程碑", "文件交付"],
        },
        {
            "phase": "Phase 03",
            "title": "补齐信任与支付基础设施",
            "copy": "把实名、企业认证、支付、发票、仲裁和内容审核纳入平台底层模型。",
            "items": ["实名认证", "企业认证", "发票", "争议处理"],
        },
        {
            "phase": "Phase 04",
            "title": "再做增长、推荐与复购",
            "copy": "当订单和评价积累起来后，再补排序、推荐、会员和复购机制。",
            "items": ["推荐排序", "复购激励", "商家等级", "内容增长"],
        },
    ],
    "defaultRole": "buyer",
}


def build_bootstrap() -> dict[str, object]:
    return {
        "brand": MARKETPLACE_DATA["brand"],
        "hero": MARKETPLACE_DATA["hero"],
        "insights": MARKETPLACE_DATA["insights"],
        "categories": MARKETPLACE_DATA["categories"],
        "filters": MARKETPLACE_DATA["filters"],
        "briefs": MARKETPLACE_DATA["briefs"],
        "workspaces": MARKETPLACE_DATA["workspaces"],
        "flow": MARKETPLACE_DATA["flow"],
        "roadmap": MARKETPLACE_DATA["roadmap"],
        "defaultRole": MARKETPLACE_DATA["defaultRole"],
    }


def normalize_text(raw_value: str) -> str:
    return (raw_value or "").strip().lower()


def match_delivery(gig: dict[str, object], delivery: str) -> bool:
    if delivery == "all":
        return True

    days = int(gig.get("deliveryDays") or 0)
    if delivery == "three-days":
        return days <= 3
    if delivery == "one-week":
        return days <= 7
    if delivery == "two-weeks":
        return days <= 14
    return True


def filter_gigs(query: dict[str, list[str]]) -> list[dict[str, object]]:
    search = normalize_text(query.get("search", [""])[0])
    category = normalize_text(query.get("category", ["all"])[0]) or "all"
    delivery = normalize_text(query.get("delivery", ["all"])[0]) or "all"
    sort = normalize_text(query.get("sort", ["recommended"])[0]) or "recommended"

    items = list(MARKETPLACE_DATA["gigs"])

    if category != "all":
        items = [item for item in items if item.get("category") == category]

    if search:
        filtered: list[dict[str, object]] = []
        for item in items:
            haystack = " ".join(
                [
                    str(item.get("title") or ""),
                    str(item.get("summary") or ""),
                    str(item.get("detail") or ""),
                    " ".join(str(tag) for tag in item.get("tags") or []),
                ]
            ).lower()
            if search in haystack:
                filtered.append(item)
        items = filtered

    items = [item for item in items if match_delivery(item, delivery)]

    if sort == "price-asc":
        items.sort(key=lambda item: parse_money(str(item.get("priceFrom") or "")))
    elif sort == "delivery-asc":
        items.sort(key=lambda item: int(item.get("deliveryDays") or 999))
    elif sort == "rating-desc":
        items.sort(key=lambda item: parse_rating(str(item.get("rating") or "")), reverse=True)
    else:
        items.sort(key=lambda item: int(item.get("featuredRank") or 0), reverse=True)

    return items


def parse_money(text: str) -> int:
    digits = "".join(ch for ch in text if ch.isdigit())
    return int(digits) if digits else 0


def parse_rating(text: str) -> float:
    head = text.split("/", 1)[0].strip()
    try:
        return float(head)
    except ValueError:
        return 0.0


def load_file(path: Path) -> bytes:
    return path.read_bytes()


class MarketplaceHandler(BaseHTTPRequestHandler):
    server_version = "WhiteHivePrototype/1.0"

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/api/health":
            self.respond_json({"ok": True, "service": "jiangdan-prototype"})
            return

        if parsed.path == "/api/bootstrap":
            self.respond_json(build_bootstrap())
            return

        if parsed.path == "/api/gigs":
            query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
            self.respond_json({"items": filter_gigs(query)})
            return

        if parsed.path == "/api/briefs":
            self.respond_json({"items": MARKETPLACE_DATA["briefs"]})
            return

        if parsed.path == "/api/workspace":
            self.respond_json({"items": MARKETPLACE_DATA["workspaces"]})
            return

        if parsed.path == "/api/roadmap":
            self.respond_json({"items": MARKETPLACE_DATA["roadmap"]})
            return

        self.serve_static(parsed.path)

    def serve_static(self, raw_path: str) -> None:
        path_key = raw_path if raw_path in STATIC_FILES else "/"
        target = ROOT / STATIC_FILES[path_key]

        if not target.exists():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return

        data = load_file(target)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", CONTENT_TYPES.get(target.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def respond_json(self, payload: object, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", CONTENT_TYPES[".json"])
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        return


class ThreadingHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True


def run() -> None:
    with ThreadingHTTPServer((HOST, PORT), MarketplaceHandler) as httpd:
        print(f"WhiteHive prototype running at http://{HOST}:{PORT}")
        httpd.serve_forever()


if __name__ == "__main__":
    run()
