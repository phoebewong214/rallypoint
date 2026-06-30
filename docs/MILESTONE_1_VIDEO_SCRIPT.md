# RallyPoint — Milestone 1 演示视频脚本（前端组件 / Front-End Component）

*总时长约 6:43 ｜ 英文口播约 1,010 词 ｜ 覆盖评分项：Demonstration /20 · Code Walkthrough /15 · Discussion of Issues & Resolutions /15 ｜ 本里程碑 = ACIS 498 Milestone 1 前端组件（React/TypeScript）；后端 Flask API + 数据库属于 Milestone 2 ｜ 全程真实页面与真实代码，无夸大*

---

## 开场 OPENING ｜ 0:00–0:48 ｜ 得分项：Demonstration /20（背景 + 价值主张）

**【画面/操作】** 全屏打开 RallyPoint（深色模式），停在登录页 Logo 上，不点击。
> 「念」 Hi, I'm Phoebe, and this is RallyPoint — I built it solo for my ACIS 498 capstone. It's an AI partner-matcher for everyday recreational tennis and pickleball players in a city. The problem: regular players struggle to find someone who fits — close on skill, free at the same hours, near the same public court. So good courts sit half-empty and people stop playing.

**【画面/操作】** 鼠标轻扫过 "Find Partner" 与 "Courts" 入口。
> 「念」 Better matches mean more games and busier courts. My matching is a transparent, explainable score built from real signals — skill, distance, schedule overlap, shared courts — plus a genuine AI signal: a "similar playing style" score from the embeddings of players' bios. The only optional piece is an LLM that rewrites the reason wording, and it's off in this demo. This milestone is the React front end; I'll cover the product, the front-end code, and three real issues I fixed.

*（约 120 词）*

---

## 演示解决方案 DEMONSTRATION ｜ 0:48–2:46 ｜ 得分项：Demonstration /20

**【画面/操作】** 登录页输入 alex@rally.app / rally1234，点 Log in。
> 「念」 Let's log in. This is the live React app talking to the API through a typed client. We're in as a real Chicago player.

**【画面/操作】** 打开 Find Partner，停在排好序的候选列表。
> 「念」 This is Find Partner — the heart of the product. Every player is ranked by a match score, best matches on top.

**【画面/操作】** 指向第一名，依次指 tier、% 分数、各 reason chip。
> 「念」 Each match shows a tier — great, good, or worth a try — a percentage score, and reason chips, every chip a real signal the score is built from: "same level," "a mile away," "three shared time slots," even "similar playing style," which comes from comparing the two players' bio embeddings. So the AI is real and auditable — you can see exactly why it's a match. An optional LLM can rewrite the wording when a key is set, but it's off right now and never changes the score.

**【画面/操作】** 拖动 NTRP / skill 滑块、切换 sport，展示列表实时更新（live filtering）。
> 「念」 Filtering is live — I drag the skill range or switch sport, and the ranked list updates itself, no submit button. I'll show in the code how I keep that from hammering the API.

**【画面/操作】** 切到 Profile，滚到 preferred-times 网格（AvailabilityGrid）与 sport profile。
> 「念」 Here's my profile. This is my weekly preferred-times grid — I set when I play, and the engine scores how much two players' grids actually overlap; that's worth real points in the match. And these are my sport profiles: a real NTRP for tennis, DUPR for pickleball — ratings players already know, so skill closeness means something.

**【画面/操作】** 切到 Sessions，展示 upcoming / requests / past，在一条 request 上点 Accept。
> 「念」 Sessions is the timeline — upcoming, requests, past. When someone wants to play, I just accept, or decline. That's the whole loop: get matched, request, confirm.

**【画面/操作】** 切到 Courts，事先定位到一个 distance 有真实数据的球场。
> 「念」 Now Courts — the Chicago part. These are real public courts, not made-up data. Each shows your real distance in miles, plus surface, lights, and court count.

**【画面/操作】** 点 bookmark 收藏（即时翻转），看右侧 Leaflet 地图，最后切 dark mode。
> 「念」 I can bookmark the ones I play at — it flips instantly. On the right is a live Leaflet map: a marker for me, a pin per court. This is the cold-start strategy — build density around public-court hubs, court by court. And one quick thing: dark mode, clean across the whole app.

*（约 295 词）*

---

## 代码讲解 CODE WALKTHROUGH ｜ 2:46–4:42 ｜ 得分项：Code Walkthrough /15

