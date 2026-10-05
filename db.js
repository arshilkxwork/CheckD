const {Pool} = require("pg");

const pool = new Pool({
    user: "arshiloffcampus",
    host:"localhost",
    database:"checkd_db",
    port:5432
})
module.exports = pool