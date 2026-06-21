RallyPoint — Capstone Milestone 1: Written Reflection

Author: Phoebe Wang
Course: ACIS 498, Northwestern University
Date: June 22, 2026
Repository: https://github.com/phoebewong214/rallypoint (public)
Live demo: https://app.tryrallypoint.com

This is my Milestone 1 reflection for RallyPoint, an AI-powered partner-matching platform for everyday tennis and pickleball players in a city. As an Information Systems Capstone, I have written it to emphasize the three things the project actually turns on — solution architecture, applied AI, and defensible business value — and I have organized it to follow the rubric, one section per area, with every market or technology claim tied to a numbered source in the references list at the end.


1. SELF-EVALUATION AND REFLECTION

The matching engine is the technical centerpiece of RallyPoint, and architecting it taught me as much about solution design as any prior coursework. I made a deliberate architectural decision: a deterministic heuristic backbone carries all scoring and ranking because it is free, instant, auditable, and carries no hallucination risk, and I scoped the optional OpenAI LLM strictly to the natural-language "why this match" explanation so that cost and latency stay bounded. It was satisfying to find afterward that this matches what a peer-reviewed study recommends — LLM justifications can increase user trust but work best paired with traditional algorithms rather than replacing them [1] — but I had reached the two-layer design as an architectural choice first, not from the literature. Below I rate myself across five areas on a 1-5 scale, then give concrete evidence and name where I still need to grow.

Programming: 4/5
Database systems: 3/5
User interface design: 3/5
Business analysis: 3/5
Project management: 4/5

Programming (4/5). I built RallyPoint end to end: a React 19 and TypeScript frontend with TanStack Query and an AuthContext, and a Flask 3 backend with PyJWT auth, Flask-Limiter rate limiting, and Pydantic v2 validation. The part I am proudest of is the solution architecture and applied-AI design — the two-layer matching engine described above, with OPENAI_API_KEY gating and a try/except fallback so the system degrades gracefully to the heuristic reason when no key is set, a max_tokens cap and a grounded "never invent facts" prompt to control cost and hallucination, and an ai_match_logs table modeled to capture the source (heuristic or openai) of each match. I also debugged genuinely hard problems — for example a Pydantic/Python 3.14 PyO3 build incompatibility that forced me to reason about the build toolchain, not just application logic. What keeps this short of full marks is honest and specific: the data-logging path is designed but not yet wired in — the served match list recomputes inline and writes nothing, and the only endpoint that writes ai_match_logs is not yet called by the frontend (its own docstring flags it as dead-if-unused). Architecting it is done; wiring it is the next step.

Database systems (3/5). I designed a normalized seven-table schema (users, sport_profiles, courts, court_favorites, sessions, availability_slots, ai_match_logs) with SQLAlchemy and manage migrations through Flask-Migrate, running SQLite in development and PostgreSQL in production via a single DATABASE_URL switch. I am comfortable with schema design and relationships but haven't yet tuned indexes or query plans under real load, which is why I rate myself a 3.

User interface design (3/5). I shipped real, usable features — an availability heatmap, a sessions timeline with accept/decline, and a Courts page with distance and favorites — plus dark mode. Mobile-first responsive design is now the default expectation for consumer web apps, and my layouts still need more deliberate responsive and accessibility work to fully meet that bar.

Business analysis (3/5). I grounded the product in the documented surge in tennis and pickleball participation [2][3] (detailed in the Business Problem section) and benchmarked against comparable apps like Playo and TennisPAL [4]. I can size a market and position a product, and Section 4 shows me ranking technology options by value against cost — but I haven't yet built a formal cost or pricing model, so the ROI sketch in Section 3 is still illustrative.

Project management (4/5). As a solo developer I scoped Milestone 1, set up CI that runs backend pytest and frontend type-check/build on every push, and shipped a live deployment at app.tryrallypoint.com across Vercel, Render, and Resend. Working alone forced disciplined sequencing — and importantly I sequenced by value against cost (the ranking in Section 4), prioritizing architecturally rather than just chronologically.

Quick Programming Test score: 3 / 5

One architectural gap I want to be honest about: the ai_match_logs persistence path is designed but not yet wired in. The served Find Partner list (GET /api/players) recomputes each score and reason inline on every request and deliberately writes nothing to the table — I made that a read-only path on purpose to avoid a GET holding a write transaction. The only code that writes ai_match_logs is the separate match-reason endpoint, which the frontend does not yet call (its docstring even flags it for removal if it stays unused). So the persist-and-reuse cache, and the accept/decline outcome labels that would feed back into the scoring weights, are modeled in the schema but not yet operating end to end. Wiring that logging onto the served path, out-of-band so it stays off the hot read transaction, is my clearest next architectural step. Beyond it, the two areas I most want to strengthen are database performance — moving from correct schema design to indexing and query optimization under load — and UI/accessibility, where I want to apply responsive and accessibility standards rigorously rather than feature by feature. Both are honestly where a solo developer runs out of time in a first milestone, and both are things I know how to fix next.


