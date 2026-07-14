-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL,
    "permissionsJson" TEXT NOT NULL,
    "favoriteKnowledgeIdsJson" TEXT NOT NULL,
    "recentKnowledgeIdsJson" TEXT NOT NULL,
    "todoCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "tagsJson" TEXT NOT NULL,
    "updateTime" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attachmentsJson" TEXT NOT NULL,
    "relatedWorkflowIdsJson" TEXT NOT NULL,
    CONSTRAINT "KnowledgeArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KnowledgeCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "approverText" TEXT NOT NULL,
    "relatedKnowledgeIdsJson" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "riskHint" TEXT NOT NULL,
    "defaultApproverRolesJson" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentNode" TEXT NOT NULL,
    "currentApproverRole" TEXT NOT NULL,
    "createTime" TEXT NOT NULL,
    "latestComment" TEXT NOT NULL,
    "relatedKnowledgeIdsJson" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "formSummary" TEXT NOT NULL,
    "formDetailJson" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "riskReason" TEXT NOT NULL,
    "requiresSecurityConfirm" BOOLEAN NOT NULL,
    "securityConfirmed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "WorkflowInstance_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "nodeName" TEXT NOT NULL,
    "operatorRole" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    CONSTRAINT "ApprovalRecord_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "targetRolesJson" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "KnowledgeCorrection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createTime" TEXT NOT NULL,
    CONSTRAINT "KnowledgeCorrection_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeCorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssistantHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "relatedKnowledgeIdsJson" TEXT NOT NULL,
    "recommendedWorkflowId" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    CONSTRAINT "AssistantHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "operatorRole" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "time" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_account_key" ON "User"("account");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "WorkflowInstance_applicantId_idx" ON "WorkflowInstance"("applicantId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_currentApproverRole_idx" ON "WorkflowInstance"("currentApproverRole");

-- CreateIndex
CREATE INDEX "ApprovalRecord_instanceId_idx" ON "ApprovalRecord"("instanceId");
