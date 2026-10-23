require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const pool = require("./db");

if (!process.env.JWT_SECRET) {
    console.error("FATAL: JWT_SECRET environment variable is missing.");
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

app.get("/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        return res.status(200).json({ status: "ok" });
    } catch (err) {
        return res.status(503).json({ status: "error", error: "Database unreachable" });
    }
});

// ─── Formatters & Helpers ───────────────────────────────────────────────────

function formatUser(row) {
    if (!row) return null;
    return {
        id: String(row.id),
        name: row.name,
        firstName: row.first_name || (row.name ? row.name.split(" ")[0] : ""),
        email: row.email,
        avatar: row.avatar || undefined,
        avatarColor: row.avatar_color || "#FF5C3A",
        bio: row.bio || "",
        phone: row.phone || "",
        relationship: row.relationship || "friend",
        accountabilityLevel: row.accountability_level || "trust",
        privacy: row.privacy || {
            showCompletedTasks: true,
            showExactTimes: true,
            showMedicationNames: true,
            shareHistory: true,
            requireProof: false
        },
        notificationPrefs: row.notification_prefs || {
            enabled: true,
            reminderInterval: 15,
            quietHoursStart: "22:00",
            quietHoursEnd: "07:00",
            sounds: true,
            vibration: true
        },
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    };
}

function formatConnection(row) {
    if (!row) return null;
    return {
        id: String(row.id),
        userId: String(row.user_id),
        contactUserId: row.contact_user_id ? String(row.contact_user_id) : undefined,
        name: row.name,
        firstName: row.first_name || (row.name ? row.name.split(" ")[0] : ""),
        email: row.email || "",
        phone: row.phone || "",
        avatar: row.avatar || undefined,
        avatarColor: row.avatar_color || "#FF5C3A",
        relationship: row.relationship || "friend",
        accountabilityLevel: row.accountability_level || "trust",
        status: row.status || "active",
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    };
}

function formatNudge(row) {
    if (!row) return null;
    return {
        id: String(row.id),
        creatorId: String(row.creator_id),
        receiverId: String(row.receiver_id || row.creator_id),
        category: row.category,
        emoji: row.emoji,
        title: row.title,
        description: row.description || "",
        scheduledTime: row.scheduled_time ? new Date(row.scheduled_time).toISOString() : new Date().toISOString(),
        repeat: row.repeat || "daily",
        reminderInterval: isNaN(Number(row.reminder_interval)) ? row.reminder_interval : Number(row.reminder_interval),
        stopWhen: row.stop_when || "completed",
        maxReminders: row.max_reminders !== null ? Number(row.max_reminders) : 3,
        status: row.status || "pending",
        proofType: row.proof_type || "tap",
        accountabilityLevel: row.accountability_level || "trust",
        completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
        snoozedUntil: row.snoozed_until ? new Date(row.snoozed_until).toISOString() : undefined,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    };
}

function formatHistory(row) {
    if (!row) return null;
    return {
        id: String(row.id),
        nudgeId: row.nudge_id ? String(row.nudge_id) : `nudge-legacy-${row.id}`,
        nudge: {
            title: row.title,
            emoji: row.emoji || "📌",
            category: row.category || "custom"
        },
        personId: String(row.person_id),
        personName: row.person_name || "Loved one",
        date: row.date ? (typeof row.date === "string" ? row.date.split("T")[0] : new Date(row.date).toISOString().split("T")[0]) : new Date().toISOString().split("T")[0],
        completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
        status: row.status || "completed",
        note: row.note || undefined,
        proofType: row.proof_type || "tap",
        proofUrl: row.proof_url || undefined
    };
}

function formatNotification(row) {
    if (!row) return null;
    return {
        id: String(row.id),
        type: row.type || "reminder",
        title: row.title,
        body: row.body,
        personId: row.person_id ? String(row.person_id) : undefined,
        nudgeId: row.nudge_id ? String(row.nudge_id) : undefined,
        emoji: row.emoji || "🔔",
        read: Boolean(row.read),
        timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    };
}

function formatCheer(row) {
    if (!row) return null;
    return {
        id: String(row.id),
        personId: String(row.person_id),
        senderId: String(row.sender_id),
        emoji: row.emoji,
        message: row.message,
        timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    };
}

function formatMedication(row) {
    if (!row) return null;
    return {
        id: String(row.id),
        personId: String(row.person_id),
        name: row.name,
        dosage: row.dosage,
        form: row.form || "tablet",
        color: row.color || "#FF5C3A",
        instructions: row.instructions || "",
        frequency: row.frequency || "once_daily",
        times: Array.isArray(row.times) ? row.times : ["08:00"],
        currentSupply: Number(row.current_supply || 0),
        totalCapacity: Number(row.total_capacity || 30),
        lowSupplyThreshold: Number(row.low_supply_threshold || 5),
        unit: row.unit || "pills",
        refillDate: row.refill_date ? (typeof row.refill_date === "string" ? row.refill_date.split("T")[0] : new Date(row.refill_date).toISOString().split("T")[0]) : undefined,
        prescribingDoctor: row.prescribing_doctor || undefined,
        pharmacy: row.pharmacy || undefined,
        rxNumber: row.rx_number || undefined,
        isActive: Boolean(row.is_active),
        adherenceRate: Number(row.adherence_rate !== null ? row.adherence_rate : 100),
        lastTakenAt: row.last_taken_at ? new Date(row.last_taken_at).toISOString() : undefined,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    };
}

