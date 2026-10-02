// db/prisma.js
const { PrismaClient } = require("../generated/prisma");

// Initialize Prisma Client once
const prisma = new PrismaClient();

module.exports = prisma;