**【画面/操作】** 编辑器打开 `frontend/src/api/client.ts`，高亮 `VITE_API_URL`、`resolveApiBase()`、`credentials: "include"`、`X-CSRF-Token`、401 的 `auth:expired`。
> 「念」 Let's start at the front-end's foundation — the typed API layer. Every call goes through one generic fetch wrapper. The API base URL is environment-driven: in production, Vercel injects `VITE_API_URL` pointing to the deployed Render API; `localhost:5050` is only a Vite development fallback, and production fails loudly if the variable is missing. Auth is cookie-based, not a header token: the JWT lives in an httpOnly cookie the browser sends automatically, so JavaScript never touches it; writes echo a CSRF cookie in an `X-CSRF-Token` header — a double-submit defense. A 401 fires a global `auth:expired` event.

**【画面/操作】** 打开 `frontend/src/api/players.ts`，高亮 `playersApi.list`、`toQS`、`PlayersResponse`，指向 `matchScore`/`reason`。
> 「念」 This is the exact call that requests the AI matches — `playersApi.list` returns a typed response. The backend filters and scores; the front end just sends filters and renders each player's `matchScore` and `reason`, never recomputed here.

**【画面/操作】** 打开 `frontend/src/hooks/usePlayers.ts`，高亮 `queryKey: ["players", filters]` 与 `staleTime: 30_000`。
> 「念」 The page subscribes through a TanStack Query hook. The filters are part of the query key, so changing sport or skill auto-refetches and caches a result per combination, and hands back `data` and `isLoading` to drive skeletons versus cards.

**【画面/操作】** 打开 `contexts/AuthContext.tsx`（`authApi.me()`、`readCachedUser`、`auth:expired` effect）与 `components/ProtectedRoute.tsx`。
> 「念」 AuthContext is the single source of truth for the user: on mount it calls `/auth/me` to validate the cookie, and seeds first paint from a cached non-secret user object — never the token. A second effect listens for `auth:expired` and cross-tab logouts, so the user clears everywhere. ProtectedRoute guards each page with a placeholder while the check runs, plus an email-verification gate.

**【画面/操作】** 打开 `pages/FindPartnerPage.tsx`，高亮 300ms debounced `useEffect`、`PlayerCard` 里 `match-tier`/`match-chips` 渲染 `matchTier`/`matchScore`/`matchReasons` 的块与 `liveMatches` 回退逻辑。
> 「念」 Here's where the matching surfaces: the card renders the backend's output verbatim — a tier, a percentage score, and the reason chips, including the "similar playing style" chip that comes from the bio-embedding signal — sorted by score, never recomputed here. It also splits draft filters from an applied state behind a 300-millisecond debounce — that's how the live filtering from the demo fires one query, not one per slider tick. The fallback is honest — an empty response shows "no partners match," and only an unreachable backend falls back to a clearly-labeled sample list.

**【画面/操作】** 打开 `pages/CourtsPage.tsx` + `hooks/useCourts.ts`，高亮 `useToggleCourtFavorite` 的 `onMutate`/`onError`；快速划过 `types/index.ts`、`App.tsx` 的 `React.lazy`。
> 「念」 Courts renders real distance with an optimistic favorite toggle — `onMutate` flips the bookmark instantly, `onError` rolls back. Types flow end to end, from the API client to the JSX, and `App.tsx` code-splits the Courts page — which carries the heavy Leaflet map — so that bundle only loads when you open it. One honest bridge: the hybrid scoring engine itself runs in the Flask backend — that's Milestone 2. Here the front end just consumes it.

*（约 295 词）*

---

## 问题与解决 ISSUES & RESOLUTIONS ｜ 4:42–6:18 ｜ 得分项：Discussion of Issues & Resolutions /15

**【画面/操作】** 打开 `frontend/src/api/client.ts`，高亮 `resolveApiBase()`：localhost fallback 现在被 `import.meta.env.DEV` 门控，生产缺 `VITE_API_URL` 直接显式抛错。
> 「念」 Three real front-end issues, all fixed. First, a deployment trap. My API client used to fall back to localhost whenever `VITE_API_URL` was missing — fine locally, but in production that meant the deployed app would ask each user's own browser to call their localhost, a silent failure. I fixed it with `resolveApiBase`: the localhost fallback now exists only in Vite dev, and production throws loudly if the variable is missing. Environment separation, made explicit.

**【画面/操作】** 高亮 `FindPartnerPage.tsx` 里 sample fallback 的 `import.meta.env.DEV || VITE_DEMO_FALLBACK` 门控；切到事先截好的两张状态图："backend unavailable — Try Again" 与空状态 "No partners match"。
> 「念」 Second, keeping the UI honest. I had a sample-player fallback so the page looked alive when the backend was down — convenient in dev, but in production a real user could mistake fake players for real ones. So samples are gated to dev only now, unless I explicitly opt in. A production API failure shows a clear "unavailable, try again" state, and a true empty result shows "no partners match" — never fabricated users.