function formatMedicationLog(row) {
    if (!row) return null;
    return {
        id: String(row.id),
        medicationId: String(row.medication_id),
        personId: String(row.person_id),
        takenAt: row.taken_at ? new Date(row.taken_at).toISOString() : new Date().toISOString(),
        status: row.status || "taken",
        notes: row.notes || undefined
    };
}

// ─── Middleware ─────────────────────────────────────────────────────────────

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ error: "Access token required" });
    }
    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) {
            return res.status(403).json({ error: "Invalid or expired token" });
        }
        req.user = decodedUser;
        next();
    });
};

const authenticateOptionalToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
        return next();
    }
    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (!err && decodedUser) {
            req.user = decodedUser;
        }
        next();
    });
};

// ─── Health & Test ──────────────────────────────────────────────────────────


app.get("/db-test", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({ message: "database connected", time: result.rows[0] });
    } catch (error) {
        console.error("DB Test Error:", error);
        res.status(500).json({ message: "database connection failed", error: error.message });
    }
});

// ─── Authentication & User Profile ──────────────────────────────────────────

app.post("/signup", async (req, res) => {
    const { name, email, password, firstName, phone, avatarColor, relationship } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "name, email and password are required" });
    }
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const derivedFirstName = firstName || name.split(" ")[0];

        const newUser = await pool.query(
            `INSERT INTO users (name, first_name, email, password, phone, avatar_color, relationship)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [name.trim(), derivedFirstName, email.toLowerCase().trim(), hashedPassword, phone || null, avatarColor || "#FF5C3A", relationship || "friend"]
        );

        const userObj = formatUser(newUser.rows[0]);
        const token = jwt.sign({ id: newUser.rows[0].id, email: userObj.email }, JWT_SECRET, { expiresIn: "30d" });

        return res.status(201).json({
            message: "User registered successfully",
            token,
            user: userObj
        });
    } catch (error) {
        console.error("Signup error:", error);
        if (error.code === "23505") {
            return res.status(400).json({ error: "Email already exists" });
        }
        return res.status(500).json({ error: "User registration failed", details: error.message });
    }
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Both email and password are required" });
    }
    try {
        const checkUser = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [email.trim()]);
        if (checkUser.rows.length === 0) {
            return res.status(400).json({ error: "User not found" });
        }
        const userRow = checkUser.rows[0];
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, userRow.password);
        } catch {
            isMatch = false;
        }



        if (!isMatch) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        const userObj = formatUser(userRow);
        const token = jwt.sign({ id: userRow.id, email: userObj.email }, JWT_SECRET, { expiresIn: "30d" });

        return res.status(200).json({
            message: "User logged in successfully",
            token,
            user: userObj
        });
    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ error: "User login failed", details: err.message });
    }
});

app.post("/logout", (req, res) => {
    res.json({ message: "Logged out successfully" });
});

app.get("/me", authenticateToken, async (req, res) => {
    try {
        const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.status(200).json({ user: formatUser(userResult.rows[0]) });
    } catch (err) {
        console.error("Get /me error:", err);
        return res.status(500).json({ error: "Failed to retrieve user profile" });
    }
});

app.patch("/users/me", authenticateToken, async (req, res) => {
    try {
        const { name, firstName, avatar, avatarColor, bio, phone, relationship, accountabilityLevel } = req.body;
        const updates = [];
        const values = [];
        let idx = 1;

        if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name.trim()); }
        if (firstName !== undefined) { updates.push(`first_name = $${idx++}`); values.push(firstName.trim()); }
        if (avatar !== undefined) { updates.push(`avatar = $${idx++}`); values.push(avatar); }
        if (avatarColor !== undefined) { updates.push(`avatar_color = $${idx++}`); values.push(avatarColor); }
        if (bio !== undefined) { updates.push(`bio = $${idx++}`); values.push(bio); }
        if (phone !== undefined) { updates.push(`phone = $${idx++}`); values.push(phone); }
        if (relationship !== undefined) { updates.push(`relationship = $${idx++}`); values.push(relationship); }
        if (accountabilityLevel !== undefined) { updates.push(`accountability_level = $${idx++}`); values.push(accountabilityLevel); }

        if (updates.length === 0) {
            const current = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
            return res.json({ user: formatUser(current.rows[0]) });
        }

        updates.push(`updated_at = NOW()`);
        values.push(req.user.id);

        const sql = `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`;
        const updated = await pool.query(sql, values);
        return res.json({ message: "Profile updated successfully", user: formatUser(updated.rows[0]) });
    } catch (err) {
        console.error("Update profile error:", err);
        return res.status(500).json({ error: "Failed to update profile", details: err.message });
    }
});

app.patch("/users/me/privacy", authenticateToken, async (req, res) => {
    try {
        const privacy = req.body;
        const updated = await pool.query(
            "UPDATE users SET privacy = privacy || $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *",
            [JSON.stringify(privacy), req.user.id]
        );
        return res.json({ message: "Privacy updated", user: formatUser(updated.rows[0]) });
    } catch (err) {
        console.error("Update privacy error:", err);
        return res.status(500).json({ error: "Failed to update privacy settings" });
    }
});

app.patch("/users/me/notifications", authenticateToken, async (req, res) => {
    try {
        const prefs = req.body;
        const updated = await pool.query(
            "UPDATE users SET notification_prefs = notification_prefs || $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *",
            [JSON.stringify(prefs), req.user.id]
        );
        return res.json({ message: "Notification preferences updated", user: formatUser(updated.rows[0]) });
    } catch (err) {
        console.error("Update notification prefs error:", err);
        return res.status(500).json({ error: "Failed to update notification preferences" });
    }
});

app.get("/users", authenticateOptionalToken, async (req, res) => {
    try {
        const { query } = req.query;
        let users;
        if (query) {
            users = await pool.query(
                "SELECT id, name, first_name, email, avatar, avatar_color, relationship, accountability_level FROM users WHERE LOWER(name) LIKE LOWER($1) OR LOWER(email) LIKE LOWER($1) LIMIT 20",
                [`%${query}%`]
            );
        } else {
            users = await pool.query(
                "SELECT id, name, first_name, email, avatar, avatar_color, relationship, accountability_level FROM users ORDER BY name ASC LIMIT 50"
            );
        }
        return res.json({ users: users.rows.map(formatUser) });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch users" });
    }
});

// ─── Connections & Accountability Circle ───────────────────────────────────

app.get("/connections", authenticateOptionalToken, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : (req.query.userId || req.query.user_id || 1);
        const result = await pool.query(
            "SELECT * FROM connections WHERE user_id = $1 ORDER BY created_at ASC",
            [userId]
        );
        return res.json({ connections: result.rows.map(formatConnection) });
    } catch (err) {
        console.error("Get connections error:", err);
        return res.status(500).json({ error: "Failed to fetch circle connections" });
    }
});

app.post("/connections", authenticateOptionalToken, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : (req.body.userId || req.body.user_id || 1);
        const { contactUserId, contact_user_id, name, firstName, email, phone, avatar, avatarColor, relationship = "friend", accountabilityLevel = "trust" } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Name is required" });
        }

        const derivedFirstName = firstName || name.split(" ")[0];
        const finalContactUserId = contactUserId || contact_user_id || null;

        const result = await pool.query(
            `INSERT INTO connections (user_id, contact_user_id, name, first_name, email, phone, avatar, avatar_color, relationship, accountability_level)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [userId, finalContactUserId, name.trim(), derivedFirstName, email || null, phone || null, avatar || null, avatarColor || "#FF5C3A", relationship, accountabilityLevel]
        );

        return res.status(201).json({
            message: "Added person to accountability circle",
            connection: formatConnection(result.rows[0])
        });
    } catch (err) {
        console.error("Add connection error:", err);
        return res.status(500).json({ error: "Failed to add connection", details: err.message });
    }
});

