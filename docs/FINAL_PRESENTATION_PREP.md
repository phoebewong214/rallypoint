# RallyPoint — 期末 Presentation 准备手册

> ACIS 498 Capstone · Phoebe / Youyang / Yuchen
> 依据 dry-run 反馈编写。**假设：15 分钟演讲 + 5 分钟 Q&A**（若实际是 10 或 20 分钟，
> 按第 2 节末尾的缩放规则调整；唯一不能压缩的是 DEMO 段）。

---

## 0. 老师反馈 → 五个可执行动作

| 反馈原话 | 要做的事 | 负责人 | 在本文档 |
|---|---|---|---|
| "rehearse more so the delivery feels natural rather than scripted" | 逐字稿降级成关键词卡，只背开口句 + 交接句 | 全员 | §5 |
| "Youyang and Yuchen … reduce reliance on notes, improve eye contact, bring more energy" | 三步降稿法 + 3 区眼神法 + 录像自查表 | Youyang / Yuchen | §5 |
| "streamlined to create more time for the user journey and solution demonstration" | 开场压到 90 秒，Demo 扩到 6.5 分钟 | 全员 | §2 §3 |
| "moving the error-handling slide toward the end" | error handling 从前段挪到 11:00，与 Testing 合并成一张 | 全员 | §2 §4 |
| "strengthen Q&A prep … CSRF … role of the cloud services (Vercel and Render)" | 背熟 §6 的两个标准答案 + 追问弹药 | 全员（每人都要会答） | §6 |

**最关键的一条：** 老师点名 CSRF 和 Vercel/Render 两题，几乎等于预告了 Q&A 会问。
这两题必须**三个人都能独立答上**，不能只有一个人会——教授经常点名让某个人回答。

---

## 1. 保持不动的东西（老师已经夸过，别改坏了）

- **Phoebe 讲 problem/story 的开场** —— "did a particularly good job explaining the story"。
  内容不动，只做**时长压缩**（见 §2）。
- **Slide 的视觉清晰度** —— "The slides were clear"。别为了塞内容把字变小。
- **"已经部署上云"这件事本身** —— 每次提到都要说域名 `app.tryrallypoint.com`，
  这是全场最强的可信度信号。

---

## 2. 重排后的流程与时间预算

### 2.1 目标结构（15 分钟）

| 时间 | 段落 | 主讲 | 关键判据 |
|---|---|---|---|
| 0:00–1:30 | **Hook + Problem + Solution** | Phoebe | 90 秒讲完，不超时。故事保留，背景数据砍半 |
| 1:30–2:30 | **What makes it different**（可解释匹配） | Phoebe | 一句话价值主张 + reason chips 截图 |
| 2:30–9:00 | 🔴 **USER JOURNEY + LIVE DEMO（6.5 分钟）** | Youyang + Yuchen | 全场重心，见 §3 |
| 9:00–11:00 | **Architecture & Cloud** | Yuchen | 含 Vercel/Render/Postgres 分工，见 §6.2 |
| 11:00–12:15 | **Testing + Error Handling & Resilience** | Youyang | ⬅️ error handling 挪到这里 |
| 12:15–13:15 | **Impact + Roadmap + Close** | Phoebe | 回扣开场的故事 |
| 13:15–15:00 | 机动缓冲 | — | 宁可早结束 90 秒，也不要超时 |

### 2.2 具体要砍掉/合并的内容

**砍：**
- 开场任何超过 2 条的市场数据 / 行业背景 —— 留最有冲击力的 1 条
- "Tech stack 一览" 那种技术清单页 —— 技术栈在 Architecture 页里顺带说，不单独占一页
- Milestone 回顾（M1/M2/M3 做了什么）—— 期末评委只关心最终成果
- 团队分工页 —— 放进附录，别占正片时间

**合并：**
- Testing 页 + Error handling 页 → 一张 "Reliability" 页，三个 bullet，75 秒
- Database schema 页 + Architecture 页 → 一张架构图，19 张表只报数字不逐个念

**移到附录（Q&A 时才翻出来）：**
- ER 图全图
- 六个 integration issues 的完整列表
- API endpoint 全表

### 2.3 其它时长的缩放规则

