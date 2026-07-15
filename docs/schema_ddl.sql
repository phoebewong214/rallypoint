CREATE TABLE ai_match_logs (
	id INTEGER NOT NULL, 
	viewer_id INTEGER NOT NULL, 
	candidate_id INTEGER NOT NULL, 
	sport VARCHAR(20) NOT NULL, 
	score INTEGER NOT NULL, 
	reason TEXT NOT NULL, 
	source VARCHAR(20) NOT NULL, 
	outcome VARCHAR(20), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_match_log UNIQUE (viewer_id, candidate_id, sport), 
	FOREIGN KEY(viewer_id) REFERENCES users (id), 
	FOREIGN KEY(candidate_id) REFERENCES users (id)
);

CREATE TABLE appointment_participants (
	id INTEGER NOT NULL, 
	appointment_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	waitlisted BOOLEAN NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_appt_user UNIQUE (appointment_id, user_id), 
	FOREIGN KEY(appointment_id) REFERENCES court_appointments (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE availability_slots (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	day_of_week INTEGER NOT NULL, 
	time_band VARCHAR(10) NOT NULL, 
	status INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_user_dow_band UNIQUE (user_id, day_of_week, time_band), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE court_appointments (
	id INTEGER NOT NULL, 
	court_id INTEGER NOT NULL, 
	creator_id INTEGER NOT NULL, 
	sport VARCHAR(20) NOT NULL, 
	scheduled_at DATETIME NOT NULL, 
	max_players INTEGER NOT NULL, 
	note TEXT, 
	status VARCHAR(20) NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(court_id) REFERENCES courts (id), 
	FOREIGN KEY(creator_id) REFERENCES users (id)
);

CREATE TABLE court_checkins (
	id INTEGER NOT NULL, 
	court_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_court_user_checkin UNIQUE (court_id, user_id), 
	FOREIGN KEY(court_id) REFERENCES courts (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE court_favorites (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	court_id INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_user_court_fav UNIQUE (user_id, court_id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(court_id) REFERENCES courts (id)
);

CREATE TABLE courts (
	id INTEGER NOT NULL, 
	slug VARCHAR(80) NOT NULL, 
	name VARCHAR(160) NOT NULL, 
	address VARCHAR(255), 
	lat FLOAT, 
	lng FLOAT, 
	primary_sport VARCHAR(20), 
	sports VARCHAR(120), 
	court_count INTEGER, 
	surface VARCHAR(120), 
	lights BOOLEAN, 
	is_active BOOLEAN DEFAULT '1' NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (slug)
);

CREATE TABLE game_invites (
	id INTEGER NOT NULL, 
	inviter_id INTEGER NOT NULL, 
	invitee_id INTEGER NOT NULL, 
	sport VARCHAR(20) NOT NULL, 
	court_id INTEGER, 
	phase VARCHAR(24) NOT NULL, 
	note TEXT, 
	decline_reason VARCHAR(200), 
	session_id INTEGER, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(inviter_id) REFERENCES users (id), 
	FOREIGN KEY(invitee_id) REFERENCES users (id), 
	FOREIGN KEY(court_id) REFERENCES courts (id), 
	FOREIGN KEY(session_id) REFERENCES sessions (id)
);

CREATE TABLE saved_players (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	player_id INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_user_saved_player UNIQUE (user_id, player_id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(player_id) REFERENCES users (id)
);

CREATE TABLE sessions (
	id INTEGER NOT NULL, 
	host_id INTEGER NOT NULL, 
	guest_id INTEGER NOT NULL, 
	court_id INTEGER, 
	sport VARCHAR(20) NOT NULL, 
	scheduled_at DATETIME NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	note TEXT, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(host_id) REFERENCES users (id), 
	FOREIGN KEY(guest_id) REFERENCES users (id), 
	FOREIGN KEY(court_id) REFERENCES courts (id)
);

CREATE TABLE sport_profiles (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	sport VARCHAR(20) NOT NULL, 
	ntrp VARCHAR(4) NOT NULL, 
	availability_summary VARCHAR(200), 
	home_court_id INTEGER, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_user_sport UNIQUE (user_id, sport), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(home_court_id) REFERENCES courts (id)
);

CREATE TABLE support_tickets (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	message TEXT NOT NULL, 
	history_json TEXT, 
	status VARCHAR(16) DEFAULT 'open' NOT NULL, 
	created_at DATETIME, 
	resolved_at DATETIME, 
	resolved_by_id INTEGER, 
	resolution_note TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(resolved_by_id) REFERENCES users (id)
);

CREATE TABLE time_proposals (
	id INTEGER NOT NULL, 
	invite_id INTEGER NOT NULL, 
	proposed_by_id INTEGER NOT NULL, 
	start_at DATETIME NOT NULL, 
	end_at DATETIME, 
	status VARCHAR(16) NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(invite_id) REFERENCES game_invites (id), 
	FOREIGN KEY(proposed_by_id) REFERENCES users (id)
);

CREATE TABLE user_reports (
	id INTEGER NOT NULL, 
	reporter_id INTEGER NOT NULL, 
	reported_id INTEGER NOT NULL, 
	reason VARCHAR(32) NOT NULL, 
	details TEXT, 
	status VARCHAR(16) DEFAULT 'open' NOT NULL, 
	created_at DATETIME, 
	resolved_at DATETIME, 
	resolved_by_id INTEGER, 
	resolution_note TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(reporter_id) REFERENCES users (id), 
	FOREIGN KEY(reported_id) REFERENCES users (id), 
	FOREIGN KEY(resolved_by_id) REFERENCES users (id)
);

CREATE TABLE users (
	id INTEGER NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	token_version INTEGER DEFAULT '1' NOT NULL, 
	email_verified BOOLEAN DEFAULT '0' NOT NULL, 
	is_admin BOOLEAN DEFAULT '0' NOT NULL, 
	is_active BOOLEAN DEFAULT '1' NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	handle VARCHAR(80) NOT NULL, 
	location VARCHAR(120), 
	lat FLOAT, 
	lng FLOAT, 
	bio TEXT, 
	bio_embedding TEXT, 
	primary_sport VARCHAR(20), 
	avatar_color VARCHAR(120), 
	avatar_fg VARCHAR(20), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	UNIQUE (handle)
);

