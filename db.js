require("dotenv").config();
const { Pool } = require("pg");

const poolConfig = {
    connectionString: process.env.DATABASE_URL || "postgresql://arshiloffcampus@localhost:5432/checkd_db"
};

if (process.env.DATABASE_SSL === "true") {
    poolConfig.ssl = {
        rejectUnauthorized: false
    };
}

const pool = new Pool(poolConfig);

module.exports = pool;