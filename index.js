const express = require("express")
const app = express();

app.get("/login", (req, res) => {
    res.send("hello from signin")
})

app.post("/signup",(req,res)=>{
    res.send("signup route works!")
})

app.listen(3000,()=>{
    console.log("server is running on port 3000")
})