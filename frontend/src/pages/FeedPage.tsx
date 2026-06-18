import React, { useState, useMemo } from "react";
import { TopNav, Icon, Avatar } from "../rally-shared";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

const FEED = [
  {
    id: 1,
    type: "match-win",
    user: { name: "Maya Patel", handle: "@mayap", initials: "MP" },
    time: "12m",
    sub: "Pickleball · Oak Park Courts",
    text: "Third shot drop is finally clicking. Took two sets vs Alex this morning — those weekend AM matches hit different.",
    match: {
      left:  { name: "Maya Patel", inits: "MP", ntrp: "3.5", win: true },
      right: { name: "Alex Rivera", inits: "AR", ntrp: "3.5", win: false },
      score: "11–7  ·  11–9",
    },
    likes: 24, comments: 5, shares: 2,
    liked: true,
  },
  {
    id: 2,
    type: "join",
    user: { name: "RallyPoint", handle: "@rallypoint", initials: "R", verified: true },
    time: "35m",
    text: "Welcome to the community! 3 new players joined the Berkeley area today.",
    newPlayer: { name: "Sofía Rodríguez", inits: "SR", ntrp: "3.0", sport: "Pickleball", area: "Berkeley · 1.2 mi" },
    likes: 18, comments: 3, shares: 0,
  },
  {
    id: 3,
    type: "lfg",
    user: { name: "Jordan Williams", handle: "@jordanw", initials: "JW" },
    time: "1h",
    sub: "Looking for a partner · Tennis",
    text: "Anyone up for a hit Saturday morning? Looking for 3.5–4.0 level, willing to rally and play sets. I've got fresh balls and the court reserved.",
    lfg: {
      chips: [
        { icon: "calendar", text: "Sat · 9:00 AM" },
        { icon: "pin",      text: "Strawberry Canyon" },
        { icon: "bolt",     text: "NTRP 3.5 – 4.0" },
      ],
    },
    likes: 7, comments: 4, shares: 1,
  },
  {
    id: 4,
    type: "achievement",
    user: { name: "Marcus Chen", handle: "@marcusc", initials: "MC" },
    time: "3h",
    text: "Five in a row. Don't @ me about the 5–7 third set last night.",
    achievement: { title: "5-Game Win Streak", sub: "Unlocked · 4 of 12 milestones" },
    likes: 41, comments: 12, shares: 3,
    liked: true,
  },
  {
    id: 5,
    type: "photo",
    user: { name: "Aisha Johnson", handle: "@aishaj", initials: "AJ" },
    time: "5h",
    sub: "Pickleball · Cesar Chavez Park",
    text: "Sunset doubles last night was unreal. Same time next week?",
    image: "court at golden hour — wide shot",
    likes: 67, comments: 14, shares: 4,
  },
  {
    id: 6,
    type: "match-loss",
    user: { name: "Alex Rivera", handle: "@alexr", initials: "AR", isMe: true },
    time: "Yesterday",
    sub: "Pickleball · Oak Park Courts",
    text: "Tough one against Sofía — she's been working on her serve and it shows. Time to drill some returns this week.",
    match: {
      left:  { name: "Alex Rivera",     inits: "AR", ntrp: "3.5", win: false },
      right: { name: "Sofía Rodríguez", inits: "SR", ntrp: "3.0", win: true },
      score: "9–11  ·  7–11",
    },
    likes: 12, comments: 6, shares: 0,
  },
];

const SUGGESTED = [
  { name: "Marcus Chen",     inits: "MC", ntrp: "4.5", sport: "Tennis",     distance: "3.7 mi", followed: false },
  { name: "Aisha Johnson",   inits: "AJ", ntrp: "3.5", sport: "Pickleball", distance: "0.8 mi", followed: true  },
  { name: "Sofía Rodríguez", inits: "SR", ntrp: "3.0", sport: "Pickleball", distance: "1.2 mi", followed: false },
];

