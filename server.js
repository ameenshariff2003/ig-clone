require("dotenv").config()

const app = require("../server/src/app")
const dbConnect = require("../server/src/config/db")





dbConnect();


app.listen(3000,()=>{
    console.log("server is running")
})