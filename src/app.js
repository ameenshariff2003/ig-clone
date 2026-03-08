const express = require("express");
const userRouter = require("./routes/authRoutes");
const app = express();
const cookieParser = require("cookie-parser")


app.use(express.json());
app.use(cookieParser())


app.use("/auth",userRouter)


module.exports = app;