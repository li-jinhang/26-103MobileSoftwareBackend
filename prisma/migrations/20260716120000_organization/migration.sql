-- Organization structure and reporting relationships.
ALTER TABLE "User" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "User" ADD COLUMN "managerId" TEXT;
ALTER TABLE "User" ADD COLUMN "jobTitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "employmentStatus" TEXT NOT NULL DEFAULT 'active';

CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "leaderId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Department_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");
CREATE INDEX "User_managerId_idx" ON "User"("managerId");
CREATE INDEX "Department_parentId_sortOrder_idx" ON "Department"("parentId", "sortOrder");
CREATE INDEX "Department_status_idx" ON "Department"("status");