- **10 分钟**：Demo 保 4.5 分钟，Architecture 压到 75 秒，Testing/Error 压到 45 秒，砍 Roadmap
- **20 分钟**：Demo 扩到 8 分钟（加 Courts check-in + Admin 面板），其余按比例加

---

## 3. DEMO 脚本（6.5 分钟，全场重心）

### 3.1 一个重要更新：你们现在有实时推送和聊天了

M3 的视频脚本里写着 *"不要声称有实时推送（没有 WebSocket）"* —— **这句已经过时**。
仓库里现在有：

- `POST /api/stream` SSE 推送通道（`backend/routes/` + `frontend/src/hooks/useInviteStream.ts`）
- 每局游戏的实时聊天 + 服务端未读角标（commit `05b7de3`、`7bb8bf8`）

**这意味着 demo 的高潮变了**：不再是"刷新一下，邀请出现了"，而是
**"我在左边点发送，右边那台电脑上的角标当场亮起来，我没有碰它"**。
这是全场最有说服力的 5 秒钟。**一定要设计成让评委看见两块屏幕同时变化。**

### 3.2 逐步脚本

准备：两个浏览器窗口并排。左 = 账号 A（Alex），右 = 无痕窗口账号 B（Maya）。
两个都**提前登录好**，停在各自的 Find Partner 页。

| # | 动作 | 口播（英文，背熟第一句即可） | 秒数 |
|---|---|---|---|
| 1 | 展示 Profile 页的 weekly availability grid + NTRP + 主场球场 | "Everything RallyPoint knows about you fits on one screen: your skill rating, your home court, and this weekly grid — when you can actually play. These three things are the input to the matching engine." | 45s |
| 2 | 切到 Find Partner，停在一张匹配卡上，**手指着 reason chips** | "And here's the output. Not just a ranked list — every match tells you *why*. Skill within half a point. Four overlapping hours on Tuesday and Thursday. Same home court, one point two miles away. Nothing here is a black box." | 60s |
| 3 | 点 "Request to play" → 选球场 → 勾两个时间 → 发送 | "I want to play with Maya. I pick a court, propose two times that work for me, and send." | 45s |
| 4 | 🔴 **不要碰右边窗口，让评委自己看到它变了** | "I haven't touched the other machine. Watch." *(停 2 秒不说话)* "That's a live server-sent-events channel — the invite is pushed, not polled." | 30s |
| 5 | 右窗口 B 打开邀请 → 选一个时间接受 | "Maya picks the Tuesday slot. The moment she accepts, the system materializes a real confirmed session." | 40s |
| 6 | 左右两窗口的 Sessions 时间线上出现**同一场比赛** | "Same session, both timelines, one database." | 20s |
| 7 | 打开聊天，左边发一条，右边角标亮 | "And once you have a game, you have a thread — same live channel." | 40s |
| 8 | Courts 页：按距离排序 → check in "here now" → open game 列表 | "Beyond one-to-one matching: real Chicago public courts sorted by distance, check in so others see the court is active, or post an open game with a waitlist." | 50s |
| 9 | 暗色模式 + 拖窄窗口展示响应式（快速） | "Dark mode, responsive, ten pages — all of it against the same API." | 20s |
| | **合计** | | **~5:30 + 60s 缓冲** |

### 3.3 Demo 保险（**这一节决定成败**）

**必做（按顺序）：**

1. ⏰ **上台前 10 分钟打开 live app 点几下** —— Render 免费层闲置会休眠，
   首次请求要 **50 秒**。这是最可能毁掉 demo 的单点风险。
   （讽刺的是你们做了 wake banner 来优雅处理它，但**别在评委面前展示这个**。）
2. 提前确认两个账号在 Find Partner 里能互相看到（运动、位置、时间设置要匹配）
3. 两个窗口**提前登录好**，绝不在台上打密码
4. 浏览器字号调大一档（`Cmd/Ctrl` + `+` 两下），后排能看清
5. 关掉所有通知（macOS 专注模式 / Windows 免打扰）
6. 🎬 **录一段 90 秒的备份 demo 视频放在桌面** —— 网络挂了直接播，
   一句话带过："The network's not cooperating — here's the same flow recorded this morning."
7. 本地兜底：`python seed.py && python app.py` + `npm run dev`，
   种子账号 `alex@rally.app` / `maya@rally.app`，密码 `rally1234`

