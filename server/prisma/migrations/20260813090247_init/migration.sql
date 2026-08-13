-- CreateEnum
CREATE TYPE "Role" AS ENUM ('manager', 'hr', 'candidate');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "title" TEXT,
    "employeeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "businessUnit" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "experienceYears" DECIMAL(65,30) NOT NULL,
    "benchStatus" TEXT NOT NULL DEFAULT 'Bench',
    "currentAllocation" TEXT,
    "availableDate" TIMESTAMP(3),
    "joiningNotice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSkill" (
    "employeeId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,

    CONSTRAINT "EmployeeSkill_pkey" PRIMARY KEY ("employeeId","skillId")
);

-- CreateTable
CREATE TABLE "EmployeeProject" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "projectName" TEXT NOT NULL,
    "clientName" TEXT,
    "duration" TEXT,
    "description" TEXT NOT NULL,
    "domainTags" TEXT[],

    CONSTRAINT "EmployeeProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeRating" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "reviewCycle" TEXT NOT NULL,
    "rating" TEXT NOT NULL,

    CONSTRAINT "EmployeeRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "managerId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "startDate" TIMESTAMP(3),
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Irc" (
    "id" SERIAL NOT NULL,
    "ircCode" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "mandatorySkills" TEXT NOT NULL,
    "preferredSkills" TEXT,
    "experienceRange" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "remotePolicy" TEXT NOT NULL,
    "openingDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',

    CONSTRAINT "Irc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineCandidate" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "ircId" INTEGER NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'AI Shortlisted',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "matchPct" INTEGER,
    "whyRecommend" TEXT,
    "whyNot" TEXT[],
    "conflict" BOOLEAN NOT NULL DEFAULT false,
    "conflictNote" TEXT,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateNote" TEXT,
    "appliedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackRound" (
    "id" SERIAL NOT NULL,
    "pipelineCandidateId" INTEGER NOT NULL,
    "roundName" TEXT NOT NULL,
    "interviewer" TEXT,
    "roundDate" TIMESTAMP(3),
    "rating" TEXT,
    "comments" TEXT,

    CONSTRAINT "FeedbackRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "ircId" INTEGER,
    "queryText" TEXT,
    "jdFilename" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotFitFeedback" (
    "id" SERIAL NOT NULL,
    "pipelineCandidateId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotFitFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Irc_ircCode_key" ON "Irc"("ircCode");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineCandidate_employeeId_ircId_isActive_key" ON "PipelineCandidate"("employeeId", "ircId", "isActive");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProject" ADD CONSTRAINT "EmployeeProject_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRating" ADD CONSTRAINT "EmployeeRating_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Irc" ADD CONSTRAINT "Irc_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineCandidate" ADD CONSTRAINT "PipelineCandidate_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineCandidate" ADD CONSTRAINT "PipelineCandidate_ircId_fkey" FOREIGN KEY ("ircId") REFERENCES "Irc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRound" ADD CONSTRAINT "FeedbackRound_pipelineCandidateId_fkey" FOREIGN KEY ("pipelineCandidateId") REFERENCES "PipelineCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchLog" ADD CONSTRAINT "SearchLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchLog" ADD CONSTRAINT "SearchLog_ircId_fkey" FOREIGN KEY ("ircId") REFERENCES "Irc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotFitFeedback" ADD CONSTRAINT "NotFitFeedback_pipelineCandidateId_fkey" FOREIGN KEY ("pipelineCandidateId") REFERENCES "PipelineCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
