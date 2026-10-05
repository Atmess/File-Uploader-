/*
  Warnings:

  - Added the required column `userId` to the `ShareLink` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ShareLink" ADD COLUMN     "userId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
