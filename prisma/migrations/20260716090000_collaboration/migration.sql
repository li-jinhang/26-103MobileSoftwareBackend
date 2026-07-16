-- Collaboration records and employee-to-employee message feed.
CREATE TABLE "CollaborationMeeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "organizerName" TEXT NOT NULL,
    "participantIdsJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    CONSTRAINT "CollaborationMeeting_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CollaborationTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "initiatorName" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "assigneeName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reply" TEXT NOT NULL DEFAULT '',
    "replyTime" TEXT NOT NULL DEFAULT '',
    "dueTime" TEXT NOT NULL DEFAULT '',
    "createTime" TEXT NOT NULL,
    CONSTRAINT "CollaborationTask_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CollaborationGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "memberIdsJson" TEXT NOT NULL,
    "createTime" TEXT NOT NULL,
    CONSTRAINT "CollaborationGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CollaborationMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'message',
    "relatedId" TEXT NOT NULL DEFAULT '',
    "createTime" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CollaborationMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CollaborationMeeting_organizerId_startTime_idx" ON "CollaborationMeeting"("organizerId", "startTime");
CREATE INDEX "CollaborationTask_initiatorId_status_idx" ON "CollaborationTask"("initiatorId", "status");
CREATE INDEX "CollaborationTask_assigneeId_status_idx" ON "CollaborationTask"("assigneeId", "status");
CREATE INDEX "CollaborationGroup_ownerId_idx" ON "CollaborationGroup"("ownerId");
CREATE INDEX "CollaborationMessage_recipientId_read_createTime_idx" ON "CollaborationMessage"("recipientId", "read", "createTime");