app.delete("/connections/:id", authenticateOptionalToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM connections WHERE id = $1", [id]);
        return res.json({ message: "Connection removed successfully" });
    } catch (err) {
        return res.status(500).json({ error: "Failed to remove connection" });
    }
});

// ─── Nudges ─────────────────────────────────────────────────────────────────

const createNudgeHandler = async (req, res) => {
    try {
        const creatorId = req.user ? req.user.id : (req.body.creator_id || req.body.creatorId || 1);
        const {
            receiver_id, receiverId,
            category = "custom",
            emoji,
            title,
            description,
            scheduled_time, scheduledTime,
            repeat = "daily",
            reminder_interval, reminderInterval = 15,
            stop_when, stopWhen = "completed",
            max_reminders, maxReminders = 3,
            status = "pending",
            proof_type, proofType = "tap",
            accountability_level, accountabilityLevel = "trust"
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: "Title is required" });
        }

        const finalReceiverId = receiver_id !== undefined ? receiver_id : (receiverId !== undefined ? receiverId : creatorId);
        const defaultEmojiMap = {
            medicine: "💊",
            water: "💧",
            exercise: "🏃",
            homework: "📚",
            checkin: "👋",
            custom: "📌"
        };
        const finalEmoji = emoji || defaultEmojiMap[category] || "📌";
        const finalScheduledTime = scheduled_time || scheduledTime || new Date();
        const finalReminderInterval = String(reminder_interval !== undefined ? reminder_interval : reminderInterval);
        const finalStopWhen = stop_when || stopWhen;
        const finalMaxReminders = max_reminders !== undefined ? max_reminders : maxReminders;
        const finalProofType = proof_type || proofType;
        const finalAccountabilityLevel = accountability_level || accountabilityLevel;

        const newNudge = await pool.query(
            `INSERT INTO nudges (
                creator_id, receiver_id, category, emoji, title, description,
                scheduled_time, repeat, reminder_interval, stop_when, max_reminders,
                status, proof_type, accountability_level
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *`,
            [
                creatorId, finalReceiverId, category, finalEmoji, title.trim(),
                description || null, finalScheduledTime, repeat, finalReminderInterval,
                finalStopWhen, finalMaxReminders, status, finalProofType, finalAccountabilityLevel
            ]
        );

        // Also create notification if sent to someone else
        if (String(finalReceiverId) !== String(creatorId)) {
            await pool.query(
                `INSERT INTO notifications (user_id, type, title, body, person_id, nudge_id, emoji)
                 VALUES ($1, 'nudge', $2, $3, $4, $5, $6)`,
                [
                    finalReceiverId,
                    `New Nudge: ${title.trim()}`,
                    `Scheduled for ${new Date(finalScheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                    creatorId,
                    newNudge.rows[0].id,
                    finalEmoji
                ]
            ).catch(err => console.error("Notification trigger error:", err.message));
        }

        return res.status(201).json({
            message: "Nudge created successfully",
            nudge: formatNudge(newNudge.rows[0])
        });
    } catch (error) {
        console.error("Create nudge error:", error);
        return res.status(500).json({ error: "Failed to create nudge", details: error.message });
    }
};

app.post("/create-nudges", authenticateOptionalToken, createNudgeHandler);
app.post("/nudges", authenticateOptionalToken, createNudgeHandler);

app.get("/nudges", authenticateOptionalToken, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : (req.query.user_id || req.query.userId);
        const { category, status } = req.query;

        let query = "SELECT * FROM nudges WHERE 1=1";
        const params = [];
        let idx = 1;

        if (userId) {
            query += ` AND (creator_id = $${idx} OR receiver_id = $${idx})`;
            params.push(userId);
            idx++;
        }
        if (category) {
            query += ` AND category = $${idx}`;
            params.push(category);
            idx++;
        }
        if (status) {
            query += ` AND status = $${idx}`;
            params.push(status);
            idx++;
        }

        query += " ORDER BY scheduled_time ASC, created_at DESC";
        const result = await pool.query(query, params);
        return res.status(200).json({ nudges: result.rows.map(formatNudge) });
    } catch (error) {
        console.error("Get nudges error:", error);
        return res.status(500).json({ error: "Failed to fetch nudges", details: error.message });
    }
});

app.get("/nudges/:id", authenticateOptionalToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("SELECT * FROM nudges WHERE id = $1", [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Nudge not found" });
        }
        return res.json({ nudge: formatNudge(result.rows[0]) });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch nudge" });
    }
});

app.patch("/nudges/:id", authenticateOptionalToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const fields = [];
        const values = [];
        let idx = 1;

        const allowedMap = {
            title: "title",
            description: "description",
            category: "category",
            emoji: "emoji",
            repeat: "repeat",
            status: "status",
            scheduledTime: "scheduled_time",
            scheduled_time: "scheduled_time",
            reminderInterval: "reminder_interval",
            reminder_interval: "reminder_interval",
            stopWhen: "stop_when",
            stop_when: "stop_when",
            maxReminders: "max_reminders",
            max_reminders: "max_reminders",
            proofType: "proof_type",
            proof_type: "proof_type",
            accountabilityLevel: "accountability_level",
            accountability_level: "accountability_level",
            completedAt: "completed_at",
            completed_at: "completed_at",
            snoozedUntil: "snoozed_until",
            snoozed_until: "snoozed_until"
        };

        for (const [key, val] of Object.entries(updates)) {
            const col = allowedMap[key];
            if (col) {
                fields.push(`${col} = $${idx++}`);
                values.push(val);
            }
        }

        if (fields.length === 0) {
            const row = await pool.query("SELECT * FROM nudges WHERE id = $1", [id]);
            return res.json({ nudge: formatNudge(row.rows[0]) });
        }

        fields.push("updated_at = NOW()");
        values.push(id);

        const sql = `UPDATE nudges SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`;
        const result = await pool.query(sql, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Nudge not found" });
        }

        return res.json({ message: "Nudge updated", nudge: formatNudge(result.rows[0]) });
    } catch (err) {
        console.error("Update nudge error:", err);
        return res.status(500).json({ error: "Failed to update nudge", details: err.message });
    }
});

app.delete("/nudges/:id", authenticateOptionalToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM nudges WHERE id = $1", [id]);
        return res.json({ message: "Nudge deleted successfully" });
    } catch (err) {
        return res.status(500).json({ error: "Failed to delete nudge" });
    }
});

app.post("/nudges/:id/complete", authenticateOptionalToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { note, proof, proofUrl } = req.body;
        const now = new Date();

        const nudgeRes = await pool.query(
            "UPDATE nudges SET status = 'completed', completed_at = $1, updated_at = $1 WHERE id = $2 RETURNING *",
            [now, id]
        );

        if (nudgeRes.rows.length === 0) {
            return res.status(404).json({ error: "Nudge not found" });
        }

        const nudge = nudgeRes.rows[0];

        // Fetch receiver name
        const receiverRes = await pool.query("SELECT name FROM users WHERE id = $1", [nudge.receiver_id]);
        const receiverName = receiverRes.rows[0] ? receiverRes.rows[0].name : "Loved one";

        // Insert into nudge_history
        await pool.query(
            `INSERT INTO nudge_history (nudge_id, person_id, person_name, title, emoji, category, date, completed_at, status, note, proof_type, proof_url)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, 'completed', $8, $9, $10)`,
            [nudge.id, nudge.receiver_id, receiverName, nudge.title, nudge.emoji, nudge.category, now, note || null, nudge.proof_type, proof || proofUrl || null]
        );

        // If category is medicine, decrement supply in Care Cabinet if match exists
        if (nudge.category === "medicine") {
            await pool.query(
                `UPDATE medications
                 SET current_supply = GREATEST(0, current_supply - 1), last_taken_at = $1, updated_at = $1
                 WHERE person_id = $2 AND LOWER(name) LIKE LOWER($3)`,
                [now, nudge.receiver_id, `%${nudge.title.replace(/take/i, "").trim()}%`]
            ).catch(err => console.error("Medicine sync warning:", err.message));
        }

        // Add notification for creator if creator != receiver
        if (nudge.creator_id !== nudge.receiver_id) {
            await pool.query(
                `INSERT INTO notifications (user_id, type, title, body, person_id, nudge_id, emoji)
                 VALUES ($1, 'completed', $2, $3, $4, $5, $6)`,
                [
                    nudge.creator_id,
                    `${receiverName} completed ${nudge.title}`,
                    `Marked as done at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                    nudge.receiver_id,
                    nudge.id,
                    nudge.emoji
                ]
            );
        }

        return res.json({
            message: "Nudge completed successfully",
            nudge: formatNudge(nudge)
        });
    } catch (err) {
        console.error("Complete nudge error:", err);
        return res.status(500).json({ error: "Failed to complete nudge", details: err.message });
    }
});

