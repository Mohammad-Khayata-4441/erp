-- AlterTable
ALTER TABLE "app_users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');

-- AlterTable
ALTER TABLE "app_users" ADD COLUMN "auth_provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "app_users" ADD COLUMN "google_sub" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "app_users_google_sub_key" ON "app_users"("google_sub");
