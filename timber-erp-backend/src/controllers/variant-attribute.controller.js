const variantAttributeService = require("../services/variant-attribute.service");

const { createAuditLog } = require("../services/audit.service");


// =====================================================
// GET VARIANT ATTRIBUTES
// =====================================================
async function getVariantAttributes(req, res) {
  try {
    const variantId = Number(req.params.variantId);

    if (!Number.isInteger(variantId) || variantId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant ID",
      });
    }

    const variant =
      await variantAttributeService.getVariant(
        variantId
      );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    const attributes =
      await variantAttributeService.getVariantAttributes(
        variantId
      );

    return res.status(200).json({
      success: true,
      data: attributes,
    });

  } catch (error) {
    console.error(
      "Get variant attributes error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch variant attributes",
    });
  }
}


// =====================================================
// REPLACE VARIANT ATTRIBUTES
// =====================================================
async function replaceVariantAttributes(req, res) {
  try {
    const variantId = Number(req.params.variantId);

    if (!Number.isInteger(variantId) || variantId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant ID",
      });
    }

    const variant =
      await variantAttributeService.getVariant(
        variantId
      );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    const { attributes } = req.body || {};

    if (!Array.isArray(attributes)) {
      return res.status(400).json({
        success: false,
        message: "attributes must be an array",
      });
    }


    // =================================================
    // EMPTY ARRAY
    // =================================================
    if (attributes.length === 0) {
      const beforeData =
        await variantAttributeService.getVariantAttributes(
          variantId
        );

      const updated =
        await variantAttributeService.replaceVariantAttributes(
          variantId,
          []
        );

      await createAuditLog({
        req,
        action: "UPDATE",
        entity: "variant_attribute_values",
        entityId: variantId,
        beforeData,
        afterData: updated,
      });

      return res.status(200).json({
        success: true,
        message: "Variant attributes cleared successfully",
        data: updated,
      });
    }


    // =================================================
    // VALIDATE DUPLICATE ATTRIBUTES
    // =================================================
    const attributeIds = attributes.map(
      (item) => Number(item.attributeId)
    );

    const uniqueAttributeIds =
      new Set(attributeIds);

    if (
      uniqueAttributeIds.size !==
      attributeIds.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Duplicate attributes are not allowed",
      });
    }


    // =================================================
    // VALIDATE EACH ATTRIBUTE
    // =================================================
    const validatedAttributes = [];

    for (const item of attributes) {
      const attributeId = Number(
        item.attributeId
      );

      const attributeValueId = Number(
        item.attributeValueId
      );

      if (
        !Number.isInteger(attributeId) ||
        attributeId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid attribute ID",
        });
      }

      if (
        !Number.isInteger(attributeValueId) ||
        attributeValueId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid attribute value ID",
        });
      }


      // ---------------------------------------------
      // CHECK CATEGORY ATTRIBUTE
      // ---------------------------------------------
      const categoryAttribute =
        await variantAttributeService
          .getCategoryAttribute(
            variant.category_id,
            attributeId
          );

      if (!categoryAttribute) {
        return res.status(400).json({
          success: false,
          message:
            `Attribute ${attributeId} is not assigned to this product category`,
        });
      }

      if (!categoryAttribute.is_active) {
        return res.status(400).json({
          success: false,
          message:
            `Attribute ${attributeId} is inactive`,
        });
      }


      // ---------------------------------------------
      // CHECK ATTRIBUTE VALUE
      // ---------------------------------------------
      const attributeValue =
        await variantAttributeService
          .getAttributeValue(
            attributeId,
            attributeValueId
          );

      if (!attributeValue) {
        return res.status(400).json({
          success: false,
          message:
            `Attribute value ${attributeValueId} does not belong to attribute ${attributeId}`,
        });
      }


      validatedAttributes.push({
        attributeId,
        attributeValueId,
      });
    }


    // =================================================
    // GET OLD DATA
    // =================================================
    const beforeData =
      await variantAttributeService.getVariantAttributes(
        variantId
      );


    // =================================================
    // SAVE
    // =================================================
    const updated =
      await variantAttributeService.replaceVariantAttributes(
        variantId,
        validatedAttributes
      );


    // =================================================
    // AUDIT
    // =================================================
    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "variant_attribute_values",
      entityId: variantId,
      beforeData,
      afterData: updated,
    });


    return res.status(200).json({
      success: true,
      message: "Variant attributes updated successfully",
      data: updated,
    });

  } catch (error) {
    console.error(
      "Replace variant attributes error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update variant attributes",
    });
  }
}


module.exports = {
  getVariantAttributes,
  replaceVariantAttributes,
};