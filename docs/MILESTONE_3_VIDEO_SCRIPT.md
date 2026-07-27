# RallyPoint — Milestone 3 演示视频脚本（前后端集成 / Frontend & Backend Integration）

*总时长约 9:00 ｜ 英文口播约 1,360 词 ｜ 覆盖：API Integration /30 · Functional UI /20 · DB Interaction via Front-End /20 · Testing & Debugging /20 · Code Quality /10 ｜ 本里程碑 = ACIS 498 Milestone 3 全栈集成（React 19 + TS ↔ Flask REST ↔ PostgreSQL）｜ 全程真实代码与真实运行结果，无夸大 ｜ 数字均已实测核对：60 endpoints · 17 tables · 124 + 7 tests · 56 merged PRs*

---

## 开场 OPENING ｜ 0:00–0:40

**【画面】** 浏览器打开 **https://app.tryrallypoint.com** 的 Find Partner 页（已登录、有真实匹配卡片）；标签栏可见另一个标签停在 GitHub 仓库。
> 「念」 Hi, I'm Phoebe. This is Milestone 3 of my capstone, RallyPoint — an AI-powered partner-matching app for everyday tennis and pickleball players on Chicago's public courts. Milestone 1 was the React front end; Milestone 2 was the Flask REST API and its seventeen-table database. Today is the integration: proof that they run as one system — and not just locally. What you're looking at is the production deployment, live on the internet.

**【画面】** 短暂切到 VS Code，`frontend/src/api/` 目录树一屏可见。
> 「念」 The plan: how the integration layer works, then a live demo where every click is traced to a REST call and a database change, then the tests, and the real integration bugs I hit between the two layers — and how I fixed them.

*（约 125 词）*

---

## 集成架构 INTEGRATION ARCHITECTURE ｜ 0:40–2:00 ｜ /30 ⭐

**【画面】** 打开 `frontend/src/api/client.ts`，从顶部注释慢慢滚到 `api<T>()` 函数。
> 「念」 Every one of the sixty backend endpoints is called through this single function. It centralizes everything the integration needs: the base URL comes from an environment variable — same code runs against localhost in dev and the production API. Auth is a JWT in an httpOnly cookie, so JavaScript never touches the token; every request sends credentials, and unsafe methods echo a CSRF token — the double-submit defense. Errors become a typed ApiError, a 401 broadcasts a session-expired event that signs the user out everywhere, and there's even handling for the API waking up from sleep — more on that in the issues section.

**【画面】** 快速掠过 `api/invites.ts`（类型化的请求/响应）→ `hooks/useInvites.ts`（`useMutation` + invalidate）→ `contexts/AuthContext.tsx`（mount 时调 `/auth/me`）。
> 「念」 On top of it sit nine typed API modules — the TypeScript types mirror the backend contract, so if the backend changes shape, the frontend fails its typecheck in CI instead of failing in production. TanStack Query hooks handle caching and — crucially — invalidation: after any mutation the affected queries refetch from the database, so the screen always shows database truth. And the auth context hydrates the session by calling /auth/me on mount.

**【画面】** 打开 `milestone3/MILESTONE_3_INTEGRATION.md` 的 page → endpoint → table 大表，整表停 3 秒。
> 「念」 The full map — every page, every endpoint it calls, every table behind it — is in the milestone-three folder in the repo.

*（约 230 词）*

---

## 实时演示 1 ｜ 登录与持久化 AUTH + PERSISTENCE ｜ 2:00–3:40 ｜ /30 + /20 ⭐⭐

**【画面】** 回到浏览器，F12 打开 DevTools **Network 面板**（筛选 Fetch/XHR），从登录页开始。整个演示期间 Network 面板保持可见。
> 「念」 Now the live demo. I'm keeping the network panel open the whole time, so you can watch the actual REST traffic between the deployed front end and the deployed API.

**【画面】** 登录 → 点中 Network 里的 `login` 请求，指 Response 的 user JSON 和 Headers 里的 `Set-Cookie`。
> 「念」 Logging in fires POST /api/auth/login. The response carries the user object, and the session arrives as an httpOnly cookie — you can see the Set-Cookie header, but no script on this page can read that token.

**【画面】** 硬刷新页面，指 Network 里的 `me` 请求。
> 「念」 On a hard reload the app boots from nothing and calls /auth/me — the cookie proves who I am, and the session rehydrates. No local storage tricks.

**【画面】** 进 Profile：改一段 bio、在 weekly grid 上勾/取消几个时段 → 保存，指 `PATCH me` 请求 → **再硬刷新一次**，改动仍在。
> 「念」 Here's the database-interaction requirement in one gesture: I edit my bio and my weekly availability, save — that's a PATCH — then hard-reload again. The changes are still there, because they were written to PostgreSQL and read back through the API. Nothing on this screen is hard-coded; delete the API and this app is an empty shell.

