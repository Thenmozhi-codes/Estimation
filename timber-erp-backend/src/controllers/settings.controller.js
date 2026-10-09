const settingsService = require("../services/settings.service");

async function getAllSettings(req, res) {
  try {
    const data =
      await settingsService.getAllSettings();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "Get settings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
    });
  }
}

async function getSetting(req, res) {
  try {
    const { key } = req.params;

    const data =
      await settingsService.getSetting(key);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Setting not found",
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "Get setting error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch setting",
    });
  }
}

async function upsertSetting(req, res) {
  try {
    const { key, value } = req.body;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: "key is required",
      });
    }

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        message: "value is required",
      });
    }

    const data =
      await settingsService.upsertSetting(
        key,
        value
      );

    return res.status(200).json({
      success: true,
      message: "Setting saved successfully",
      data,
    });
  } catch (error) {
    console.error(
      "Save setting error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to save setting",
    });
  }
}

module.exports = {
  getAllSettings,
  getSetting,
  upsertSetting,
};