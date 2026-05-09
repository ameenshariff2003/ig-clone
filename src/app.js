const express      = require("express");
const cookieParser = require("cookie-parser");
const cors         = require("cors");
const userRouter   = require("./routes/authRoutes");
const cartRouter   = require("./routes/cartRoutes");
const orderRouter  = require("./routes/orderRoutes");
const adminRouter  = require("./routes/adminRoutes");
const productRouter = require("./routes/productRoute");
const errorHandler = require("./middleware/errorHandler");
const AppError     = require("./utils/AppError");

const app = express();

// ─── Global middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Black Valley API is running" });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/auth",    userRouter);
app.use("/cart",    cartRouter);
app.use("/orders",  orderRouter);
app.use("/admin",   adminRouter);
app.use("/product", productRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found.`, 404));
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;