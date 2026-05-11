# IELTS Reading Tool WebApp MVP 配置说明

这版在原静态网页基础上加入了云端账号、云端项目保存和跨浏览器恢复。

## 你已经完成的配置

当前版本已经把 Supabase Project URL 和 publishable/anon key 写入 `script.js` 顶部。普通用户不需要填写 Supabase 配置。

内置配置：

- Supabase URL: `https://aupmmuwgwqrrfeuqgmrj.supabase.co`
- Key 类型: `sb_publishable` / publishable key

注意：只能把 publishable/anon key 放进前端，绝对不要把 `service_role`、`secret key` 或 `sb_secret_xxx` 放进前端。

## 你还需要确认什么

1. Supabase 里已经执行过 `supabase-schema.sql`。
2. `reading_projects` 表已经存在。
3. RLS 已开启。
4. Email 登录可用。
5. 测试阶段可关闭邮箱确认。

## 普通用户使用流程

1. 打开网站。
2. 点击「登录 / 注册」。
3. 输入邮箱和密码。
4. 注册或登录。
5. 导入阅读材料。
6. 标注 A/S/D。
7. 点击「云端保存」。
8. 在另一个浏览器登录同一账号。
9. 打开「我的项目」恢复历史项目。

## 当前保存内容

- Passage 原文区 HTML
- Questions 题干区 HTML
- A 主干句高亮
- S 修饰句高亮
- D 词块论证标签
- 生词本
- 当前题目结构数据
- 逻辑连线的起点、终点和标签
- 字体大小与行距设置

## 当前版本定位

这还是 WebApp MVP，不是完整生产级 SaaS。现在用 `reading_projects.app_state` 整体保存状态，便于先跑通登录、保存、恢复闭环。

后续如果要做统计、AI 报告、错题分析，需要继续拆表：`annotations / vocabulary / answers / sessions`。