2. BUSINESS PROBLEM IDENTIFICATION

Recreational tennis and pickleball players face a deceptively hard coordination problem: finding a compatible partner to play with on a recurring basis. The barrier is rarely a lack of interested people — it is the absence of a system that matches players on the three dimensions that actually determine whether a match is worth showing up for: comparable skill (commonly expressed as an NTRP rating), a court close enough to both parties to be realistic, and overlapping availability. When any one of these is missing, the session doesn't happen. These same three dimensions are exactly what the deterministic scoring engine takes as inputs, so the problem definition and the solution architecture share one vocabulary from the start — though, as Section 4 details, today the engine scores skill and proximity precisely while availability is still only a coarse keyword signal and is the clear next refinement.

This problem is getting worse as participation surges. Pickleball was the fastest-growing US sport for a fourth consecutive year, reaching 19.8 million players in 2024 — up 45.8 percent year-over-year [2]. US tennis simultaneously hit a record 25.7 million players in 2024 after five years of growth, a wave led by players under 35, the active-adult core of everyday recreational play [3]. More new and returning players are entering the sport than ever, yet the tooling to pair them off hasn't kept pace.

In a city, where this demand concentrates around busy public courts, coordination today is fragmented and manual. Players rely on Facebook groups, WhatsApp and GroupMe threads, court bulletin boards, club rosters, and word of mouth — channels that broadcast availability into a void rather than matching it. A beginner posting "anyone want to hit?" has no way to know whether the person who replies is a 2.0 or a 4.5, whether their free hours actually overlap, or whether the court they prefer is across town. The result is a high-friction, trial-and-error process that punishes newcomers most: a beginner repeatedly paired with advanced players, or with no one, gets discouraged and quits, while the courts sit empty during hours when two compatible players were both free but never found each other.

There is a structural risk worth naming up front, because it shapes the whole design: this is a two-sided marketplace, so it faces a cold-start / liquidity problem — the product has little value to the first user until enough compatible players exist nearby. That is precisely why local density around public-court hubs is the chosen wedge, launching in a single city (Chicago, where I already have real court data). A busy public court is a natural gathering point — a fixed location that a recurring set of nearby players already orbit — so concentrating early users hub by hub, rather than spreading thin across a whole metro, lets the marketplace reach matching liquidity inside a small geography before expanding court by court and city by city.

The unmet need is therefore specific. Not another events board or swipe-based social app, but a system that treats skill, schedule, and location as first-class matching inputs and shows why a partner is a good fit — making that first session easier to commit to and giving same-level players a reason to keep coming back. Comparable apps in this space, such as Playo and TennisPAL, exist around the matching-plus-proximity model [4], but none is built around a single city's public-court network with the hub-by-hub local density that actually solves cold-start — surfacing the real nearby courts and treating the irregular schedules of working adults as the matching constraint worth getting right. RallyPoint addresses that gap directly.


3. VALUE CREATION

When I scoped RallyPoint I had to be honest about who actually benefits and how, and to trace the AI capability all the way to a dollar outcome. For broad context, McKinsey Global Institute estimates generative AI could add $2.6 to $4.4 trillion annually across the use cases it analyzed, with most value concentrated in customer-facing functions [5] — that is the macro backdrop, not RallyPoint's own ROI, which I work out specifically below. The value chain is concrete: better matches build trust, trust raises first-session commitment, commitment drives engagement and retention, retention converts latent demand into recovered court-utilization hours, and those hours plus a retained user base are what monetize. The LLM explanation layer has a specific job in that chain — it raises first-session commitment by making each match legible — which is the lever that drives the retention term below, making the AI investment traceable to value rather than a feature for its own sake [1].

I map value to three stakeholders, and convert each from adjectives to an illustrative quantity (all numbers below are assumptions to be validated, shown as placeholders, not measured results):

Players. A player paired at the right level is more likely to enjoy the session, return, and stay active. Illustratively, if 40% of well-matched first sessions convert to recurring play versus roughly 15% for unmatched attempts, that ~25-point activation lift is the player-side value.

