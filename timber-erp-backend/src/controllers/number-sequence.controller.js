const numberSequenceService = require("../services/number-sequence.service");

async function getSequences(req, res) {
  try {
    const data =
      await numberSequenceService.getSequences();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "Get number sequences error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch number sequences",
    });
  }
}

async function updateSequence(req, res) {
  try {
    const { key, prefix, padding } = req.body;

    if (!key || !prefix) {
      return res.status(400).json({
        success: false,
        message: "key and prefix are required",
      });
    }

    const parsedPadding = Number(padding || 4);

    if (
      !Number.isInteger(parsedPadding) ||
      parsedPadding < 1 ||
      parsedPadding > 10
    ) {
      return res.status(400).json({
        success: false,
        message: "padding must be between 1 and 10",
      });
    }

    await numberSequenceService.updateSequence(
      key,
      prefix,
      parsedPadding
    );

    return res.status(200).json({
      success: true,
      message: "Number sequence updated successfully",
    });
  } catch (error) {
    console.error(
      "Update number sequence error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update number sequence",
    });
  }
}

module.exports = {
  getSequences,
  updateSequence,
};