app.post("/nudges/:id/snooze", authenticateOptionalToken, async (req, res) => {
    try {
        const { id } = req.params;
        const minutes = Number(req.body.minutes || 15);
        const snoozeDate = new Date(Date.now() + minutes * 60 * 1000);

        const result = await pool.query(
            "UPDATE nudges SET status = 'snoozed', snoozed_until = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
            [snoozeDate, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Nudge not found" });
        }

        return res.json({
            message: `Nudge snoozed for ${minutes} minutes`,
            nudge: formatNudge(result.rows[0])
        });
    } catch (err) {
        return res.status(500).json({ error: "Failed to snooze nudge" });
    }
});

// ─── History ────────────────────────────────────────────────────────────────

app.get("/history", authenticateOptionalToken, async (req, res) => {
    try {
        const { personId, person_id, nudgeId, nudge_id, date } = req.query;
        let query = "SELECT * FROM nudge_history WHERE 1=1";
        const params = [];
        let idx = 1;

        const targetPersonId = personId || person_id;
        if (targetPersonId) {
            query += ` AND person_id = $${idx++}`;
            params.push(targetPersonId);
        }

        const targetNudgeId = nudgeId || nudge_id;
        if (targetNudgeId) {
            query += ` AND nudge_id = $${idx++}`;
            params.push(targetNudgeId);
        }

        if (date) {
            query += ` AND date = $${idx++}`;
            params.push(date);
        }

        query += " ORDER BY completed_at DESC, created_at DESC LIMIT 100";
        const result = await pool.query(query, params);
        return res.json({ history: result.rows.map(formatHistory) });
    } catch (err) {
        console.error("Get history error:", err);
        return res.status(500).json({ error: "Failed to fetch history" });
    }
});

app.post("/history", authenticateOptionalToken, async (req, res) => {
    try {
        const { nudgeId, nudge_id, personId, person_id, personName, title, emoji = "📌", category = "custom", date, status = "completed", note, proofType = "tap", proofUrl } = req.body;
        const targetPersonId = personId || person_id || 1;
        const targetNudgeId = nudgeId || nudge_id || null;

        const result = await pool.query(
            `INSERT INTO nudge_history (nudge_id, person_id, person_name, title, emoji, category, date, completed_at, status, note, proof_type, proof_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11)
             RETURNING *`,
            [targetNudgeId, targetPersonId, personName || "Loved one", title || "Task", emoji, category, date || new Date().toISOString().split("T")[0], status, note || null, proofType, proofUrl || null]
        );

        return res.status(201).json({ history: formatHistory(result.rows[0]) });
    } catch (err) {
        return res.status(500).json({ error: "Failed to add history entry", details: err.message });
    }
});

// ─── Notifications ──────────────────────────────────────────────────────────

app.get("/notifications", authenticateOptionalToken, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : (req.query.userId || req.query.user_id || 1);
        const { unreadOnly } = req.query;

        let query = "SELECT * FROM notifications WHERE user_id = $1";
        const params = [userId];
        if (unreadOnly === "true") {
            query += " AND read = FALSE";
        }
        query += " ORDER BY created_at DESC LIMIT 50";

        const result = await pool.query(query, params);
        return res.json({ notifications: result.rows.map(formatNotification) });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch notifications" });
    }
});