Facilities and city parks departments. The central, measurable unit here is recovered idle court-hours — the metric a parks and recreation department would actually track. One worked value chain, end to end with stated assumptions (all assumptions to validate, not measured): take a starter base of 300 active local players clustered around a few public-court hubs; assume each does roughly 1 RallyPoint-matched session per week, and that ~30 percent of those sessions are incremental play that would not have happened without a match found (the other ~70 percent would have played anyway). That is 300 x 1 x 0.30 = 90 incremental matched sessions per week. At an average of 1.5 court-hours per session, that is 90 x 1.5 = roughly 135 recovered court-hours per week routed onto otherwise-idle courts. One important caveat keeps this honest: RallyPoint routes players to specific real courts — it already integrates real Chicago court data with distance, favorites, and closure status — but it does not book or reserve them, so the effect on utilization is indirect (surfacing and steering demand, not guaranteeing a reservation). The single biggest sensitivity is the incremental-play rate; the placeholders to validate are the active base (300 players), sessions per player per week (1), incremental share (30 percent), and court-hours per session (1.5).

The platform. A growing, retained, location-anchored user base monetizes through a freemium model, as comparable apps commonly use, with a premium tier in the range of a few dollars a month for advanced matching and scheduling. Illustratively, 5% freemium conversion multiplied by $4 premium ARPU per month multiplied by a retained base of 1,000 users — about $200 per month — is the platform-side value, alongside partnership opportunities with city parks departments, clubs, and facilities tied directly to the recovered court-hours above.

Finally, a data dimension to the value, framed honestly as designed but not yet operating: the ai_match_logs table is modeled to record every served match and its eventual accept/decline outcome, which would let RallyPoint analyze which matches actually convert and recalibrate its scoring — a data flywheel where the product gets better the longer it runs. As Sections 1 and 4 note, that logging is not yet wired onto the served path, so this is a designed-in asset rather than a running one today; the schema is in place and the remaining work is the wiring, detailed architecturally in Section 4. Mapping value across these three stakeholders, with a defensible (if still illustrative) ROI logic behind each, is what convinced me this is more than a class project.


4. TECHNOLOGY TRENDS AND INDUSTRY CONTEXT

AI/LLM-powered matching is the trend most central to RallyPoint, so I treat its architecture, not just its existence, as the heart of this section.

The two-layer engine and its guardrails. The deterministic layer scores and ranks every candidate on NTRP/DUPR skill closeness, court proximity (via Haversine distance), and availability overlap, and emits a baseline plain-language reason — free, instant, auditable, and immune to hallucination. Two of those three inputs are scored precisely: skill closeness moves the score across a wide band (an identical rating adds the most, a gap of more than a point subtracts), and proximity is a true Haversine distance with a within-2-miles bonus. Availability, by contrast, is today only a coarse signal — a small fixed bonus when free-text availability summaries share any keyword — so it is the next refinement, not yet a precise input. The optional layer makes a single gpt-4o-mini call that rewrites only the explanation, from a grounded "never invent facts" prompt with a max_tokens cap; it is gated on OPENAI_API_KEY and wrapped in try/except, so the system degrades gracefully to the heuristic reason whenever the key or the API is unavailable. The ai_match_logs table is modeled to record each match tagged by source (heuristic or openai) and to serve as both a persist-and-reuse cache that bounds token spend and the observability surface for an offline comparison of heuristic versus LLM explanation quality. To be transparent, that logging is not yet wired onto the served path: the GET /api/players list recomputes inline and writes nothing (a deliberate read-only choice), and the only writer is a separate match-reason endpoint the frontend does not yet call, so this is the intended caching and analytics design rather than a running one. The relevant peer-reviewed work supports exactly this heuristic-plus-LLM split: LLM justifications raise trust but are best paired with, not substituted for, traditional algorithms [1].

Multiple solution approaches, and why the hybrid wins now. A core capstone question is to propose several approaches and justify which creates the most value. For the matching engine I evaluated four:

Pure heuristic — value: solid ranking; cost: near zero; latency: instant; explainability: full but mechanical; maintainability: high. Strong, but the match reasons read as terse and fail to build trust.

Pure LLM — value: rich, fluent explanations; cost: a token charge on every match plus vendor dependency; latency: a network round-trip per request; explainability: low (it can hallucinate a justification); maintainability: brittle, prompt-sensitive. Unacceptable as the ranker because correctness and auditability are not guaranteed.

Hybrid (chosen) — value: auditable ranking plus trust-building explanation; cost: bounded, since the LLM is optional and scoped to explanation only; latency: the heuristic answers instantly and the LLM is a single capped call; explainability: the ranking is fully deterministic and the prose is grounded; maintainability: high, with graceful fallback. This is the maximum-value option today.

