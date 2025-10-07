import { PrismaClient } from '@prisma/client';

// Instancia única do PrismaClient para ser usada em toda a aplicação
const prisma = new PrismaClient();

// Testar conexão com o banco de dados
prisma.$connect()
  .then(() => {
    console.log('✅ 🗄️  Database connected successfully!');
  })
  .catch((error) => {
    console.error('❌ 🗄️  Database connection failed:', error);
  });

export default prisma;