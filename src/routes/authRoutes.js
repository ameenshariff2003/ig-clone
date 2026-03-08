const express = require("express")
const auth = require("../controllers/user.ctrl")

const userRouter = express.Router()

userRouter.post("/register",auth.signup)


userRouter.post("/login",auth.login)

userRouter.post("/logout",auth.logout)





module.exports = userRouter