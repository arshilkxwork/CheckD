-- ==============================================================================
-- CheckD Database Schema
-- Complete relational schema supporting:
--   1. Users & Authentication & Personal Settings
--   2. Accountability Circle & Connections (People)
--   3. Nudges & Reminders
--   4. Nudge Completion & Activity History
--   5. In-App Notifications
--   6. Cheers & Family Encouragement
--   7. Care Cabinet & Prescription Medication Vault
--   8. Medication Dose Logs & Refill Tracking
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. USERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar VARCHAR(255),
    avatar_color VARCHAR(50) DEFAULT '#FF5C3A',
    bio TEXT,
    phone VARCHAR(50),
    relationship VARCHAR(50) DEFAULT 'friend',
    accountability_level VARCHAR(50) DEFAULT 'trust',
    privacy JSONB DEFAULT '{"showCompletedTasks": true, "showExactTimes": true, "showMedicationNames": true, "shareHistory": true, "requireProof": false}'::jsonb,
    notification_prefs JSONB DEFAULT '{"enabled": true, "reminderInterval": 15, "quietHoursStart": "22:00", "quietHoursEnd": "07:00", "sounds": true, "vibration": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Upgrade existing users table if columns are missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(50) DEFAULT '#FF5C3A';
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS relationship VARCHAR(50) DEFAULT 'friend';
ALTER TABLE users ADD COLUMN IF NOT EXISTS accountability_level VARCHAR(50) DEFAULT 'trust';
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy JSONB DEFAULT '{"showCompletedTasks": true, "showExactTimes": true, "showMedicationNames": true, "shareHistory": true, "requireProof": false}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"enabled": true, "reminderInterval": 15, "quietHoursStart": "22:00", "quietHoursEnd": "07:00", "sounds": true, "vibration": true}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ------------------------------------------------------------------------------
-- 2. CONNECTIONS TABLE (Accountability Circle / People)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    avatar VARCHAR(255),
    avatar_color VARCHAR(50) DEFAULT '#FF5C3A',
    relationship VARCHAR(50) DEFAULT 'friend',
    accountability_level VARCHAR(50) DEFAULT 'trust',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_contact_user_id ON connections(contact_user_id);

-- ------------------------------------------------------------------------------
-- 3. NUDGES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nudges (
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

CREATE INDEX IF NOT EXISTS idx_nudges_creator_id ON nudges(creator_id);
CREATE INDEX IF NOT EXISTS idx_nudges_receiver_id ON nudges(receiver_id);
CREATE INDEX IF NOT EXISTS idx_nudges_status ON nudges(status);
CREATE INDEX IF NOT EXISTS idx_nudges_scheduled_time ON nudges(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_nudges_category ON nudges(category);

-- ------------------------------------------------------------------------------
-- 4. NUDGE HISTORY TABLE (Completion Records & Activity Log)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nudge_history (
    id SERIAL PRIMARY KEY,
    nudge_id INTEGER REFERENCES nudges(id) ON DELETE SET NULL,
    person_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    person_name VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    emoji VARCHAR(10) DEFAULT '📌',
    category VARCHAR(50) DEFAULT 'custom',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    note TEXT,
    proof_type VARCHAR(50) DEFAULT 'tap',
    proof_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nudge_history_person_id ON nudge_history(person_id);
CREATE INDEX IF NOT EXISTS idx_nudge_history_nudge_id ON nudge_history(nudge_id);
CREATE INDEX IF NOT EXISTS idx_nudge_history_date ON nudge_history(date);
CREATE INDEX IF NOT EXISTS idx_nudge_history_status ON nudge_history(status);

-- ------------------------------------------------------------------------------
-- 5. NOTIFICATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'reminder',
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    person_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    nudge_id INTEGER REFERENCES nudges(id) ON DELETE SET NULL,
    emoji VARCHAR(10) DEFAULT '🔔',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- ------------------------------------------------------------------------------
-- 6. CHEERS TABLE (Family Encouragements & High Fives)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cheers (
    id SERIAL PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL DEFAULT '🎉',
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cheers_person_id ON cheers(person_id);
CREATE INDEX IF NOT EXISTS idx_cheers_sender_id ON cheers(sender_id);

-- ------------------------------------------------------------------------------
-- 7. MEDICATIONS TABLE (Care Cabinet & Prescription Vault)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medications (
    id SERIAL PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    form VARCHAR(50) DEFAULT 'tablet',
    color VARCHAR(50) DEFAULT '#FF5C3A',
    instructions TEXT,
    frequency VARCHAR(50) DEFAULT 'once_daily',
    times TEXT[] DEFAULT ARRAY['08:00']::TEXT[],
    current_supply INTEGER NOT NULL DEFAULT 30,
    total_capacity INTEGER NOT NULL DEFAULT 30,
    low_supply_threshold INTEGER NOT NULL DEFAULT 5,
    unit VARCHAR(50) DEFAULT 'pills',
    refill_date DATE,
    prescribing_doctor VARCHAR(255),
    pharmacy VARCHAR(255),
    rx_number VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    adherence_rate INTEGER DEFAULT 100,
    last_taken_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medications_person_id ON medications(person_id);
CREATE INDEX IF NOT EXISTS idx_medications_is_active ON medications(is_active);

-- ------------------------------------------------------------------------------
-- 8. MEDICATION LOGS TABLE (Dose Records)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medication_logs (
    id SERIAL PRIMARY KEY,
    medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    taken_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'taken',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medication_logs_medication_id ON medication_logs(medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_person_id ON medication_logs(person_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_taken_at ON medication_logs(taken_at);