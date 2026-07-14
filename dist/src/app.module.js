"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("./prisma/prisma.service");
const auth_module_1 = require("./modules/auth.module");
const knowledge_module_1 = require("./modules/knowledge.module");
const workflow_module_1 = require("./modules/workflow.module");
const notifications_module_1 = require("./modules/notifications.module");
const assistant_module_1 = require("./modules/assistant.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true
            }),
            auth_module_1.AuthModule,
            knowledge_module_1.KnowledgeModule,
            workflow_module_1.WorkflowModule,
            notifications_module_1.NotificationsModule,
            assistant_module_1.AssistantModule
        ],
        providers: [prisma_service_1.PrismaService]
    })
], AppModule);
//# sourceMappingURL=app.module.js.map