app.patch("/notifications/:id/read", authenticateOptionalToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("UPDATE notifications SET read = TRUE WHERE id = $1", [id]);
        return res.json({ message: "Notification marked as read" });
    } catch (err) {
        return res.status(500).json({ error: "Failed to update notification" });
    }
});

app.post("/notifications/read-all", authenticateOptionalToken, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : (req.body.userId || req.body.user_id || 1);
        await pool.query("UPDATE notifications SET read = TRUE WHERE user_id = $1", [userId]);
        return res.json({ message: "All notifications marked as read" });
    } catch (err) {
        return res.status(500).json({ error: "Failed to mark all notifications read" });
    }
});

app.post("/notifications", authenticateOptionalToken, async (req, res) => {
    try {
        const { userId, user_id, type = "system", title, body, personId, nudgeId, emoji = "🔔" } = req.body;
        const targetUserId = userId || user_id || (req.user ? req.user.id : 1);

        const result = await pool.query(
            `INSERT INTO notifications (user_id, type, title, body, person_id, nudge_id, emoji)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [targetUserId, type, title, body, personId || null, nudgeId || null, emoji]
        );

        return res.status(201).json({ notification: formatNotification(result.rows[0]) });
    } catch (err) {
        return res.status(500).json({ error: "Failed to create notification" });
    }
});

// ─── Cheers ─────────────────────────────────────────────────────────────────

app.get("/cheers", authenticateOptionalToken, async (req, res) => {
    try {
        const { personId, person_id } = req.query;
        let query = "SELECT * FROM cheers";
        const params = [];
        if (personId || person_id) {
            query += " WHERE person_id = $1";
            params.push(personId || person_id);
        }
        query += " ORDER BY created_at DESC LIMIT 50";
        const result = await pool.query(query, params);
        return res.json({ cheers: result.rows.map(formatCheer) });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch cheers" });
    }
});

app.post("/cheers", authenticateOptionalToken, async (req, res) => {
    try {
        const senderId = req.user ? req.user.id : (req.body.senderId || req.body.sender_id || 1);
        const { personId, person_id, emoji = "🎉", message } = req.body;
        const targetPersonId = personId || person_id;

        if (!targetPersonId || !message) {
            return res.status(400).json({ error: "personId and message are required" });
        }

        const cheerResult = await pool.query(
            `INSERT INTO cheers (person_id, sender_id, emoji, message)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [targetPersonId, senderId, emoji, message.trim()]
        );

        // Add notification for recipient
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, body, person_id, emoji)
             VALUES ($1, 'system', $2, $3, $4, $5)`,
            [
                targetPersonId,
                `Received cheer ${emoji}`,
                message.trim(),
                senderId,
                emoji
            ]
        ).catch(err => console.error("Cheer notification error:", err.message));

        return res.status(201).json({ cheer: formatCheer(cheerResult.rows[0]) });
    } catch (err) {
        return res.status(500).json({ error: "Failed to send cheer", details: err.message });
    }
});

// ─── Care Cabinet & Medications ─────────────────────────────────────────────

app.get("/medications", authenticateOptionalToken, async (req, res) => {
    try {
        const { personId, person_id } = req.query;
        let query = "SELECT * FROM medications WHERE 1=1";
        const params = [];

        const targetPersonId = personId || person_id;
        if (targetPersonId) {
            query += " AND person_id = $1";
            params.push(targetPersonId);
        }
        query += " ORDER BY is_active DESC, created_at DESC";

        const result = await pool.query(query, params);
        return res.json({ medications: result.rows.map(formatMedication) });
    } catch (err) {
        console.error("Get medications error:", err);
        return res.status(500).json({ error: "Failed to fetch medications" });
    }
});

app.post("/medications", authenticateOptionalToken, async (req, res) => {
    try {
        const creatorId = req.user ? req.user.id : (req.body.creatorId || 1);
        const {
            personId, person_id,
            name, dosage, form = "tablet", color = "#FF5C3A",
            instructions = "", frequency = "once_daily", times = ["08:00"],
            currentSupply = 30, current_supply,
            totalCapacity = 30, total_capacity,
            lowSupplyThreshold = 5, low_supply_threshold,
            unit = "pills", refillDate, refill_date,
            prescribingDoctor, prescribing_doctor,
            pharmacy, rxNumber, rx_number,
            autoCreateNudges = true
        } = req.body;

        if (!name || !dosage) {
            return res.status(400).json({ error: "Medication name and dosage are required" });
        }

        const finalPersonId = personId || person_id || creatorId;
        const finalSupply = current_supply !== undefined ? current_supply : currentSupply;
        const finalCapacity = total_capacity !== undefined ? total_capacity : totalCapacity;
        const finalThreshold = low_supply_threshold !== undefined ? low_supply_threshold : lowSupplyThreshold;
        const finalRefillDate = refillDate || refill_date || null;

        const result = await pool.query(
            `INSERT INTO medications (
                person_id, name, dosage, form, color, instructions, frequency, times,
                current_supply, total_capacity, low_supply_threshold, unit, refill_date,
                prescribing_doctor, pharmacy, rx_number
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *`,
            [
                finalPersonId, name.trim(), dosage.trim(), form, color, instructions,
                frequency, times, finalSupply, finalCapacity, finalThreshold,
                unit, finalRefillDate, prescribingDoctor || prescribing_doctor || null,
                pharmacy || null, rxNumber || rx_number || null
            ]
        );

        const newMed = result.rows[0];

        // Optionally auto-create daily medicine nudges
        if (autoCreateNudges && Array.isArray(times) && times.length > 0) {
            for (const timeStr of times) {
                const parts = timeStr.split(":");
                const h = parseInt(parts[0], 10) || 8;
                const m = parseInt(parts[1], 10) || 0;
                const sched = new Date();
                sched.setHours(h, m, 0, 0);

                await pool.query(
                    `INSERT INTO nudges (
                        creator_id, receiver_id, category, emoji, title, description,
                        scheduled_time, repeat, reminder_interval, stop_when, status, proof_type, accountability_level
                    ) VALUES ($1, $2, 'medicine', '💊', $3, $4, $5, 'daily', '15', 'completed', 'pending', 'tap', 'checkin')`,
                    [
                        creatorId, finalPersonId,
                        `Take ${name.trim()} (${dosage.trim()})`,
                        instructions || "Care Cabinet medication dose",
                        sched
                    ]
                ).catch(err => console.error("Auto nudge error:", err.message));
            }
        }

        return res.status(201).json({
            message: "Medication added to Care Cabinet",
            medication: formatMedication(newMed)
        });
    } catch (err) {
        console.error("Add medication error:", err);
        return res.status(500).json({ error: "Failed to create medication", details: err.message });
    }
});

app.patch("/medications/:id", authenticateOptionalToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const fields = [];
        const values = [];
        let idx = 1;

        const allowedMap = {
            name: "name",
            dosage: "dosage",
            form: "form",
            color: "color",
            instructions: "instructions",
            frequency: "frequency",
            times: "times",
            currentSupply: "current_supply",
            current_supply: "current_supply",
            totalCapacity: "total_capacity",
            total_capacity: "total_capacity",
            lowSupplyThreshold: "low_supply_threshold",
            low_supply_threshold: "low_supply_threshold",
            unit: "unit",
            refillDate: "refill_date",
            refill_date: "refill_date",
            prescribingDoctor: "prescribing_doctor",
            prescribing_doctor: "prescribing_doctor",
            pharmacy: "pharmacy",
            rxNumber: "rx_number",
            rx_number: "rx_number",
            isActive: "is_active",
            is_active: "is_active",
            adherenceRate: "adherence_rate",
            adherence_rate: "adherence_rate"
        };

        for (const [key, val] of Object.entries(updates)) {
            const col = allowedMap[key];
            if (col) {
                fields.push(`${col} = $${idx++}`);
                values.push(val);
            }
        }

        if (fields.length === 0) {
            const row = await pool.query("SELECT * FROM medications WHERE id = $1", [id]);
            return res.json({ medication: formatMedication(row.rows[0]) });
        }

        fields.push("updated_at = NOW()");
        values.push(id);

        const sql = `UPDATE medications SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`;
        const result = await pool.query(sql, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Medication not found" });
        }

        return res.json({ message: "Medication updated", medication: formatMedication(result.rows[0]) });
    } catch (err) {
        return res.status(500).json({ error: "Failed to update medication", details: err.message });
    }
});

app.delete("/medications/:id", authenticateOptionalToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM medications WHERE id = $1", [id]);
        return res.json({ message: "Medication deleted successfully" });
    } catch (err) {
        return res.status(500).json({ error: "Failed to delete medication" });
    }
});

app.post("/medications/:id/take", authenticateOptionalToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status = "taken", note } = req.body;
        const now = new Date();

        const medResult = await pool.query("SELECT * FROM medications WHERE id = $1", [id]);
        if (medResult.rows.length === 0) {
            return res.status(404).json({ error: "Medication not found" });
        }
        const med = medResult.rows[0];

        const newSupply = status === "taken" ? Math.max(0, med.current_supply - 1) : med.current_supply;
        const updatedMed = await pool.query(
            "UPDATE medications SET current_supply = $1, last_taken_at = $2, updated_at = $2 WHERE id = $3 RETURNING *",
            [newSupply, now, id]
        );

        // Record in medication_logs
        const logResult = await pool.query(
            `INSERT INTO medication_logs (medication_id, person_id, taken_at, status, notes)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [id, med.person_id, now, status, note || (status === "taken" ? "Dose recorded via Care Cabinet" : "Dose skipped")]
        );

        // Record in nudge_history
        await pool.query(
            `INSERT INTO nudge_history (nudge_id, person_id, person_name, title, emoji, category, date, completed_at, status, note)
             VALUES (NULL, $1, 'Loved one', $2, '💊', 'medicine', CURRENT_DATE, $3, $4, $5)`,
            [
                med.person_id,
                `${med.name} (${med.dosage})`,
                now,
                status === "taken" ? "completed" : "missed",
                note || `Logged ${status} in Care Cabinet`
            ]
        );

        return res.json({
            message: `Dose recorded as ${status}`,
            medication: formatMedication(updatedMed.rows[0]),
            log: formatMedicationLog(logResult.rows[0])
        });
    } catch (err) {
        console.error("Take dose error:", err);
        return res.status(500).json({ error: "Failed to record dose", details: err.message });
    }
});

