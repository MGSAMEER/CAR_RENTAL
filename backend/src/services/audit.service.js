const { prisma } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Logs an administrative action to the database for compliance and tracking.
 * @param {string} adminId - The ID of the admin performing the action
 * @param {string} action - The action being performed (e.g., "SOFT_DELETE_CAR", "VERIFY_DOCUMENT")
 * @param {string} entity - The entity being modified (e.g., "Car", "User")
 * @param {string} entityId - The ID of the entity being modified
 * @param {Object} details - Additional JSON details about the change
 */
const logAdminAction = async (adminId, action, entity, entityId, details = {}) => {
  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        adminId,
        action,
        entity,
        entityId,
        details,
      },
    });
    logger.info(`[AUDIT] Admin ${adminId} performed ${action} on ${entity} ${entityId}`);
    return auditLog;
  } catch (error) {
    logger.error(`[AUDIT ERROR] Failed to log admin action: ${error.message}`);
  }
};

module.exports = { logAdminAction };
