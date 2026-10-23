require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("../db");

async function hashPlaintextPasswords() {
    try {
        console.log("Searching for users with plaintext passwords...");
        const result = await pool.query(
            "SELECT id, email, password FROM users WHERE password NOT LIKE '$2%'"
        );

        if (result.rows.length === 0) {
            console.log("No plaintext passwords found.");
            await pool.end();
            return 0;
        }

        console.log(`Found ${result.rows.length} user(s) with plaintext passwords:`);
        for (const user of result.rows) {
            console.log(`- ID: ${user.id}, Email: ${user.email}`);
        }

        let updatedCount = 0;
        for (const user of result.rows) {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, user.id]);
            updatedCount++;
        }

        console.log(`Successfully hashed plaintext passwords for ${updatedCount} user(s).`);
        await pool.end();
        return updatedCount;
    } catch (err) {
        console.error("Error hashing plaintext passwords:", err);
        await pool.end();
        process.exit(1);
    }
}

if (require.main === module) {
    hashPlaintextPasswords();
}

module.exports = hashPlaintextPasswords;
