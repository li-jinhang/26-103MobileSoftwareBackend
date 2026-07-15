-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "recipientUserId" TEXT;

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InternalMail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "importance" TEXT NOT NULL DEFAULT 'normal',
    "createTime" TEXT NOT NULL,
    "relatedWorkflowId" TEXT NOT NULL,
    "relatedKnowledgeId" TEXT NOT NULL,
    CONSTRAINT "InternalMail_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MailRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mailId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readTime" TEXT NOT NULL,
    CONSTRAINT "MailRecipient_mailId_fkey" FOREIGN KEY ("mailId") REFERENCES "InternalMail" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MailRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AttendanceRecord_userId_time_idx" ON "AttendanceRecord"("userId", "time");

-- CreateIndex
CREATE INDEX "InternalMail_senderId_createTime_idx" ON "InternalMail"("senderId", "createTime");

-- CreateIndex
CREATE INDEX "MailRecipient_userId_idx" ON "MailRecipient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MailRecipient_mailId_userId_key" ON "MailRecipient"("mailId", "userId");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_idx" ON "Notification"("recipientUserId");