**台上纪律：**
- 每个关键动作后**停 2 秒不说话**，让评委的眼睛跟上屏幕
- 不要一边点一边解释下一步 —— 先点，等界面变化，再说
- 出错了不要慌，不要道歉三次。一句 "Let me try that once more" 然后继续

---

## 4. Error Handling 挪到后面之后怎么讲（75 秒，一张 slide）

**不要讲 "我们写了 try-catch"。** 讲三件真实发生过的事，每件一个 bullet：

**Slide 标题：Reliability — what happens when things go wrong**

1. **Typed error contract, end to end**
   Pydantic 校验失败 → 结构化 422；任何非 2xx → 前端抛 typed `ApiError`；
   401 会广播一个 `auth:expired` 事件，AuthContext 收到后**全局登出所有标签页**
   （`frontend/src/api/client.ts` + `contexts/AuthContext.tsx:118-133`）

2. **Designing around a constraint we couldn't remove**（这条最能加分）
   免费层 API 闲置会休眠，首次请求 50 秒。
   **加超时是错的 —— 那一发请求正是唤醒服务器的东西。**
   所以我们从不 abort；超过 4 秒就弹一个非阻塞的 "server is waking up" 提示条，
   请求完成自动消失（`components/WakeBanner.tsx`），再配一个定时 keep-warm ping。
   > 口播："We couldn't make the constraint go away. We made the confusion go away."

3. **We find out before users tell us**
   Sentry 接生产错误；CI 在每次 push 上跑后端 pytest + 前端 vitest + TypeScript
   typecheck + 生产构建，四个都绿才能合并。
   typecheck 真的拦下过一次 bug：共享类型少了 `photoVersion` 字段，构建直接失败
   （commit `3e9ff85`）。

**收尾一句接 Roadmap：** "Six integration bugs are written up in the repo with symptom,
diagnosis, and fix — happy to walk through any of them in Q&A."
（把 `milestone3/ISSUES_AND_RESOLUTIONS.md` 当附录 slide 备着）

---

## 5. 脱稿与台风训练（Youyang & Yuchen 专项）

老师的原话是 *reduce reliance on notes, improve eye contact, bring more energy*。
这三件事有具体练法，不是"多练几遍"就能解决的。

### 5.1 三步降稿法（核心方法）

不要试图一步到位脱稿，那只会导致卡壳。分三次降级：

| 阶段 | 手上拿什么 | 练几遍 | 目标 |
|---|---|---|---|
| 第 1 遍 | 完整逐字稿，照念，**录音** | 1 遍 | 确定内容和时长 |
| 第 2 遍 | 每张 slide 只剩 **5 个关键词** | 3 遍 | 允许措辞不同，意思对就行 |
| 第 3 遍 | **只有 slide 本身**，不看任何笔记 | 3 遍 | 卡住就停 2 秒再继续，不要退回看稿 |

### 5.2 只背两句话

即兴讲一整段很难，但**每张 slide 只背两句话**很容易：

- **开口句** —— 这张 slide 的第一句。背到不用想。开口顺了，后面自然流。
- **交接句** —— 交给下一个人的那句。**必须具体，不能只说名字。**

❌ "Next, Yuchen."
✅ "So that's how a match gets made. **Yuchen is going to show you what's running underneath it.**"

中间的内容允许每次说得不一样 —— 那正是"natural rather than scripted"的意思。

### 5.3 眼神：三区法

把观众席**在心里分成左 / 中 / 右三块**。

- 讲完一个要点 → 换一个区
- 每个区停留 3–5 秒（大约一句话的长度）
- **绝对不要盯着投影屏幕念** —— 用笔记本的 presenter view，
  屏幕内容在你面前，你的脸对着观众
- 教授通常坐中间：**每一段至少给中间区一次眼神**

### 5.4 能量：三个可量化的旋钮

"more energy" 听起来很虚，其实就三件事，可以刻意调：

1. **音量 +10%** —— 开场第一句故意比平时大声一点，之后自然回落到合适水平
2. **语速 −10%** —— 紧张时人会不自觉加快。慢下来听起来更自信，也更容易听懂
3. **重音** —— 每个要点的**第一个词加重**。
   "**Three** deployed components across two platforms."

