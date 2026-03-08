
const mongoose = require("mongoose")


const userSchema = new mongoose.Schema({

    userName :{
        type:String,
        unique:[true, "Username already Exist"],
        required: [true, "username is required"]
    },

     email:{

        type:String,
         unique:[true, "Mail already Exist"],
        required: [true, "Mail is required"]

     },

      password:{

        type:String,
        required: [true, "passcode is required"]

     },
     bio:{

        type:String,

     },
      Image:{

        type:String,
        default:"https://www.google.com/url?sa=i&url=https%3A%2F%2Fwww.shutterstock.com%2Fsearch%2Fdefault-profile&psig=AOvVaw1UTOe3iXLKOD89jl8CIkSF&ust=1773089836430000&source=images&cd=vfe&opi=89978449&ved=0CBIQjRxqFwoTCJDfoL6YkZMDFQAAAAAdAAAAABAE"

     }
})


const userModel = mongoose.model("User",userSchema)

module.exports = userModel;