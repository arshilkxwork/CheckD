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

app.post("/create-nudges",(req,res)=>{
    
})

app.listen(3000,()=>{
    console.log("server is running on port 3000")
})