# IELTS Reading Tool WebApp MVP 配置说明

这版在原静态网页基础上加入了 Supabase 登录与云端项目保存。

## 你需要配置什么

1. 注册 Supabase，创建一个 Project。
2. 进入 `SQL Editor`，执行 `supabase-schema.sql`。
3. 在 Supabase 后台找到：
   - Project URL
   - anon public key
4. 打开网页，点击「登录 / 云端同步」，把这两个配置填进去。
5. 注册 / 登录邮箱账号。
6. 导入阅读材料，标注 A/S/D，然后点击「云端保存」。
7. 点击「我的项目」可以恢复历史项目。

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

## 注意

- 这还是 WebApp MVP，不是完整生产级 SaaS。
- 现在用 `reading_projects.app_state` 整体保存状态，便于先跑通闭环。
- 后续如果要做统计、AI 报告、错题分析，需要继续拆表：annotations / vocabulary / answers / sessions。
- 绝对不要把 Supabase `service_role key` 放进前端，只能使用 `anon public key`。