**【画面/操作】** 切到 `frontend/src/hooks/useSavedPlayers.ts`，高亮 `useToggleSavedPlayer` 的 optimistic `onMutate` / `onError` 回滚；在 Find Partner 上点一次 save（即时翻转），再到 Profile 看保存的球友。
> 「念」 Third, making a preference real. Bookmarking a player used to live only in localStorage — device-specific and temporary. I moved it to a server-backed saved-players API with an optimistic mutation: the bookmark flips instantly, rolls back on error, and the server stays the source of truth. Now saved partners follow your account, and Profile shows them. The backend setup issues — a circular import, a dependency build — were real too, but those belong to Milestone 2.

*（约 240 词）*

---

## 结尾 CLOSING ｜ 6:18–6:43 ｜ 收束 + 路线图

**【画面/操作】** 回到 Find Partner 排名页，光标停在带 reason 与 "% fit" 的卡片上。
> 「念」 So which approach creates the most value? The hybrid — a transparent, explainable score, with a genuine embedding signal for playing style, and an optional LLM that only rewrites the wording. The front end you saw consumes it through one typed, cached API layer. The clear next step is Milestone 2: the Flask scoring engine in depth, and wiring `ai_match_logs` — designed but not yet logging — into a learning-to-rank loop. Thanks for watching.

*（约 62 词）*

---

*英文口播合计约 1,012 词（120 + 295 + 295 + 240 + 62）；按 ~150 词/分钟实读约 6:43，控制在 7:00 以内并留有余量。若现场偏长，优先压缩 Issues 段的叙述。*

---

### 录制小贴士

- 开场先深色模式打开 app，画面干净再开口；语速约 150 词/分钟。开场定调要讲清楚："matching 是可解释的分数（技能/距离/时段重叠/球场）+ 真 embedding 的'打法相似度'信号；唯一可选的在线 LLM 只重写措辞、本演示关闭"，"本里程碑是 React 前端"，让后面的诚实声明前后呼应。
- Demonstration 读卡片时放慢、鼠标依次停在 tier、% 分数、各个 reason chip 上——评委是 Microsoft 首席 AI 架构师，"可解释 + 真 embedding 信号"比假"AI Match"更得分。**availability 说成真实的每周 preferred-times 网格重叠**（已不是关键词匹配，别再说 coarse）。"similar playing style" chip 来自 bio embedding，是真 AI 信号——但只有种子数据算过 embedding 时才出现，所以**录前确认线上 demo 有没有这个 chip**：有就指着它讲，没有就只讲架构、别声称它在画面上。Courts 页只口播 distance、surface、lights、court count、Leaflet 地图这些已核实字段；不要声称 closure 字段（前端没有）。
- Code Walkthrough 编辑器字号 16–18pt、深色主题、开行号；按 `client.ts` → `players.ts` → `usePlayers.ts` → `AuthContext.tsx`/`ProtectedRoute.tsx` → `FindPartnerPage.tsx` → `CourtsPage.tsx` 排好标签页零延迟切换；关键标识符提前高亮。念到 "production, Vercel injects VITE_API_URL""JavaScript never touches it""never recomputed here""one query, not one per slider tick"时停一拍。明确说一次"scoring engine 在 Flask 后端，属于 Milestone 2"，不展开后端代码。**认证务必说 httpOnly cookie + CSRF，不要说 localStorage 或 token header；API 地址务必说生产由 Vercel env var 指向 Render，localhost 只是本地开发 fallback**。
- Issues 段（已与反思文档对齐到当前代码）：① **resolveApiBase**——对照旧的 `|| localhost` 兜底 vs 新的 `DEV` 门控 + 生产抛错，展示代码即可、不需断网；② **demo 兜底诚实化**——建议事先截两张状态图（生产 "unavailable, Try Again" 与空状态 "no partners match"），念到 "never fabricated users" 停一拍；③ **saved players 上云**——可**现场演示**：Find Partner 点 save 即时翻转、Profile 看到保存的球友，再特写 `useSavedPlayers` 的 `onMutate`/`onError` 回滚。一句话带过后端 issue（循环导入/依赖构建）属于 Milestone 2，不走读。
- 结尾光标停在带 reason 与 "% fit" 的卡片上；念到 "designed but not yet logging" 略加重音，明确 ai_match_logs 尚未落地；最后一句后停 1 秒再停录。
- 全程只展示真实页面与真实代码；ai_match_logs 仅作"下一步"且明说尚未 logging，不演示；不声称 LLM 在线运行；不声称前端持有 token（前端是 httpOnly cookie + CSRF）。
