const express = require("express")
const jwt = require("jsonwebtoken")
const pool = require("./db")
const app = express();
const bcrypt = require("bcryptjs")

app.use(express.json())
const JWT_SECRET = "secret-password"


app.get("/db-test", async(req, res) => {
    try {
        const result = await pool.query("SELECT NOW()")
        res.json({message:"database connected",time:result.rows[0] })
    } catch (error) {
        console.log(error)
        res.status(500).json({message:"database connection failed",error:error.message})
    }
})

app.post("/signup",async (req, res) => {
    
    const { name, email, password } = req.body
    
    if (!name || !email || !password) {
        return res.status(400).json({ error: "name, email and password are required" })
    }
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password,salt)
    
    try{
    const newUser = await pool.query(
        "INSERT INTO users (name,email,password) VALUES ($1,$2,$3) RETURNING id,name,email,created_at",[name,email,hashedPassword]
    )
    return res.status(201).json({message:"user added successfully",user:newUser.rows[0]})
    }
    catch(error){
        console.log(error)
        if(error.code === '23505'){
            return res.status(400).json({error:"email already exists"})
        }
        return res.status(500).json({error:"user creation failed"})
    }   
})

app.post("/login",async(req,res)=>{
    const {email,password} = req.body
    if (!email || !password ){
        return res.status(400).json({message:"Both Email and Password are required"})
    }
   

    try{
        const checkEmail = await pool.query("SELECT * FROM users WHERE email =$1",[email])
        if (checkEmail.rows.length === 0) {return res.status(400).json({message:"User not found"})}
        if (await bcrypt.compare(password,checkEmail.rows[0].password)){
            const payload = {
            id:checkEmail.rows[0].id,
            email:checkEmail.rows[0].email
            }
            const token = jwt.sign(payload,JWT_SECRET,{expiresIn:"7d"})
            return res.status(200).json({message:"User logged in successfully",token:token,
                user:{
                    id: checkEmail.rows[0].id,
                    name: checkEmail.rows[0].name,
                    email: checkEmail.rows[0].email
                }
            })
        }else{
            return res.status(400).json({message:"Invalid credintials"})
        }
    }
    catch(err){
        console.log(err)
        return res.status(500).json({error:"user login failed"})
    }

})


const authenticateToken = (req,res,next) =>{
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]
    if (!token){
        return res.status(401).json({error:"Access token required"})
    }
    jwt.verify(token,JWT_SECRET,(err,decodedUser)=>{
        if (err) {
            return res.status(403).json({error : "invalid or expired token"})
        }
        req.user = decodedUser
        next()
    })
}

app.get("/me",authenticateToken,async(req,res)=>{
    try{
        const user = await pool.query("SELECT id,name,email,created_at FROM userS WHERE id= $1",[req.user.id])
        return res.status(200).json({user:user.rows[0]})
    }
    catch(err){
        console.log(err)
        return res.status(500).json({error:"user not found"})   
    }
})

const authenticateOptionalToken = (req, res, next) => {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]
    if (!token) {
        return next()
    }
    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) {
            return res.status(403).json({ error: "invalid or expired token" })
        }
        req.user = decodedUser
        next()
    })
}

const createNudgeHandler = async (req, res) => {
    try {
        const creatorId = req.user ? req.user.id : (req.body.creator_id || req.body.creatorId)
        if (!creatorId) {
            return res.status(401).json({ error: "Access token or creator_id is required" })
        }

        // Verify creator exists
        const creatorCheck = await pool.query("SELECT id FROM users WHERE id = $1", [creatorId])
        if (creatorCheck.rows.length === 0) {
            return res.status(404).json({ error: "Creator user not found" })
        }

        const {
            receiver_id, receiverId,
            category = "custom",
            emoji,
            title,
            description,
            scheduled_time, scheduledTime,
            repeat = "daily",
            reminder_interval, reminderInterval = "15",
            stop_when, stopWhen = "completed",
            max_reminders, maxReminders = 3,
            status = "pending",
            proof_type, proofType = "tap",
            accountability_level, accountabilityLevel = "trust"
        } = req.body

        if (!title || !title.trim()) {
            return res.status(400).json({ error: "Title is required" })
        }

        const finalReceiverId = receiver_id !== undefined ? receiver_id : (receiverId !== undefined ? receiverId : creatorId)
        
        // If receiver is specified and different from creator, verify receiver exists
        if (finalReceiverId) {
            const receiverCheck = await pool.query("SELECT id FROM users WHERE id = $1", [finalReceiverId])
            if (receiverCheck.rows.length === 0) {
                return res.status(404).json({ error: "Receiver user not found" })
            }
        }

        // Default emoji based on category if not provided
        const defaultEmojiMap = {
            medicine: "💊",
            water: "💧",
            exercise: "🏃",
            homework: "📚",
            checkin: "👋",
            custom: "📌"
        }
        const finalEmoji = emoji || defaultEmojiMap[category] || "📌"
        const finalScheduledTime = scheduled_time || scheduledTime || new Date()
        const finalReminderInterval = String(reminder_interval !== undefined ? reminder_interval : reminderInterval)
        const finalStopWhen = stop_when || stopWhen
        const finalMaxReminders = max_reminders !== undefined ? max_reminders : maxReminders
        const finalProofType = proof_type || proofType
        const finalAccountabilityLevel = accountability_level || accountabilityLevel

        const newNudge = await pool.query(
            `INSERT INTO nudges (
                creator_id,
                receiver_id,
                category,
                emoji,
                title,
                description,
                scheduled_time,
                repeat,
                reminder_interval,
                stop_when,
                max_reminders,
                status,
                proof_type,
                accountability_level
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *`,
            [
                creatorId,
                finalReceiverId,
                category,
                finalEmoji,
                title.trim(),
                description || null,
                finalScheduledTime,
                repeat,
                finalReminderInterval,
                finalStopWhen,
                finalMaxReminders,
                status,
                finalProofType,
                finalAccountabilityLevel
            ]
        )

        return res.status(201).json({
            message: "Nudge created successfully",
            nudge: newNudge.rows[0]
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ error: "Failed to create nudge", details: error.message })
    }
}

app.post("/create-nudges", authenticateOptionalToken, createNudgeHandler)
app.post("/nudges", authenticateOptionalToken, createNudgeHandler)

app.get("/nudges", authenticateOptionalToken, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : (req.query.user_id || req.query.userId)
        let result
        if (userId) {
            result = await pool.query(
                "SELECT * FROM nudges WHERE creator_id = $1 OR receiver_id = $1 ORDER BY created_at DESC",
                [userId]
            )
        } else {
            result = await pool.query("SELECT * FROM nudges ORDER BY created_at DESC")
        }
        return res.status(200).json({ nudges: result.rows })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ error: "Failed to fetch nudges", details: error.message })
    }
})


app.listen(3000,()=>{
    console.log("server is running on port 3000")
})