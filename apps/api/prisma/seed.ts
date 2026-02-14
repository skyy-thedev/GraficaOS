import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0]!.substring(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Limpa dados existentes
  await prisma.arquivo.deleteMany();
  await prisma.arte.deleteMany();
  await prisma.ponto.deleteMany();
  await prisma.user.deleteMany();

  const senha123456 = await bcrypt.hash('123456', 12);
  const senhaAdmin = await bcrypt.hash('admin123', 12);

  // Cria os usuários
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador',
      email: 'admin@graficaos.com',
      password: senhaAdmin,
      role: 'ADMIN',
      avatarColor: '#6c63ff',
      initials: 'AD',
    },
  });

  const ana = await prisma.user.create({
    data: {
      name: 'Ana Silva',
      email: 'ana@graficaos.com',
      password: senha123456,
      role: 'EMPLOYEE',
      avatarColor: '#22d3a0',
      initials: 'AS',
    },
  });

  const carlos = await prisma.user.create({
    data: {
      name: 'Carlos Mota',
      email: 'carlos@graficaos.com',
      password: senha123456,
      role: 'EMPLOYEE',
      avatarColor: '#f5c542',
      initials: 'CM',
    },
  });

  const julia = await prisma.user.create({
    data: {
      name: 'Júlia Ramos',
      email: 'julia@graficaos.com',
      password: senha123456,
      role: 'EMPLOYEE',
      avatarColor: '#ff5e5e',
      initials: 'JR',
    },
  });

  const marcos = await prisma.user.create({
    data: {
      name: 'Marcos Lima',
      email: 'marcos@graficaos.com',
      password: senha123456,
      role: 'EMPLOYEE',
      avatarColor: '#4db8ff',
      initials: 'ML',
    },
  });

  console.log('✅ Usuários criados');

  // Cria artes de exemplo
  await prisma.arte.createMany({
    data: [
      {
        codigo: 'ART-001',
        clienteNome: 'Loja do João',
        clienteNumero: '(11) 99999-1111',
        orcamentoNum: 'ORC-2026-001',
        produto: 'BANNER',
        quantidade: 2,
        largura: 3.0,
        altura: 1.5,
        responsavelId: ana.id,
        status: 'DOING',
        urgencia: 'HIGH',
        prazo: new Date('2026-02-15'),
        observacoes: 'Banner para fachada da loja. Arte com fundo azul marinho.',
      },
      {
        codigo: 'ART-002',
        clienteNome: 'Padaria Central',
        clienteNumero: '(11) 98888-2222',
        orcamentoNum: 'ORC-2026-002',
        produto: 'ADESIVO',
        quantidade: 50,
        largura: 0.1,
        altura: 0.1,
        responsavelId: carlos.id,
        status: 'TODO',
        urgencia: 'NORMAL',
        prazo: new Date('2026-02-20'),
        observacoes: 'Adesivos redondos para embalagens.',
      },
      {
        codigo: 'ART-003',
        clienteNome: 'Auto Peças Silva',
        clienteNumero: '(11) 97777-3333',
        orcamentoNum: 'ORC-2026-003',
        produto: 'PLACA',
        quantidade: 1,
        largura: 2.0,
        altura: 1.0,
        responsavelId: julia.id,
        status: 'REVIEW',
        urgencia: 'NORMAL',
        prazo: null,
        observacoes: 'Placa de ACM com letras em relevo.',
      },
      {
        codigo: 'ART-004',
        clienteNome: 'Escola Futuro',
        clienteNumero: '(11) 96666-4444',
        orcamentoNum: 'ORC-2026-004',
        produto: 'FAIXA',
        quantidade: 3,
        largura: 5.0,
        altura: 0.8,
        responsavelId: ana.id,
        status: 'DONE',
        urgencia: 'LOW',
        prazo: new Date('2026-02-10'),
        observacoes: 'Faixas para evento escolar.',
      },
      {
        codigo: 'ART-005',
        clienteNome: 'Restaurante Sabor',
        clienteNumero: '(11) 95555-5555',
        orcamentoNum: 'ORC-2026-005',
        produto: 'AZULEJO',
        quantidade: 20,
        largura: 0.2,
        altura: 0.2,
        responsavelId: marcos.id,
        status: 'TODO',
        urgencia: 'HIGH',
        prazo: new Date('2026-02-14'),
        observacoes: 'Azulejos personalizados para cozinha do restaurante.',
      },
    ],
  });

  console.log('✅ Artes criadas');

  // Cria pontos de exemplo para a semana atual
  const hoje = new Date();
  const funcionarios = [ana, carlos, julia, marcos];

  for (const func of funcionarios) {
    for (let i = 0; i < 3; i++) {
      const dia = new Date(hoje);
      dia.setDate(dia.getDate() - i);
      const dateOnly = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());

      // Horários simulados
      const entrada = new Date(dia);
      entrada.setHours(8, 0 + Math.floor(Math.random() * 15), 0, 0);

      const almoco = new Date(dia);
      almoco.setHours(12, 0 + Math.floor(Math.random() * 10), 0, 0);

      const retorno = new Date(dia);
      retorno.setHours(13, 0 + Math.floor(Math.random() * 15), 0, 0);

      const saida = new Date(dia);
      saida.setHours(17, 30 + Math.floor(Math.random() * 30), 0, 0);

      await prisma.ponto.create({
        data: {
          userId: func.id,
          date: dateOnly,
          entrada,
          almoco,
          retorno,
          saida,
        },
      });
    }
  }

  console.log('✅ Pontos criados');
  console.log('🎉 Seed finalizado com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
