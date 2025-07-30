import { PrismaClient } from '@prisma/client';

// Instancia única do PrismaClient para ser usada em toda a aplicação
const prisma = new PrismaClient();

export default prisma;