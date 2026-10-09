const bcrypt = require("bcryptjs");

const userService =
  require("../services/user.service");

const {
  createAuditLog,
} = require("../services/audit.service");

function validId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

async function getAllUsers(req, res) {
  try {
    const users =
      await userService.getAllUsers();

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error(
      "Get users error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
}

async function getUserById(req, res) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user =
      await userService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error(
      "Get user error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
}

async function createUser(req, res) {
  try {
    const {
      name,
      email,
      password,
      roleId,
    } = req.body;

    const cleanName =
      String(name || "").trim();

    const cleanEmail =
      String(email || "")
        .trim()
        .toLowerCase();

    const parsedRoleId =
      validId(roleId);

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (!cleanEmail) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 6
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters",
      });
    }

    if (!parsedRoleId) {
      return res.status(400).json({
        success: false,
        message: "Valid roleId is required",
      });
    }

    const role =
      await userService.getRoleById(
        parsedRoleId
      );

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role not found",
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 10);

    const user =
      await userService.createUser({
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        roleId: parsedRoleId,
      });

    await createAuditLog({
      req,
      action: "CREATE",
      entity: "USER",
      entityId: user.id,
      afterData: user,
      status: "success",
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    console.error(
      "Create user error:",
      error
    );

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
}

async function updateUser(req, res) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const existing =
      await userService.getUserById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const {
      name,
      email,
      roleId,
    } = req.body;

    const cleanName =
      String(name || "").trim();

    const cleanEmail =
      String(email || "")
        .trim()
        .toLowerCase();

    const parsedRoleId =
      validId(roleId);

    if (!cleanName || !cleanEmail) {
      return res.status(400).json({
        success: false,
        message:
          "Name and email are required",
      });
    }

    if (!parsedRoleId) {
      return res.status(400).json({
        success: false,
        message: "Valid roleId is required",
      });
    }

    const role =
      await userService.getRoleById(
        parsedRoleId
      );

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role not found",
      });
    }

    const updated =
      await userService.updateUser(
        id,
        {
          name: cleanName,
          email: cleanEmail,
          roleId: parsedRoleId,
        }
      );

    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "USER",
      entityId: id,
      beforeData: existing,
      afterData: updated,
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error(
      "Update user error:",
      error
    );

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
}

async function updateUserStatus(
  req,
  res
) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const existing =
      await userService.getUserById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isActive =
      req.body.isActive;

    if (
      typeof isActive !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "isActive must be true or false",
      });
    }

    if (
      id === req.user.id &&
      !isActive
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot deactivate your own account",
      });
    }

    const updated =
      await userService.updateUserStatus(
        id,
        isActive
      );

    await createAuditLog({
      req,
      action: "STATUS_CHANGE",
      entity: "USER",
      entityId: id,
      beforeData: existing,
      afterData: updated,
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message:
        "User status updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error(
      "Update user status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update user status",
    });
  }
}

async function resetPassword(req, res) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user =
      await userService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const {
      password,
    } = req.body;

    if (
      typeof password !== "string" ||
      password.length < 6
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters",
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 10);

    await userService.updatePassword(
      id,
      passwordHash
    );

    await createAuditLog({
      req,
      action: "PASSWORD_RESET",
      entity: "USER",
      entityId: id,
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message:
        "User password reset successfully",
    });
  } catch (error) {
    console.error(
      "Reset password error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to reset user password",
    });
  }
}

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  resetPassword,
};