const TRENDING = [
  { rank: 1, tag: "Oak Park Courts",   sub: "47 matches this week" },
  { rank: 2, tag: "UC Berkeley · #4",  sub: "32 matches this week" },
  { rank: 3, tag: "Cesar Chavez Park", sub: "28 matches this week" },
  { rank: 4, tag: "Strawberry Canyon", sub: "19 matches this week" },
];

const ActivityTag = ({ type }) => {
  const map = {
    "match-win":  { cls: "win",  icon: "trophy",  label: "Match · Won" },
    "match-loss": { cls: "loss", icon: "trophy",  label: "Match · Played" },
    "join":       { cls: "join", icon: "sparkles",label: "New Player" },
    "lfg":        { cls: "lfg",  icon: "bell",    label: "Looking for partner" },
    "achievement":{ cls: "ach",  icon: "flame",   label: "Achievement" },
    "photo":      null,
  };
  const m = map[type];
  if (!m) return null;
  return (
    <span className={"activity-tag " + m.cls}>
      <Icon name={m.icon} size={11} stroke={2.5} /> {m.label}
    </span>
  );
};

const MatchEmbed = ({ match }) => (
  <div className="match-embed">
    <div className="me-side">
      <Avatar name={match.left.name} initials={match.left.inits} size="sm" />
      <div style={{ minWidth: 0 }}>
        <div className="me-name">{match.left.name}</div>
        <div className="me-sub">NTRP {match.left.ntrp}</div>
        {match.left.win ? <span className="me-win-tag">WIN</span> : <span className="me-loss-tag">LOSS</span>}
      </div>
    </div>
    <div className="me-score">
      <span className="vs">FINAL</span>
      {match.score}
    </div>
    <div className="me-side right">
      <Avatar name={match.right.name} initials={match.right.inits} size="sm" />
      <div style={{ minWidth: 0 }}>
        <div className="me-name">{match.right.name}</div>
        <div className="me-sub">NTRP {match.right.ntrp}</div>
        {match.right.win ? <span className="me-win-tag">WIN</span> : <span className="me-loss-tag">LOSS</span>}
      </div>
    </div>
  </div>
);