**身体：**
- 手上**不拿纸**（纸会抖，会低头）—— 拿 clicker，或者空手
- 不背手、不插兜、不抱胸
- 站位：讲话的人往前半步，不挡屏幕；不讲话的人退后半步、别玩手机

### 5.5 录像自查表

**每人至少录一次自己讲，然后对着这张表打勾：**

- [ ] 抬头率 —— 有没有超过 70% 的时间脸是朝着"观众"的？
- [ ] "um / uh / like / 那个" —— 数一下，一分钟超过 3 次就要练
- [ ] 有没有一整段都在念稿？（回看时按 2 倍速，念稿段一眼就能看出来）
- [ ] 结尾有没有虎头蛇尾 —— 最后一句要收得干净，不要拖着 "yeah, so… that's it"
- [ ] 时长 —— 自己那段有没有超过分配的秒数？

---

## 6. Q&A 弹药库

> 老师明确点名了前两题。**三个人都要会答**，因为教授可能点名提问。

### 6.1 "What is a CSRF check and why is it important?"

#### 6.1.0 先自己彻底搞懂（讲给自己听的版本）

**一切源于浏览器 cookie 的两条规则，而这两条是不对称的：**

| | 规则 | 后果 |
|---|---|---|
| **A** | 只要请求发往 `tryrallypoint.com`，浏览器就**自动**附上该站 cookie —— **不管请求是谁发起的** | 攻击的根源 |
| **B** | `evil.com` 的 JS **只能读** `evil.com` 自己的 cookie，**永远读不到** `tryrallypoint.com` 的 cookie | 防御的根源 |

**攻击（利用规则 A）：**

1. 你在 RallyPoint 登录，`rp_session` cookie 有效期 7 天，你没登出
2. 你点开一个坏网页 `evil.com`，里面藏着自动提交的表单：
   ```html
   <form action="https://api.tryrallypoint.com/api/auth/logout-all" method="POST">
   <script>document.forms[0].submit()</script>
   ```
3. 浏览器发出这个 POST，**按规则 A 自动附上你的 `rp_session`**
4. 后端一看 cookie 有效 → "这是本人" → 照做

**你被登出了所有设备，而你只是打开了一个网页。**
攻击者**没有偷密码、没有偷 token** —— 他只是"借用了你的浏览器"，
而浏览器忠实地把你的身份附上了。

> 比喻：cookie 像你身上的门禁工牌，规则 A 是"你走到任何一扇门前保安自动刷你的牌"。
> 坏人不需要偷你的牌 —— 他只要**骗你走到那扇门前**。

**防御（利用规则 B）：**

登录时后端发**两个** cookie：

| cookie | 内容 | `httpOnly` | 谁能读 |
|---|---|---|---|
| `rp_session` | JWT 登录凭证 | ✅ 是 | 谁都读不到（连我们自己的 JS 也读不到 → 防 XSS 偷 token）|
| `rp_csrf` | 32 字节随机数 | ❌ 否 | **只有 tryrallypoint.com 上的 JS 能读** |

我们自己的前端发写请求时，把 `rp_csrf` 读出来手动塞进请求头：

```
POST /api/invites
Cookie: rp_session=eyJ...; rp_csrf=xK9mP2...     ← 浏览器自动带的
X-CSRF-Token: xK9mP2...                          ← 我们的 JS 手动加的
```

后端只比一件事：**header 的值 == cookie 的值 吗？**

`evil.com` 发的请求，按规则 A 两个 cookie **还是会**被自动带上，
但 `X-CSRF-Token` 这个头需要**手动填**，要填就得**先读到** `rp_csrf` ——
按规则 B 它读不到，也猜不出 32 字节随机数。**头填不上 → 403 拒绝。**

**🔑 一句话总结（背这句）：**

> 浏览器会**自动发送** cookie，但**不允许别的网站读取** cookie。
> CSRF 攻击利用了前半句，CSRF token 防御利用了后半句。
> 攻击者能让你的浏览器**带着**凭证发请求，但他**看不到**凭证，所以复制不进请求头。

---

#### 6.1.1 现场答题版本

**15 秒版（先给这个，看对方还问不问）：**

> "CSRF is when another website tricks your browser into sending an authenticated
> request to our API without you knowing — because the browser attaches your login
> cookie automatically, no matter who triggered the request. Our CSRF check makes
> sure a write request actually came from our own front end."

