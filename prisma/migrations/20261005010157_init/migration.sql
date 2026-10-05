-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "folderId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
