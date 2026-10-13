const bcrypt = require("bcryptjs");
const pool = require("./db");

async function seed() {
    console.log("🌱 Seeding CheckD database...");

    try {
        const passwordHash = await bcrypt.hash("password123", 10);

        // 1. Ensure primary user Arshil exists or update
        const userRes = await pool.query(
            `INSERT INTO users (id, name, first_name, email, password, avatar_color, bio, phone, accountability_level)
             VALUES (1, 'Arshil', 'Arshil', 'arshil@example.com', $1, '#6B9E7E', 'Keeping my people healthy and happy ❤️', '+91 98765 43210', 'checkin')
             ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                first_name = EXCLUDED.first_name,
                password = EXCLUDED.password,
                avatar_color = EXCLUDED.avatar_color,
                bio = EXCLUDED.bio,
                phone = EXCLUDED.phone
             RETURNING id, name, email`,
            [passwordHash]
        );
        const arshilId = userRes.rows[0].id;
        console.log(`✅ Main User created/updated: ${userRes.rows[0].name} (ID: ${arshilId})`);

        // 2. Ensure Circle connections exist
        const connectionsData = [
            { name: "Sarah", firstName: "Sarah", email: "sarah@example.com", avatarColor: "#C2796B", relationship: "partner", level: "checkin" },
            { name: "Dad", firstName: "Dad", email: "dad@example.com", avatarColor: "#7BAE8E", relationship: "parent", level: "strict" },
            { name: "Aarav", firstName: "Aarav", email: "aarav@example.com", avatarColor: "#D4A85C", relationship: "child", level: "trust" }
        ];

        for (const conn of connectionsData) {
            await pool.query(
                `INSERT INTO connections (user_id, name, first_name, email, avatar_color, relationship, accountability_level)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT DO NOTHING`,
                [arshilId, conn.name, conn.firstName, conn.email, conn.avatarColor, conn.relationship, conn.level]
            );
        }
        console.log("✅ Accountability Circle connections seeded");

        // 3. Seed sample nudges
        const nudgesCount = await pool.query("SELECT COUNT(*) FROM nudges");
        if (Number(nudgesCount.rows[0].count) === 0) {
            const sampleNudges = [
                {
                    title: "Take Blood Pressure Meds (Amlodipine 5mg)",
                    category: "medicine",
                    emoji: "💊",
                    scheduledTime: new Date(Date.now() + 30 * 60 * 1000),
                    repeat: "daily",
                    proofType: "photo",
                    accountability: "strict"
                },
                {
                    title: "Drink a glass of water",
                    category: "water",
                    emoji: "💧",
                    scheduledTime: new Date(Date.now() + 60 * 60 * 1000),
                    repeat: "daily",
                    proofType: "tap",
                    accountability: "trust"
                },
                {
                    title: "Evening 20-min Walk",
                    category: "exercise",
                    emoji: "🏃",
                    scheduledTime: new Date(Date.now() + 5 * 3600 * 1000),
                    repeat: "daily",
                    proofType: "tap",
                    accountability: "checkin"
                }
            ];

            for (const n of sampleNudges) {
                await pool.query(
                    `INSERT INTO nudges (creator_id, receiver_id, category, emoji, title, scheduled_time, repeat, status, proof_type, accountability_level)
                     VALUES ($1, $1, $2, $3, $4, $5, $6, 'pending', $7, $8)`,
                    [arshilId, n.category, n.emoji, n.title, n.scheduledTime, n.repeat, n.proofType, n.accountability]
                );
            }
            console.log("✅ Sample nudges seeded");
        }

        // 4. Seed sample medications (Care Cabinet)
        const medCount = await pool.query("SELECT COUNT(*) FROM medications");
        if (Number(medCount.rows[0].count) === 0) {
            const meds = [
                {
                    name: "Amlodipine",
                    dosage: "5mg",
                    form: "tablet",
                    color: "#3B82F6",
                    instructions: "1 tablet with breakfast daily",
                    currentSupply: 8,
                    totalCapacity: 30,
                    lowThreshold: 5,
                    doctor: "Dr. Sharma (Cardiology)"
                },
                {
                    name: "Metformin",
                    dosage: "500mg",
                    form: "tablet",
                    color: "#10B981",
                    instructions: "1 tablet with evening meal",
                    currentSupply: 24,
                    totalCapacity: 60,
                    lowThreshold: 10,
                    doctor: "Dr. Gupta (Endocrine)"
                },
                {
                    name: "Vitamin D3",
                    dosage: "60000 IU",
                    form: "capsule",
                    color: "#F59E0B",
                    instructions: "Once weekly after food",
                    currentSupply: 3,
                    totalCapacity: 8,
                    lowThreshold: 2,
                    doctor: "Dr. Patel"
                }
            ];

            for (const m of meds) {
                await pool.query(
                    `INSERT INTO medications (person_id, name, dosage, form, color, instructions, current_supply, total_capacity, low_supply_threshold, prescribing_doctor)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [arshilId, m.name, m.dosage, m.form, m.color, m.instructions, m.currentSupply, m.totalCapacity, m.lowThreshold, m.doctor]
                );
            }
            console.log("✅ Care Cabinet medications seeded");
        }

        // 5. Seed initial cheer
        const cheersCount = await pool.query("SELECT COUNT(*) FROM cheers");
        if (Number(cheersCount.rows[0].count) === 0) {
            await pool.query(
                `INSERT INTO cheers (person_id, sender_id, emoji, message)
                 VALUES ($1, $1, '🎉', 'Super proud of your BP medicine consistency!')`,
                [arshilId]
            );
            console.log("✅ Sample cheers seeded");
        }

        console.log("🎉 Seeding completed successfully!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Seeding failed:", err);
        process.exit(1);
    }
}

seed();
