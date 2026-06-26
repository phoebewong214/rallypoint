"""
Quality tests for the match scorer — it must DIFFERENTIATE (a strong match scores
much higher than a weak one) and surface the right reason chips, not collapse
everyone to the same number like the old base-60 heuristic did.
"""


def _signup(client, email, sport="Pickleball", ntrp="3.5", lat=None, lng=None):
    body = {"email": email, "password": "rally1234", "name": email.split("@")[0].title(),
            "sport": sport, "ntrp": ntrp}
    if lat is not None:
        body["lat"], body["lng"] = lat, lng
    r = client.post("/api/auth/signup", json=body)
    assert r.status_code == 201, r.get_json()
    b = r.get_json()
    return b["token"], b["user"]["id"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


GRID = [{"dayOfWeek": 0, "timeBand": "MORN", "status": 2},
        {"dayOfWeek": 2, "timeBand": "EVE", "status": 2}]


def _row(client, viewer_h, cand_id, sport="Pickleball"):
    rows = client.get(f"/api/players?sport={sport}", headers=viewer_h).get_json()["players"]
    return next((p for p in rows if p["id"] == cand_id), None)


def test_strong_match_beats_weak_match(client):
    from extensions import db
    from models import Court
    db.session.add(Court(slug="hp-courts", name="Hyde Park Courts"))
    db.session.commit()

    # Viewer: 3.5, Hyde Park, free Mon AM + Wed PM, home court HP.
    tv, _ = _signup(client, "mv@rally.app", ntrp="3.5", lat=41.794, lng=-87.590)
    client.patch("/api/auth/me", headers=_h(tv), json={"availability": GRID})
    client.patch("/api/auth/me", headers=_h(tv),
                 json={"sportProfiles": [{"sport": "Pickleball", "ntrp": "3.5", "homeCourt": "hp-courts"}]})

    # Strong: same level, ~next door, same free times, same home court.
    ts, sid = _signup(client, "strong@rally.app", ntrp="3.5", lat=41.795, lng=-87.591)
    client.patch("/api/auth/me", headers=_h(ts), json={"availability": GRID})
    client.patch("/api/auth/me", headers=_h(ts),
                 json={"sportProfiles": [{"sport": "Pickleball", "ntrp": "3.5", "homeCourt": "hp-courts"}]})

    # Weak: 1.5 levels off, no coords, no availability, no home court.
    tw, wid = _signup(client, "weak@rally.app", ntrp="5.0")

    strong = _row(client, _h(tv), sid)
    weak = _row(client, _h(tv), wid)

    assert strong and weak
    assert strong["matchScore"] > weak["matchScore"]
    assert strong["matchTier"] == "great" and weak["matchTier"] == "fair"
    # The strong match explains itself with concrete chips.
    chips = " | ".join(strong["matchReasons"]).lower()
    assert "same level" in chips
    assert "shared time slot" in chips
    assert "home court" in chips
    # The weak match doesn't fabricate "close skill" for a 1.5-level gap.
    assert not any("close on skill" in c.lower() or "same level" in c.lower()
                   for c in weak["matchReasons"])


def test_cosine_basics():
    from services.embeddings import cosine
    assert cosine([1, 0], [1, 0]) == 1.0
    assert abs(cosine([1, 0], [0, 1])) < 1e-9
    assert cosine(None, [1, 0]) == 0.0
    assert cosine([1, 2], [1, 2, 3]) == 0.0  # mismatched length → 0


def test_semantic_signal_adds_style_chip(client):
    """With similar bio embeddings, the match gains a 'similar playing style'
    chip (the genuine-AI signal) — injected directly, no OpenAI call needed."""
    import json
    from extensions import db
    from models import User
    tv, _ = _signup(client, "sem_v@rally.app", ntrp="3.5")
    _ts, sid = _signup(client, "sem_s@rally.app", ntrp="3.5")
    User.query.filter_by(email="sem_v@rally.app").first().bio_embedding = json.dumps([0.98, 0.1, 0.0])
    User.query.filter_by(email="sem_s@rally.app").first().bio_embedding = json.dumps([1.0, 0.0, 0.0])
    db.session.commit()
    row = _row(client, _h(tv), sid)
    assert any("similar playing style" in r.lower() for r in row["matchReasons"])


def test_no_embedding_no_style_chip(client):
    tv, _ = _signup(client, "sem2_v@rally.app", ntrp="3.5")
    _ts, sid = _signup(client, "sem2_s@rally.app", ntrp="3.5")
    row = _row(client, _h(tv), sid)
    assert not any("similar playing style" in r.lower() for r in row.get("matchReasons", []))


def test_score_spreads_not_everyone_the_same(client):
    """Three candidates at different distances/levels must not all tie."""
    tv, _ = _signup(client, "spread_v@rally.app", ntrp="3.5", lat=41.880, lng=-87.630)
    a = _signup(client, "spread_a@rally.app", ntrp="3.5", lat=41.881, lng=-87.631)[1]  # same level, near
    b = _signup(client, "spread_b@rally.app", ntrp="4.0", lat=41.95, lng=-87.75)[1]     # half off, far
    c = _signup(client, "spread_c@rally.app", ntrp="5.0")[1]                            # far level, no coords
    scores = {p["id"]: p["matchScore"] for p in
              client.get("/api/players?sport=Pickleball", headers=_h(tv)).get_json()["players"]}
    assert len({scores[a], scores[b], scores[c]}) == 3  # all distinct
    assert scores[a] > scores[b] > scores[c]