Trained ML ranking model — value: potentially the best ranking; cost: high; latency: low at serve time; explainability: lower than the heuristic; data readiness: not met yet — it needs a labeled history of which matches were accepted or declined. This is the right future option, not a current one.

To show the choice on a common axis rather than just assert it, here are rough order-of-magnitude figures per match served. "Cost / match" is the marginal compute or API cost of producing one ranked match with its reason; "Latency" is the added serve-time cost of the reason step:

  Pure heuristic
    Cost / match:   ~$0
    Latency:        ~1 ms
    Explainability: full but mechanical
    Data needed:    none

  Pure LLM ranker
    Cost / match:   ~$0.0005-0.002 every match
    Latency:        ~300-800 ms every match
    Explainability: low (can fabricate a justification)
    Data needed:    none

  Hybrid (chosen)
    Cost / match:   ~$0 for ranking; +~$0.0005-0.002 only when the LLM reason is on
    Latency:        ~1 ms for ranking; +~300-800 ms only on the optional reason
    Explainability: full deterministic ranking + grounded prose
    Data needed:    none

  Trained ML ranker
    Cost / match:   model + infra, amortized
    Latency:        ~5-20 ms
    Explainability: lower than the rules
    Data needed:    a labeled accept/decline history (not available yet)

The quantified hybrid row is the point: ranking stays at the heuristic's ~$0 and ~1 ms because the deterministic layer always carries correctness and ordering, and the only metered cost — the ~$0.0005 to $0.002 and ~300-800 ms gpt-4o-mini round-trip — is incurred optionally, on the explanation alone, and disappears entirely when no key is set. So the hybrid buys the pure-LLM's trust-building prose without paying the pure-LLM's per-match cost, latency, or hallucination on the ranking itself, and unlike the ML option it needs no data we do not yet have. That is why it is the maximum-value option today.

The bridge between hybrid-now and ML-later is data, and I want to be precise about its current state. The ai_match_logs schema is designed to record the viewer, candidate, sport, score, reason, and source of each match and to carry an accept/decline outcome label — which is exactly what a data flywheel needs: A/B comparison of heuristic versus LLM reason quality, a labeled dataset to recalibrate the heuristic weights, and the eventual training corpus for an ML ranker. As noted above, that logging is not yet wired onto the served path, so the flywheel is designed but not yet turning — the same status as the cache. The honest sequence is rules now, learning later, with the schema that makes "later" possible already in place and the wiring as the next step.

Cloud and scalability. RallyPoint runs today on Vercel (frontend), Render (the Flask API), managed PostgreSQL, and Resend (transactional email) — a topology that fits a solo developer's cost and operational budget. The scale conversation only matters if I can name the actual bottleneck, and there are two concrete ones on the hot read path, not a vendor brand. First, the synchronous LLM call: if the explanation layer is turned on inline, each match served blocks on a ~300-800 ms gpt-4o-mini round-trip, which does not survive a list of many candidates under load — the fix is to keep ranking on the instant heuristic and move the LLM reason off the request path (precompute it, or fetch it asynchronously per card via the existing match-reason endpoint). Second, the uncached recompute: GET /api/players recomputes every candidate's score and reason on every filter change with no persistence, so cost scales with viewers x candidates x requests — the fix is the persist-and-reuse cache the schema is already designed for, populated out-of-band so it never holds a write transaction on the read path. Both fixes are platform-independent. Where the cloud choice then comes in, framed strictly as future architecture and not as anything deployed today: moving the API to Azure App Service or Azure Container Apps for horizontal scale-out, the database to Azure Database for PostgreSQL Flexible Server for managed read replicas and connection pooling, and the explanation layer to Azure OpenAI as a drop-in for the same grounded prompt [6]. Designing the LLM layer behind a single gated call is what makes that last swap a drop-in rather than a rewrite. I am not claiming a single-city MVP needs enterprise SLAs — it does not; that posture matters only if RallyPoint later sells into cities, parks departments, or facility operators as institutional buyers with data-residency requirements.

Risks and mitigations. The cold-start / two-sided liquidity risk (Section 2) is mitigated by the public-court-hub density wedge (saturating one city, Chicago, before expanding). LLM cost, latency, and hallucination are mitigated already by the deterministic backbone that carries all ranking, the grounded "never invent facts" prompt, the max_tokens cap, and the OPENAI_API_KEY-gated graceful fallback; the persist-and-reuse cache in ai_match_logs would further bound token spend but is designed, not yet wired, so I count it as a planned mitigation rather than a live one. Location privacy is mitigated by using coarse, approximate distance rather than exact coordinates. Security is addressed by JWT auth, Flask-Limiter rate limiting, and Pydantic validation, all already shipped.