function FeedCard({ item, onLike, onSoon }: { item: any; onLike: (id: number) => void; onSoon: (f: string) => void }) {
  return (
    <article className="feed-card">
      <header className="feed-head">
        <Avatar name={item.user.name} initials={item.user.initials} size="sm" />
        <div className="feed-head-main">
          <div className="feed-name-row">
            <span className="feed-name">{item.user.name}</span>
            {item.user.verified && (
              <span title="Verified" style={{ color: "var(--blue)", display: "inline-flex" }}>
                <Icon name="check" size={13} stroke={3} />
              </span>
            )}
            <span className="feed-handle">{item.user.handle}</span>
            <span className="feed-time">{item.time}</span>
          </div>
          <div className="feed-sub-row">
            <ActivityTag type={item.type} />
            {item.sub && <span>{item.sub}</span>}
          </div>
        </div>
      </header>

      <div className="feed-body">
        <p className="feed-text">{item.text}</p>

        {item.match && <MatchEmbed match={item.match} />}

        {item.lfg && (
          <div className="lfg-chips">
            {item.lfg.chips.map((c, i) => (
              <span key={i} className="lfg-chip">
                <Icon name={c.icon} size={14} /> {c.text}
              </span>
            ))}
          </div>
        )}

        {item.achievement && (
          <div className="achievement-embed">
            <div className="ae-medal"><Icon name="flame" size={22} stroke={2.4} /></div>
            <div>
              <h4 className="ae-title">{item.achievement.title}</h4>
              <p className="ae-sub">{item.achievement.sub}</p>
            </div>
          </div>
        )}

        {item.newPlayer && (
          <div className="new-player">
            <Avatar name={item.newPlayer.name} initials={item.newPlayer.inits} size="md" />
            <div className="np-text">
              <h4 className="np-title">{item.newPlayer.name}</h4>
              <div className="np-badges">
                <span className="badge skill">NTRP {item.newPlayer.ntrp}</span>
                <span className="badge sport"><Icon name="paddle" size={11} /> {item.newPlayer.sport}</span>
                <span className="badge"><Icon name="pin" size={11} /> {item.newPlayer.area}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSoon("Direct messages")}
              className="btn-sm primary"
              style={{
                background: "var(--green)", color: "var(--green-ink)",
                padding: "8px 14px", borderRadius: 8, border: "none",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}
            >
              Say Hi
            </button>
          </div>
        )}

        {item.image && (
          <div className="feed-image">
            <Icon name="image" size={18} />&nbsp;&nbsp;{item.image.toUpperCase()}
          </div>
        )}
      </div>

      <div className="feed-actions">
        {item.type === "lfg" ? (
          <>
            <button className="act-btn lfg-cta" type="button" onClick={() => onSoon("Joining LFG")}>
              <Icon name="check" size={15} stroke={2.5} /> I'm In
            </button>
            <button className="act-btn" type="button" onClick={() => onSoon("Comments")}>
              <Icon name="message" size={15} /> <span className="count">{item.comments}</span>
            </button>
            <button className="act-btn" type="button" onClick={() => onSoon("Sharing")}>
              <Icon name="share" size={15} />
            </button>
          </>
        ) : (
          <>
            <button
              className={"act-btn" + (item.liked ? " active" : "")}
              type="button"
              onClick={() => onLike(item.id)}
            >
              <Icon name="heart" size={15} /> <span className="count">{item.likes}</span>
            </button>
            <button className="act-btn" type="button" onClick={() => onSoon("Comments")}>
              <Icon name="message" size={15} /> <span className="count">{item.comments}</span>
            </button>
            <button className="act-btn" type="button" onClick={() => onSoon("Sharing")}>
              <Icon name="share" size={15} /> {item.shares > 0 && <span className="count">{item.shares}</span>}
            </button>
            <button className="act-btn" type="button" onClick={() => onSoon("Bookmarking posts")}>
              <Icon name="bookmark" size={15} />
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function Composer({ onPost }: { onPost: (text: string) => void }) {
  const { user } = useAuth();
  const { soon } = useToast();
  const [text, setText] = useState("");

  const handlePost = () => {
    const t = text.trim();
    if (!t) return;
    onPost(t);
    setText("");
  };

  return (
    <div className="composer">
      <div className="composer-top">
        <Avatar name={user?.name} initials={user?.initials} size="sm" />
        <textarea
          className="composer-input"
          placeholder="What's the rally today? Share a match, find a partner..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handlePost();
          }}
        />
      </div>
      <div className="composer-actions">
        <div className="composer-tools">
          <button className="tool-btn" type="button" onClick={() => soon("Match logging")}>
            <Icon name="trophy" size={15} stroke={2.4} /> Log Match
          </button>
          <button className="tool-btn" type="button" onClick={() => soon("Partner request from feed")}>
            <Icon name="bell" size={15} stroke={2.4} /> Find Partner
          </button>
          <button className="tool-btn" type="button" onClick={() => soon("Photo upload")}>
            <Icon name="image" size={15} stroke={2.4} /> Photo
          </button>
        </div>
        <button
          type="button"
          onClick={handlePost}
          className="btn-primary"
          disabled={!text.trim()}
          style={{ opacity: text.trim() ? 1 : 0.5, height: 40, padding: "0 18px" }}
        >
          Post
          <Icon name="send" size={14} stroke={2.4} />
        </button>
      </div>
    </div>
  );
}

const FILTERS = [
  { id: "all",     label: "All",         icon: "stats" },
  { id: "match",   label: "Matches",     icon: "trophy" },
  { id: "lfg",     label: "Looking",     icon: "bell" },
  { id: "people",  label: "People",      icon: "users" },
];

function FeedPage() {
  const { user } = useAuth();
  const { show, soon } = useToast();
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState(FEED);

  const onLike = (id) => {
    setItems((arr) => arr.map(it => it.id === id
      ? { ...it, liked: !it.liked, likes: it.likes + (it.liked ? -1 : 1) }
      : it
    ));
  };

  /* Optimistic local post — until POST /api/feed lands, this is local-only.
     User-visible behavior matches the real flow: post is added instantly. */
  const onPost = (text: string) => {
    const newPost = {
      id: Date.now(),
      type: "match-win" as const,  // generic enough; backend will assign real type
      user: {
        name: user?.name ?? "You",
        handle: user?.handle ?? "@you",
        initials: user?.initials ?? "U",
        isMe: true,
      },
      time: "now",
      sub: undefined,
      text,
      likes: 0,
      comments: 0,
      shares: 0,
      liked: false,
    };
    setItems((arr) => [newPost as any, ...arr]);
    show("Posted!", "success");
  };

  const visible = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "match")  return items.filter(i => i.type.startsWith("match"));
    if (filter === "lfg")    return items.filter(i => i.type === "lfg");
    if (filter === "people") return items.filter(i => i.type === "join" || i.type === "achievement");
    return items;
  }, [filter, items]);

  return (
    <>
      <TopNav active="feed" />

      <main className="page">
        <header className="page-head">
          <div>
            <div className="eyebrow"><span className="dot" /> 42 new posts this week</div>
            <h1 className="h1">The <em>community.</em></h1>
            <p className="sub">
              Match results, partner requests, and what's happening on the courts near you.
            </p>
          </div>
        </header>

        <div className="feed-grid">
          {/* Main feed */}
          <div>
            <Composer onPost={onPost} />

            {/* Filter chips */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "1px solid " + (filter === f.id ? "var(--green-deep)" : "var(--border)"),
                    background: filter === f.id ? "var(--green)" : "var(--card)",
                    color: filter === f.id ? "var(--green-ink)" : "var(--text-dim)",
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                    transition: "background-color 140ms ease, color 140ms ease, border-color 140ms ease",
                  }}
                >
                  <Icon name={f.icon} size={14} stroke={2.4} />
                  {f.label}
                </button>
              ))}
            </div>

            <div className="feed-list">
              {visible.map((item) => (
                <FeedCard key={item.id} item={item} onLike={onLike} onSoon={soon} />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="feed-side">
            <div className="side-panel">
              <h3 className="side-title">
                <Icon name="stats" size={14} stroke={2.4} /> Your Week
              </h3>
              <div className="week-stats">
                <div className="week-stat">
                  <div className="num">5</div>
                  <div className="lbl">Matches</div>
                </div>
                <div className="week-stat">
                  <div className="num">3W</div>
                  <div className="lbl">Wins</div>
                </div>
                <div className="week-stat">
                  <div className="num">7.5h</div>
                  <div className="lbl">Court time</div>
                </div>
                <div className="week-stat">
                  <div className="num">2</div>
                  <div className="lbl">New partners</div>
                </div>
              </div>
            </div>

            <div className="side-panel">
              <h3 className="side-title">
                <Icon name="users" size={14} stroke={2.4} /> Suggested Players
              </h3>
              <div className="sug-list">
                {SUGGESTED.map((s) => (
                  <div key={s.name} className="sug-row">
                    <Avatar name={s.name} initials={s.inits} size="sm" />
                    <div className="sug-info">
                      <p className="sug-name">{s.name}</p>
                      <span className="sug-meta">NTRP {s.ntrp} · {s.distance}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => soon("Following players")}
                      className={"sug-btn" + (s.followed ? " ghost" : "")}
                    >
                      {s.followed ? "Following" : "Follow"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="side-panel">
              <h3 className="side-title">
                <Icon name="flame" size={14} stroke={2.4} /> Trending Courts
              </h3>
              <div className="trend-list">
                {TRENDING.map((t) => (
                  <div key={t.rank} className="trend-row">
                    <span className="trend-rank">0{t.rank}</span>
                    <div className="trend-text">
                      <p className="trend-tag">{t.tag}</p>
                      <span className="trend-sub">{t.sub}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

export default FeedPage;
