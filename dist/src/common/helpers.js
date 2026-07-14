"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsonArray = parseJsonArray;
exports.toJson = toJson;
exports.formatDateTime = formatDateTime;
exports.formatRelativeTime = formatRelativeTime;
function parseJsonArray(value) {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function toJson(value) {
    return JSON.stringify(value);
}
function pad(value) {
    return value.toString().padStart(2, '0');
}
function formatDateTime(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function formatRelativeTime(date = new Date()) {
    const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
    if (minutes < 60) {
        return `${minutes} 分钟前`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours} 小时前`;
    }
    return '今天';
}
//# sourceMappingURL=helpers.js.map