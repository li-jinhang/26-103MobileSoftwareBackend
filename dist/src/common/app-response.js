"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ok = ok;
function ok(data, message = 'success') {
    return {
        code: 0,
        message,
        data
    };
}
//# sourceMappingURL=app-response.js.map