**【画面】** 上传头像 → 指 `PUT /auth/me/photo` 请求，然后指头像 `<img>` 的新请求 `photo?v=…`。
> 「念」 A photo upload stores the image itself as a database row, and the avatar reloads with a version-stamped URL — that little v-parameter is a cache-buster, and it has a bug story behind it for later.

*（约 250 词）*

---

## 实时演示 2 ｜ 双账号完整闭环 THE FULL LOOP ｜ 3:40–5:40 ｜ /20 ⭐⭐⭐ 核心段

**【画面】** 并排开第二个窗口（隐身模式）登录第二个账号。左窗口 = 账号 A（自己），右窗口 = 账号 B。
> 「念」 The best proof that front end, API, and database are one system: two browsers, two accounts, one database between them.

**【画面】** 账号 A 的 Find Partner 页：指一张匹配卡的分数与 reason chips；Network 面板指 `players` 请求的 JSON。
> 「念」 Account A asks for partners. GET /api/players runs the matching engine server-side — skill closeness, schedule overlap from that grid I just edited, real court distance — and every score comes back with human-readable reason chips. This list is computed fresh from the database on every request.

**【画面】** A 给 B 的卡片点心形收藏（指 `save` 请求）；然后点 Request to play → 选球场 + 勾两个候选时间 → 发送，指 `POST /invites` 的 201 响应。
> 「念」 I save this player — one POST, one row. Then I invite them to play: pick a court, propose two times, send. That's a POST to /api/invites — a new invite row plus its time-proposal rows.

**【画面】** 切到右窗口（账号 B）：Sessions 页刷新出现邀请 → B 确认对手 → 选中一个时间接受，指 `accept-time` 请求和响应里的 `session`。
> 「念」 Account B — a different browser, a different session cookie — sees that invite instantly, because it reads the same database through the same API. B accepts one of the proposed times, and watch the response: the system materializes a real session row.

**【画面】** 左右窗口各自刷新 Sessions 页，同一场 session 出现在两边的时间线上。
> 「念」 And now the same confirmed session appears on both timelines — two front ends, one source of truth. That's the two-phase invite flow from Milestone 2's schema, now driven entirely through the UI.

*（约 250 词）*

---

## 功能界面速览 UI TOUR ｜ 5:40–6:40 ｜ /20

**【画面】** Courts 页：滚动按距离排序的球场列表 → 收藏一个 → 进球场详情 → check in（指 `checkin` 请求）。
> 「念」 Quickly around the rest of the interface — all of it API-backed. Courts, sorted by real distance from my neighborhood; favorites; and I can check in at a court so other players see it's active. Open games with a waitlist live here too.

**【画面】** 右下角打开 Support 小组件，发一条消息（指 `support/chat` 请求）；然后切到 admin 账号的 Admin 页，扫一眼 stats / users / support desk。
> 「念」 A support widget answers questions and can escalate to a real ticket — which lands in the admin dashboard, where an admin manages users, moderates reports, and runs the support desk, all over the same REST API with an admin guard.

**【画面】** 切一下暗色模式；顺手把窗口拖窄展示响应式。
> 「念」 Dark mode and a responsive layout round it out. Ten pages, every one of them talking to the same sixty-endpoint API.

*（约 145 词）*

---

## 测试与调试 TESTING & DEBUGGING ｜ 6:40–7:30 ｜ /20 ⭐

**【画面】** 终端跑 `pytest -q`（或剪辑加速），停在 `124 passed`；旁边开 `milestone3/vitest_ci_output.txt` 指 `7 passed` 与 typecheck/build 通过；再切 GitHub Actions 绿勾列表一眼。
> 「念」 Underneath the demo: one hundred twenty-four backend tests that drive real HTTP requests and assert on both the JSON and the resulting database rows — plus the frontend suite, the TypeScript contract check, and a production build, all green, all running in CI on every push. That typecheck is a real integration test: it once caught a missing field in a shared type and failed the build before the bug could ship. Day to day, my debugging loop was the network panel you've been watching, plus curl against the live API to tell a frontend problem from a backend one.

*（约 115 词）*

---

## 问题与解决 ISSUES & RESOLUTIONS ｜ 7:30–8:45 ⭐（作业明确要求）

**【画面】** 打开 `milestone3/ISSUES_AND_RESOLUTIONS.md` 目录式扫一眼六个标题，然后停在 Issue 1。
> 「念」 The assignment asks for the issues I hit. Six are written up in the repo; here are the three that taught me the most — and notice they all live between the layers, not inside either codebase.