Secondary trends, ranked. Geolocation/proximity discovery is a standard expected feature and a familiar UX pattern, already partly built via court distance, with privacy handled by approximate rather than exact location. Real-time presence (WebSockets, typically Redis Pub/Sub and sticky sessions) is operationally heavier and deferred until the user base needs it. Mobile-first/PWA delivery is incremental responsive work on the existing React app. Wearable/activity-data integration (for example Strava's API to refine skill estimates beyond self-reported NTRP) adds consent and integration complexity and ranks last.

Ranking the trends on value to RallyPoint versus implementation cost makes the sequencing clear:

Hybrid AI explanation: high value, moderate cost — already built; the core differentiator.
Proximity discovery: high value, low cost — already partly built; familiar pattern with a privacy guardrail.
Real-time presence: medium value, high cost — operationally heavy; deferred.
Mobile-first delivery: medium value, low cost — incremental responsive work.
Wearable data: low near-term value, high cost — consent and integration complexity put it last.

Just as important for me as a solo developer, ranking by value against cost lets me sequence the work — hybrid AI explanation and proximity discovery first, real-time presence and wearables later — instead of chasing every trend at once.


5. CAPSTONE PROJECT IDEAS

Idea 1 — RallyPoint: AI-powered sports partner matching (selected). A web platform that matches a city's recreational tennis and pickleball players on skill (NTRP rating), schedule overlap, and court proximity, then explains why each match makes sense. The differentiation is not "AI" generically but the specific hybrid architecture detailed in Section 4: an auditable deterministic ranker plus an optional, trust-building LLM explanation with graceful fallback. The business problem and market are established in the Business Problem section [2][3], and the Technology Trends section already evaluates this design against the alternatives and justifies it as the maximum-value approach.

Idea 2 — Public-court booking and utilization-analytics platform. A reservation system for a city's public tennis and pickleball courts that surfaces real-time availability and gives parks departments occupancy analytics to reduce idle-court waste and double-bookings. The business problem is operational: popular public courts are over-subscribed at peak hours and empty off-peak, with no data to plan. It is a credible capstone spanning CRUD, scheduling logic, and dashboards.

Idea 3 — Community rec-sports league and pickup manager. A tool for organizing local ladders, drop-in games, and pickup groups for a city's recreational players, comparable to activity-first communities like Meetup and Bumble BFF. The business problem: ad-hoc group-chat coordination doesn't scale and players churn. It is viable through event scheduling, roster management, and notification workflows.

I selected RallyPoint (Idea 1) on maximum-value and architectural grounds. It best balances genuine market demand (see Business Problem) with the differentiated hybrid AI design (see Technology Trends, where I evaluate it against pure-heuristic, pure-LLM, and trained-ML alternatives). Two further reasons are decisive. First, the data flywheel is a forward moat: the ai_match_logs schema is designed so that, once logging is wired onto the served path (the next step flagged in Sections 1 and 4), every match and its accept/decline outcome accrues into a proprietary dataset — making the scoring better the longer RallyPoint runs and the future ML-ranking option more viable. It is a designed-in asset the booking-only (Idea 2) and event-only (Idea 3) alternatives do not even have a place for. Second, on risk, the cold-start exposure inherent to a two-sided marketplace is mitigated by the public-court-hub density wedge (saturating one city first), closing the risk thread opened in Section 2.


REFERENCES

1. Frontiers in Big Data (NIH/PMC), explaining recommendations with large language models — https://pmc.ncbi.nlm.nih.gov/articles/PMC11808143/
2. SFIA 2025 Topline Participation Report — https://sfia.org/resources/sfias-topline-participation-report-shows-247-1-million-americans-were-active-in-2024/
3. USTA 2024 Tennis Participation Report — https://www.usta.com/en/home/stay-current/national/u-s--tennis-participation-grows-to-record-25-7-million-players-i.html
4. Playo, official site (cited as an example of a comparable matching-plus-proximity app in this space, not as independent traction data) — https://playo.co/
5. McKinsey Global Institute, The economic potential of generative AI: The next productivity frontier — https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/the-economic-potential-of-generative-ai-the-next-productivity-frontier
6. Microsoft Learn, Azure OpenAI / Microsoft Foundry Models documentation — https://learn.microsoft.com/en-us/azure/ai-services/openai/overview