app.post("/medications/:id/refill", authenticateOptionalToken, async (req, res) => {
    try {
        const { id } = req.params;
        const addedUnits = Number(req.body.addedUnits || req.body.added_units || 30);

        const medResult = await pool.query("SELECT * FROM medications WHERE id = $1", [id]);
        if (medResult.rows.length === 0) {
            return res.status(404).json({ error: "Medication not found" });
        }
        const med = medResult.rows[0];

        const updatedSupply = med.current_supply + addedUnits;
        const updatedCapacity = Math.max(med.total_capacity, updatedSupply);

        const nextRefillDate = new Date();
        nextRefillDate.setDate(nextRefillDate.getDate() + 30);

        const updated = await pool.query(
            `UPDATE medications
             SET current_supply = $1, total_capacity = $2, refill_date = $3, updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [updatedSupply, updatedCapacity, nextRefillDate, id]
        );

        return res.json({
            message: `Refilled +${addedUnits} ${med.unit}`,
            medication: formatMedication(updated.rows[0])
        });
    } catch (err) {
        return res.status(500).json({ error: "Failed to refill medication" });
    }
});

app.get("/medications/logs", authenticateOptionalToken, async (req, res) => {
    try {
        const { medicationId, medication_id, personId, person_id } = req.query;
        let query = "SELECT * FROM medication_logs WHERE 1=1";
        const params = [];
        let idx = 1;

        const targetMedId = medicationId || medication_id;
        if (targetMedId) {
            query += ` AND medication_id = $${idx++}`;
            params.push(targetMedId);
        }

        const targetPersonId = personId || person_id;
        if (targetPersonId) {
            query += ` AND person_id = $${idx++}`;
            params.push(targetPersonId);
        }

        query += " ORDER BY taken_at DESC LIMIT 100";
        const result = await pool.query(query, params);
        return res.json({ logs: result.rows.map(formatMedicationLog) });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch medication logs" });
    }
});

// ─── Care Routines Bulk Scheduler ───────────────────────────────────────────

app.post("/routines/apply", authenticateOptionalToken, async (req, res) => {
    try {
        const creatorId = req.user ? req.user.id : (req.body.creatorId || 1);
        const { receiverId, receiver_id, templateTitle, items = [] } = req.body;
        const finalReceiverId = receiverId || receiver_id || creatorId;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Routine items are required" });
        }

        const createdNudges = [];
        for (const item of items) {
            const sched = new Date();
            if (item.scheduledTimeOffsetHours !== undefined) {
                const hours = Math.floor(item.scheduledTimeOffsetHours);
                const minutes = Math.round((item.scheduledTimeOffsetHours - hours) * 60);
                sched.setHours(hours, minutes, 0, 0);
            }

            const r = await pool.query(
                `INSERT INTO nudges (
                    creator_id, receiver_id, category, emoji, title, description,
                    scheduled_time, repeat, reminder_interval, stop_when, status, proof_type, accountability_level
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed', 'pending', $10, $11)
                RETURNING *`,
                [
                    creatorId,
                    finalReceiverId,
                    item.category || "custom",
                    item.emoji || "📌",
                    item.title,
                    item.description || null,
                    sched,
                    item.repeat || "daily",
                    String(item.reminderInterval || "15"),
                    item.proofType || "tap",
                    item.accountabilityLevel || "trust"
                ]
            );
            createdNudges.push(formatNudge(r.rows[0]));
        }

        return res.status(201).json({
            message: `Applied routine template: ${templateTitle || "Care Routine"}`,
            count: createdNudges.length,
            nudges: createdNudges
        });
    } catch (err) {
        console.error("Apply routine error:", err);
        return res.status(500).json({ error: "Failed to apply routine", details: err.message });
    }
});

// ─── Start Server ───────────────────────────────────────────────────────────

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`CheckD server is running on port ${PORT}`);
    });
}

module.exports = app;