**45 秒版（对方追问机制时）：**

> "We authenticate with a cookie, and cookies are attached automatically — that's
> exactly what makes them convenient and what makes them vulnerable. So we use the
> **double-submit cookie** pattern.
>
> At login the backend sets **two** cookies. The JWT is `httpOnly`, so JavaScript
> can never read it — that protects the token from XSS. Alongside it we set a
> random CSRF token that **is** readable by JavaScript.
>
> On every unsafe method — POST, PATCH, PUT, DELETE — our front end reads that
> cookie and echoes it back in an `X-CSRF-Token` header. The backend compares the
> header against the cookie; if they don't match, it's a 403.
>
> **The reason this works:** an attacker's site can make your browser *send* a
> request with your cookie attached, but the same-origin policy means it can't
> *read* our cookie — so it can never produce a matching header."

**代码位置（被要求 show me 时直接翻）：**
| 环节 | 文件 |
|---|---|
| 发两个 cookie | `backend/utils/auth_cookies.py` — `set_auth_cookies()` |
| 后端校验 | `backend/utils/decorators.py:33-39` |
| 前端回传 | `frontend/src/api/client.ts:74, 83` |
| 测试覆盖 | `backend/tests/test_auth.py:255, 276` |

**追问弹药：**

| 追问 | 回答 |
|---|---|
| "为什么 GET 不检查？" | GET/HEAD/OPTIONS 是 safe methods，不改变状态。我们保证 GET 无副作用，所以 CSRF 对它无意义。 |
| "既然有 SameSite=Lax，为什么还要 CSRF token？" | 纵深防御。SameSite 是第一道，但它依赖浏览器行为、老浏览器支持不一致，而且哪天业务需要跨站场景时 SameSite 就得放宽。CSRF token 是应用层自己的保证，不依赖浏览器。 |
| "用 Bearer token 的 API 客户端呢？" | 不检查，也不需要。浏览器不会自动附带 `Authorization` header，所以 Bearer 路径天然免疫 CSRF。代码里的 `via_cookie` 判断就是干这个的。 |
| "CSRF 和 XSS 什么区别？" | XSS 是攻击者在**我们的页面里**执行了代码；CSRF 是攻击者从**他自己的页面**冒用你的身份发请求。我们两个都防：`httpOnly` 防 XSS 偷 token，double-submit 防 CSRF。 |
| "token 多久换一次？" | 每次登录重新生成（`secrets.token_urlsafe(32)`），有效期和会话一致，7 天。 |

### 6.2 "How many cloud services, and what does each do?"

> ⚠️ dry run 就是这题没答清楚。**答题公式：先给数字，再给分工，最后给"为什么不是一个"。**

**开场一句（必须先说这句，它直接回答了 "how many"）：**

> "**Three deployed components across two platforms**, plus three third-party APIs."

**然后逐条（配一张架构图）：**

| # | 组件 | 平台 | 承载什么 | 为什么是它 |
|---|---|---|---|---|
| 1 | `app.tryrallypoint.com` | **Vercel** | React 生产构建的静态文件（HTML/CSS/JS） | 纯静态资源 → CDN 边缘分发最快，push 即部署 |
| 2 | `api.tryrallypoint.com` | **Render** Web Service | Flask API，gunicorn + gevent worker | 需要**常驻的有状态进程**：数据库连接池、SSE 长连接、进程内推送 broker |
| 3 | `rallypoint-db` | **Render** Postgres | 19 张表的全部数据 | 托管 Postgres，与 API 同平台同区域 → 低延迟，`DATABASE_URL` 自动注入 |
| + | Resend | 第三方 | 验证邮件 / 密码重置的 SMTP | 需要 DNS 验证过的域名，邮件才不进垃圾箱 |
| + | Sentry | 第三方 | 生产错误追踪 | 用户不报错我们也能看到崩溃 |
| + | OpenAI | 第三方 | bio embedding 语义匹配（可选） | 没配 key 时优雅降级，评分照常工作 |

**"为什么要用两个平台，不能都放一个？"（这是老师真正想听的那句）：**

