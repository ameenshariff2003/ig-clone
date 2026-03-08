
const mongoose = require("mongoose");


 const dbConnect = async()=>{
   await mongoose.connect(process.env.MONGODB)

   console.log("Db Connect")

}

module.exports = dbConnect;