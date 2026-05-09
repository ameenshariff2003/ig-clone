const jwt          = require("jsonwebtoken");
const User         = require("../models/user.model");
const AppError     = require("../utils/AppError");
const asyncHandler = require("./asyncHandler");

const isAuthenticated = async (req, _res, next) => {
  let token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!token) {
    throw new AppError("Authentication required. Please sign in.", 401);
  }

  // Let errorHandler translate JsonWebTokenError / TokenExpiredError naturally
  const decoded = jwt.verify(token, process.env.JWT_KEY);

  const user = await User.findById(decoded.id).select("+role").lean();
  if (!user) {
    throw new AppError("The account belonging to this token no longer exists.", 401);
  }

  req.user = user;
  next();
};

const isAdmin = (req, _res, next) => {
  if (req.user?.role !== "admin") {
    return next(new AppError("Access denied. Admin privileges required.", 403));
  }
  next();
};

module.exports = { isAuthenticated, isAdmin };