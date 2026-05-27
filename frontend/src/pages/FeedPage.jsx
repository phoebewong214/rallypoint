import React, { useState } from "react";

const INITIAL_POSTS = [
  {
    id: 1,
    author: "Alex Chen",
    avatar: "AC",
    timeAgo: "2h",
    content:
      "Great rally session tonight at Vargo — anyone up for doubles this Saturday morning? Intermediate level, just for fun.",
    sport: "Tennis",
    likes: 12,
    comments: 4,
  },
  {
    id: 2,
    author: "Priya Sharma",
    avatar: "PS",
    timeAgo: "5h",
    content:
      "Hit a new PR on the bench today, also looking for a basketball pickup crew on the weekends. SPAC people, where you at?",
    sport: "Basketball",
    likes: 28,
    comments: 9,
  },
  {
    id: 3,
    author: "Marcus Johnson",
    avatar: "MJ",
    timeAgo: "1d",
    content:
      "Picked up a paddle for the first time yesterday. Pickleball is way harder than it looks — anyone want to be patient with a beginner?",
    sport: "Pickleball",
    likes: 17,
    comments: 6,
  },
  {
    id: 4,
    author: "Sofia Rodriguez",
    avatar: "SR",
    timeAgo: "1d",
    content:
      "6 miles on the lakefront this morning. Cool breeze, perfect pace. Forming a Saturday long-run group — DM if interested!",
    sport: "Running",
    likes: 34,
    comments: 11,
  },
  {
    id: 5,
    author: "Daniel Kim",
    avatar: "DK",
    timeAgo: "2d",
    content:
      "Our co-ed Sunday soccer league still has 2 open spots. We play at Lincoln Park, 2pm kickoff. All levels welcome.",
    sport: "Soccer",
    likes: 21,
    comments: 7,
  },
];

export default function FeedPage() {
  const [posts, setPosts] = useState(INITIAL_POSTS);
  const [draft, setDraft] = useState("");

  const handlePost = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setPosts([
      {
        id: Date.now(),
        author: "Phoebe Wang",
        avatar: "PW",
        timeAgo: "now",
        content: draft.trim(),
        sport: "General",
        likes: 0,
        comments: 0,
      },
      ...posts,
    ]);
    setDraft("");
  };

  return (
    <div className="min-h-screen bg-rally-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-rally-700 mb-2">
          Community Feed
        </h1>
        <p className="text-gray-600 mb-6">
          What your rally network is up to.
        </p>

        <form
          onSubmit={handlePost}
          className="bg-white rounded-2xl shadow border border-rally-100 p-4 mb-6"
        >
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-rally-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
              PW
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Share an update or look for a partner..."
              rows={2}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rally-500 resize-none"
            />
          </div>
          <div className="flex justify-end mt-3">
            <button
              type="submit"
              className="bg-rally-600 hover:bg-rally-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow"
            >
              Post
            </button>
          </div>
        </form>

        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-2xl shadow border border-rally-100 p-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rally-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {post.avatar}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {post.author}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {post.timeAgo} · {post.sport}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-700 mt-2">{post.content}</p>

                  <div className="flex gap-6 mt-3 text-sm text-gray-500">
                    <button className="hover:text-rally-700 transition">
                      Like ({post.likes})
                    </button>
                    <button className="hover:text-rally-700 transition">
                      Comment ({post.comments})
                    </button>
                    <button className="hover:text-rally-700 transition">
                      Share
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