**【画面】** Issue 1 段落 + `DEPLOY.md` 顶部的同域名警告框。
> 「念」 One: login worked locally but silently died in production — every request after login came back 401. The front end was on Vercel's domain, the API on Render's; a SameSite cookie between two different sites simply never gets sent, and nothing errors. The fix was structural: both apps live on subdomains of one domain — app dot and api dot tryrallypoint dot com — with the cookie scoped to the shared parent. Documented at the top of the deploy guide so it never bites again.

**【画面】** Issue 2 段落 + `client.ts` 的 SLOW_AFTER_MS 代码块；如条件允许展示一次 "waking up" 横幅截图。
> 「念」 Two: the free-tier API sleeps when idle, and the first request takes up to fifty seconds. A timeout would be exactly wrong — that request is what wakes the server. So the client never aborts; past four seconds it raises a non-blocking "server waking up" banner that clears itself. The constraint didn't go away; the confusion did.

**【画面】** Issue 5 段落（deploy race）。
> 「念」 Three: minutes after merging a full-stack PR, the new front end was calling endpoints the old backend didn't have yet — Vercel deploys in two minutes, Render in seven. Now I probe the API with curl before trusting what the UI says. The other three — a broken deep link from verification emails, avatars that couldn't authenticate from an image tag, and schema drift on the production database — are all in the document, each with symptom, diagnosis, and fix.

*（约 240 词）*

---

## 结尾 CLOSING ｜ 8:45–9:10

**【画面】** 回到 live app 的 Find Partner 页，最后切 GitHub 仓库首页（README 顶部的 live-demo 链接可见）。
> 「念」 So that's Milestone 3: a ten-page React front end fully integrated with a sixty-endpoint REST API over a seventeen-table PostgreSQL database — typed end to end, tested at every layer, deployed and usable by anyone right now at app dot tryrallypoint dot com. Thanks for watching.

*（约 55 词）*

---

*英文口播合计约 1,410 词（125+230+250+250+145+115+240+55）；按 ~155 词/分钟约 9:06，在常规 6–10 分钟要求内。若现场偏长，先压缩 UI TOUR 段，再压 OPENING 的第二段；勿压「实时演示 2」（DB Interaction 核心证据）和「问题与解决」（作业明确点名要求）。*

---

### 录制小贴士

- **录前准备（一次做完）**：
  1. **提前 5 分钟打开 live app 转一圈**把 Render 唤醒（免得录制中途撞上 50 秒冷启动——除非你想现场展示 wake banner）。
  2. 准备**两个已验证的生产环境账号**（自己的常用账号 + 一个测试账号），事先确认互相能在 Find Partner 里看到对方（运动、位置设置匹配）。左窗口正常模式登 A，右窗口隐身模式登 B。
  3. DevTools Network 面板筛选 **Fetch/XHR**，勾掉 "Preserve log" 以免列表太长；字体调大一档方便录屏看清。
  4. VS Code 按出场顺序排好标签：`client.ts → api/invites.ts → hooks/useInvites.ts → contexts/AuthContext.tsx`，外加 `milestone3/MILESTONE_3_INTEGRATION.md`（停在映射表）、`milestone3/ISSUES_AND_RESOLUTIONS.md`、`DEPLOY.md`（停在顶部警告框）。
  5. 终端在 `backend/` 目录待命（venv 已激活），随时跑 `pytest -q`。
- **备选方案（本地演示）**：若生产环境当天不稳，整个演示可换成本地：`python seed.py && python app.py` + `npm run dev`，用种子账号 `alex@rally.app` / `maya@rally.app`（密码 `rally1234`）走同一条路线。旁白里把 "production deployment" 相关句子改为 "the same code that runs in production"。
- **Network 面板是主角**：每个关键操作都要「先点操作 → 再点中 Network 里对应请求 → 指 Response JSON」，节奏放慢；评分人对 API Integration /30 的直接证据就是这一段。
- **双账号段（DB Interaction 核心）**：B 窗口那次「邀请出现」如果没有自动刷新，就手动刷新一下页面并如实说 "on refresh" —— 不要声称有实时推送（没有 WebSocket，这是诚实边界）。
- **诚实边界**：reason chips 里的 "playing style" chip 只在生产环境配置了 OpenAI key 时出现——画面里有就指，没有就不提；wake banner 不强求现场出现，可以用一句 "you saw a screenshot" 或直接口述；六个 issue 都有文档背书，讲述与 `ISSUES_AND_RESOLUTIONS.md` 保持一致即可。
- **数字务必念对**：**60** endpoints · **17** tables · **124** backend + **7** frontend tests · **10** pages · **9** typed API modules（`client.ts` 是 wrapper 不算模块）。
- **时长控制**：目标 9 分上下。pytest 可先录全程再 2× 快进，最后 `124 passed` 清晰停留 3 秒即可。
