function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userRole = String(
      req.user.roleName || ""
    )
      .trim()
      .toUpperCase();

    const roles = allowedRoles.map((role) =>
      String(role)
        .trim()
        .toUpperCase()
    );

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }

    next();
  };
}

module.exports = authorizeRoles;