> "Because they're two different kinds of workload.
>
> The front end is a **static bundle** — once it's built there's no server logic at
> all, so the right tool is a CDN that serves it from an edge node near the user.
> That's Vercel.
>
> The API is the opposite: it needs a **long-lived process**. We hold open
> server-sent-event connections for live invite and chat push, and the pub/sub
> broker behind them lives **in process** — that's why our Render config pins
> `--workers 1`. A serverless function model would time those connections out, and
> with multiple instances a subscriber on one instance would never see an event
> published from another. So the API needs a real, stateful server. That's Render.
>
> Putting the front end on Render instead would just lose us the CDN. Each platform
> is doing the thing it's actually good at."

**加分收尾（把云架构和 cookie/CSRF 串起来，显得体系完整）：**

> "One deliberate detail: both are on **subdomains of the same domain** — `app.` and
> `api.tryrallypoint.com`. That's not cosmetic. Our session cookie is `SameSite=Lax`,
> which the browser only sends between same-site origins. On the default platform
> domains — `*.vercel.app` and `*.onrender.com` — login returned 200 and then every
> single request came back 401, with no error anywhere. We hit that in production.
> The fix was structural: one parent domain, cookie scoped to `.tryrallypoint.com`."

**追问弹药：**

| 追问 | 回答 |
|---|---|
| "多少钱？" | 目前全部在免费层。代价是 API 闲置会休眠（首请求约 50 秒，我们用 wake banner + keep-warm ping 处理），免费 Postgres 约 30 天到期。真实上线需要升级到付费层，量级是每月几十美元。 |
| "怎么部署的？" | Git push 到 `main` 就自动部署两边。Render 读仓库里的 `render.yaml`（Blueprint），启动时先跑 Alembic 迁移再起 gunicorn。 |
| "数据库迁移怎么处理？" | Flask-Migrate / Alembic。启动命令里 `python manage.py upgrade-db` 是幂等的：新库跑全链，已有库只补未执行的。 |
| "为什么不用 AWS？" | 对这个规模，AWS 的运维成本远大于收益。Vercel + Render 给了我们零配置的 HTTPS、自动部署、托管 Postgres 和健康检查，团队精力可以全放在产品上。 |
| "怎么做健康检查？" | `GET /api/health` → `{"status":"ok"}`，Render 用它判断实例是否就绪。 |

### 6.3 其它高频问题

| 问题 | 要点 |
|---|---|
| **"这真的是 AI 吗，还是 if-else？"** | 诚实分层回答：① 可解释的加权打分（技能差、周时间网格重叠、Haversine 真实距离、共同球场）；② **真正的 AI 部分**是 bio 的 embedding 语义相似度，捕捉"打球风格"这种打分算法编码不了的东西；③ LLM 只**重写措辞**，**从不改变分数** —— 这是刻意的设计边界，保证可解释性。所有匹配写进 `ai_match_logs`，为将来的 learning-to-rank 铺路。 |
| **"怎么保证匹配质量 / 怎么评估？"** | 目前是可解释性优先而非精度优先 —— 每个分数都能追溯到具体信号。`ai_match_logs` 在积累训练数据，下一步是用真实的接受/拒绝记录做 learning-to-rank。**不要假装有准确率数字。** |
| **"数据库为什么 Postgres？dev 用什么？"** | dev 用 SQLite、prod 用 Postgres，靠 `DATABASE_URL` 环境变量切换，**零代码改动**。19 张表。 |
| **"安全还做了什么？"** | ① JWT 存 `httpOnly` cookie（JS 偷不到）② double-submit CSRF ③ Flask-Limiter 限流（登录 10/min，注册 5/min，另有按邮箱的 10/15min）④ Pydantic 校验所有请求体 ⑤ `token_version` 支持"登出所有设备"⑥ `is_active` 封号 ⑦ admin 权限只能从数据库授予，**永远不能通过 API 提权**。 |
| **"测了多少？"** | 后端 pytest 覆盖 19 个测试文件（跑 `pytest -q` 现场报数），前端 vitest 9 个测试文件，加 TypeScript typecheck 和生产构建，CI 每次 push 全跑。**上台前重跑一遍拿最新数字。** |
| **"下一步 / 怎么赚钱？"** | Roadmap 上有：Google OAuth、"online now" 在线状态、learning-to-rank。商业化：先做单城市（芝加哥）密度，球场合作 / 场地预订抽成是自然的下一步。 |
| **"团队怎么分工的？"** | 提前商量好一个诚实的一句话版本，别在台上互相看。 |
| **"最大的技术挑战是什么？"** | 用 §4 的第 2 条（冷启动那个"约束消不掉，就消除困惑"的故事）—— 它同时展示了工程判断和产品思维。 |

