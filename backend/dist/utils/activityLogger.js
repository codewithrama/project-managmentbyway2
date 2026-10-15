"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = void 0;
const db_1 = __importDefault(require("../config/db"));
const logActivity = async (params) => {
    try {
        return await db_1.default.activityLog.create({
            data: {
                userId: params.userId,
                action: params.action,
                details: params.details || null,
                projectId: params.projectId || null,
                taskId: params.taskId || null,
            },
        });
    }
    catch (err) {
        console.error('Failed to record activity log:', err);
    }
};
exports.logActivity = logActivity;
