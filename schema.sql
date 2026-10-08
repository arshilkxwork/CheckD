CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE nudges (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL DEFAULT 'custom',
    emoji VARCHAR(10) NOT NULL DEFAULT '📌',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    repeat VARCHAR(50) DEFAULT 'daily',
    reminder_interval VARCHAR(20) DEFAULT '15',
    stop_when VARCHAR(50) DEFAULT 'completed',
    max_reminders INTEGER DEFAULT 3,
    status VARCHAR(50) DEFAULT 'pending',
    proof_type VARCHAR(50) DEFAULT 'tap',
    accountability_level VARCHAR(50) DEFAULT 'trust',
    completed_at TIMESTAMP WITH TIME ZONE,
    snoozed_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_nudges_creator_id ON nudges(creator_id);
CREATE INDEX idx_nudges_receiver_id ON nudges(receiver_id);