### 6.4 Q&A 台风规则

- **答不上来就直说**："That's a good question — we haven't measured that. What we
  *can* say is…" 然后转到你确实知道的相邻事实。**编造是唯一的致命错误。**
- **先答一句，再展开** —— 不要一上来讲 45 秒。先给 15 秒版，对方追问再深入。
- **谁答？** 提前分工：CSRF / 安全 → 一人主答；云架构 / 部署 → 一人主答；
  产品 / 匹配算法 → 一人主答。但**每个人都要能顶上**。
- **不要三个人同时开口**，也不要互相打断补充。主答的人说完，
  最多一个人加一句 "One thing to add — …"。

---

## 7. 排练日程（倒数 7 天）

| 天 | 做什么 | 产出 |
|---|---|---|
| **D-7** | 定稿 slide 顺序（按 §2.1），删掉 §2.2 列的内容，分工到人 | 最终 deck v1 |
| **D-6** | 每人写自己那段的逐字稿 → 立刻降成 5 关键词卡 | 关键词卡 |
| **D-5** | 每人**单独**练 3 遍，第 1 遍录音自听 | 各自过关 |
| **D-4** | 🔴 **全组第一次连排，掐表，全程录像** | 录像 + 时长表 |
| **D-3** | 一起看录像，砍冗余，重新分配秒数；针对 §5.5 自查表逐条改 | deck v2 |
| **D-2** | 连排 2 遍 + **Q&A 互相拷问**（每人从 §6 抽 5 题，互相打断式提问） | Q&A 过关 |
| **D-1** | 连排 1 遍 + **demo 环境彩排**（真的走一遍双账号全流程）+ 录好备份视频 | 备份视频 |
| **D-0** | 提前 30 分钟到场，测投影和音频；**上台前 10 分钟唤醒 Render**；过一遍开场句 | 上场 |

---

## 8. 演讲当天 Checklist

**开场前 30 分钟**
- [ ] 到场，接投影，确认分辨率和字号后排能看清
- [ ] 测试网络（校园 WiFi 会不会挡 `api.tryrallypoint.com`？）
- [ ] 打开备份 demo 视频确认能播

**开场前 10 分钟**
- [ ] 🔴 **打开 `app.tryrallypoint.com` 点几下，唤醒 Render**（避免 50 秒冷启动）
- [ ] 两个浏览器窗口登录好账号 A / B，并排摆位
- [ ] 确认 A 在 Find Partner 里能看到 B
- [ ] 浏览器字号放大两档
- [ ] 关闭所有通知（专注模式 / 免打扰）
- [ ] 关掉无关标签页和 Slack / 微信

**开场前 2 分钟**
- [ ] 手机静音
- [ ] 手上不拿纸，拿 clicker
- [ ] 每人在心里默念一遍自己的**开口句**
- [ ] 深呼吸；记住：音量 +10%，语速 −10%

**结束后**
- [ ] 把仓库链接和 live demo 链接留在最后一张 slide 上（评委会想自己点）

---

## 9. 现场要报的数字（上台前重新核对）

以下数字是**从当前代码里数出来的**，讲之前重跑一遍确认：

| 数字 | 值 | 怎么核对 |
|---|---|---|
| API endpoints | **64** | `grep -rhoE "@[a-z_]+_bp\.(route\|get\|post\|patch\|put\|delete)" backend/routes/*.py \| wc -l` |
| 数据库表 | **19** | `grep -rh "__tablename__" backend/models/*.py \| wc -l` |
| 后端测试文件 | **19** | `cd backend && pytest -q`（**报 pytest 输出的实际条数，别报估算值**） |
| 前端测试文件 | **9** | `cd frontend && npm test` |
| 页面 | **10** | `ls frontend/src/pages/` |
| 部署组件 | **3**（+3 个第三方 API） | 见 §6.2 |

> ⚠️ M3 视频里报的是 60 endpoints / 17 tables / 124 tests —— 那是三个 milestone 前的数字，
> 项目之后又加了 SSE 推送和聊天。**期末别照抄旧数字**，重新数一遍再讲。
