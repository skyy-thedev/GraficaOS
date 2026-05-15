import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { syncPricingCatalog } from '../src/services/pricing.service';

const prisma = new PrismaClient();

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0]!.substring(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

function splitHorario(horario: string): [number, number] {
  const [hora, minuto] = horario.split(':').map(Number);
  return [hora ?? 0, minuto ?? 0];
}

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Limpa dados existentes
  await prisma.productFinishProduct.deleteMany();
  await prisma.productSizeVariation.deleteMany();
  await prisma.pricingTier.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productFinish.deleteMany();
  await prisma.pricingSettings.deleteMany();
  await prisma.venda.deleteMany();
  await prisma.checklistRegistro.deleteMany();
  await prisma.checklistItem.deleteMany();
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
      loja: 'PAPER_OFFICE_I',
      jornadaEntrada: '09:00',
      jornadaSaida: '18:00',
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
      loja: 'PAPER_OFFICE_I',
      jornadaEntrada: '10:00',
      jornadaSaida: '18:30',
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
      loja: 'PAPER_OFFICE_I',
      jornadaEntrada: '10:00',
      jornadaSaida: '18:30',
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
      loja: 'PAPER_OFFICE_II',
      jornadaEntrada: '10:00',
      jornadaSaida: '18:30',
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
      loja: 'PAPER_OFFICE_II',
      jornadaEntrada: '10:00',
      jornadaSaida: '18:30',
      avatarColor: '#4db8ff',
      initials: 'ML',
    },
  });

  console.log('✅ Usuários criados');

  const pricingSettings = await prisma.pricingSettings.create({
    data: {
      id: 'default',
      outsourcedMultiplier: 2.5,
    },
  });

  const finishes = await Promise.all([
    prisma.productFinish.create({ data: { name: 'Encadernação', type: 'BINDING', value: 19.9, pricingType: 'FIXED' } }),
    prisma.productFinish.create({ data: { name: 'Plastificação A4', type: 'LAMINATION', value: 14.9, pricingType: 'FIXED' } }),
    prisma.productFinish.create({ data: { name: 'Corte Especial', type: 'SPECIAL_CUT', value: 9.9, pricingType: 'FIXED' } }),
    prisma.productFinish.create({ data: { name: 'Vinco/Dobra', type: 'CREASE_FOLD', value: 4.9, pricingType: 'FIXED' } }),
    prisma.productFinish.create({ data: { name: 'Laminação Fosca', type: 'LAMINATION', value: 30, pricingType: 'PERCENTAGE' } }),
    prisma.productFinish.create({ data: { name: 'Laminação Holográfica', type: 'LAMINATION', value: 50, pricingType: 'PERCENTAGE' } }),
  ]);

  const finishLinks = finishes.map((finish) => ({ finishId: finish.id }));

  await prisma.product.create({
    data: {
      name: 'Impressão A4 PB',
      description: 'Linha interna para produção rápida com tabela progressiva por volume.',
      category: 'Impressão Interna',
      premiumCategory: 'Operação Expressa',
      pricingMode: 'PROGRESSIVE',
      urgencyEnabled: true,
      sortOrder: 10,
      pricingTiers: {
        create: [
          { minQuantity: 1, maxQuantity: 1, unitPrice: 3.0 },
          { minQuantity: 2, maxQuantity: 10, unitPrice: 2.5 },
          { minQuantity: 11, maxQuantity: 30, unitPrice: 1.9 },
          { minQuantity: 31, maxQuantity: 100, unitPrice: 1.4 },
          { minQuantity: 101, maxQuantity: null, unitPrice: 1.0 },
        ],
      },
      finishLinks: { create: finishLinks },
      sizeVariations: {
        create: [{ name: 'Padrão A4', widthCm: 21, heightCm: 29.7, value: 0, pricingType: 'FIXED', sortOrder: 0 }],
      },
    },
  });

  await prisma.product.create({
    data: {
      name: 'Impressão A4 Colorido',
      description: 'Acabamento colorido premium com ganho progressivo por tiragem.',
      category: 'Impressão Interna',
      premiumCategory: 'Linha Corporativa',
      pricingMode: 'PROGRESSIVE',
      urgencyEnabled: true,
      sortOrder: 20,
      pricingTiers: {
        create: [
          { minQuantity: 1, maxQuantity: 1, unitPrice: 8.9 },
          { minQuantity: 2, maxQuantity: 10, unitPrice: 7.5 },
          { minQuantity: 11, maxQuantity: 30, unitPrice: 5.9 },
          { minQuantity: 31, maxQuantity: 100, unitPrice: 4.5 },
          { minQuantity: 101, maxQuantity: null, unitPrice: 2.9 },
        ],
      },
      finishLinks: { create: finishLinks },
      sizeVariations: {
        create: [{ name: 'Padrão A4', widthCm: 21, heightCm: 29.7, value: 0, pricingType: 'FIXED', sortOrder: 0 }],
      },
    },
  });

  await prisma.product.create({
    data: {
      name: 'Impressão A3 PB',
      description: 'Formato ampliado em preto e branco com precificação por escala.',
      category: 'Impressão Interna',
      premiumCategory: 'Grandes Formatos',
      pricingMode: 'PROGRESSIVE',
      urgencyEnabled: true,
      sortOrder: 30,
      pricingTiers: {
        create: [
          { minQuantity: 1, maxQuantity: 1, unitPrice: 6.9 },
          { minQuantity: 2, maxQuantity: 10, unitPrice: 5.9 },
          { minQuantity: 11, maxQuantity: 30, unitPrice: 4.5 },
          { minQuantity: 31, maxQuantity: 100, unitPrice: 3.2 },
          { minQuantity: 101, maxQuantity: null, unitPrice: 2.2 },
        ],
      },
      finishLinks: { create: finishLinks },
      sizeVariations: {
        create: [{ name: 'Padrão A3', widthCm: 29.7, heightCm: 42, value: 0, pricingType: 'FIXED', sortOrder: 0 }],
      },
    },
  });

  await prisma.product.create({
    data: {
      name: 'Impressão A3 Colorido',
      description: 'Formato premium colorido para materiais high-ticket e apresentações.',
      category: 'Impressão Interna',
      premiumCategory: 'Grandes Formatos',
      pricingMode: 'PROGRESSIVE',
      urgencyEnabled: true,
      sortOrder: 40,
      pricingTiers: {
        create: [
          { minQuantity: 1, maxQuantity: 1, unitPrice: 15.9 },
          { minQuantity: 2, maxQuantity: 10, unitPrice: 13.9 },
          { minQuantity: 11, maxQuantity: 30, unitPrice: 10.9 },
          { minQuantity: 31, maxQuantity: 100, unitPrice: 7.9 },
          { minQuantity: 101, maxQuantity: null, unitPrice: 4.9 },
        ],
      },
      finishLinks: { create: finishLinks },
      sizeVariations: {
        create: [{ name: 'Padrão A3', widthCm: 29.7, heightCm: 42, value: 0, pricingType: 'FIXED', sortOrder: 0 }],
      },
    },
  });

  await prisma.product.create({
    data: {
      name: 'Plastificação RG',
      description: 'Serviço rápido de plastificação no formato RG para balcão e retirada expressa.',
      category: 'Acabamentos Rápidos',
      premiumCategory: 'Operação Expressa',
      pricingMode: 'FIXED',
      fixedUnitPrice: 8.9,
      urgencyEnabled: true,
      sortOrder: 50,
      finishLinks: { create: finishLinks },
    },
  });

  await prisma.product.create({
    data: {
      name: 'Plastificação A4',
      description: 'Serviço avulso de plastificação A4 com valor fixo para venda rápida.',
      category: 'Acabamentos Rápidos',
      premiumCategory: 'Operação Expressa',
      pricingMode: 'FIXED',
      fixedUnitPrice: 14.9,
      urgencyEnabled: true,
      sortOrder: 60,
      finishLinks: { create: finishLinks },
    },
  });

  await prisma.product.create({
    data: {
      name: 'Foto 10x15',
      description: 'Foto instantânea com curva progressiva até valor balcão otimizado para grandes tiragens.',
      category: 'Fotografia Instantânea',
      premiumCategory: 'Operação Expressa',
      pricingMode: 'PROGRESSIVE',
      urgencyEnabled: true,
      sortOrder: 70,
      pricingTiers: {
        create: [
          { minQuantity: 1, maxQuantity: 1, unitPrice: 5.5 },
          { minQuantity: 2, maxQuantity: 10, unitPrice: 5.0 },
          { minQuantity: 11, maxQuantity: 30, unitPrice: 4.5 },
          { minQuantity: 31, maxQuantity: 100, unitPrice: 4.0 },
          { minQuantity: 101, maxQuantity: null, unitPrice: 3.5 },
        ],
      },
      finishLinks: { create: finishLinks },
    },
  });

  await prisma.product.create({
    data: {
      name: 'Foto 13x18',
      description: 'Foto premium 13x18 com desconto progressivo para lotes maiores.',
      category: 'Fotografia Instantânea',
      premiumCategory: 'Linha Corporativa',
      pricingMode: 'PROGRESSIVE',
      urgencyEnabled: true,
      sortOrder: 80,
      pricingTiers: {
        create: [
          { minQuantity: 1, maxQuantity: 1, unitPrice: 10.0 },
          { minQuantity: 2, maxQuantity: 10, unitPrice: 9.0 },
          { minQuantity: 11, maxQuantity: 30, unitPrice: 8.5 },
          { minQuantity: 31, maxQuantity: 100, unitPrice: 7.8 },
          { minQuantity: 101, maxQuantity: null, unitPrice: 7.0 },
        ],
      },
      finishLinks: { create: finishLinks },
    },
  });

  await prisma.product.create({
    data: {
      name: 'Foto 15x20',
      description: 'Foto premium 15x20 com curva progressiva para venda avulsa e tiragens maiores.',
      category: 'Fotografia Instantânea',
      premiumCategory: 'Linha Corporativa',
      pricingMode: 'PROGRESSIVE',
      urgencyEnabled: true,
      sortOrder: 90,
      pricingTiers: {
        create: [
          { minQuantity: 1, maxQuantity: 1, unitPrice: 10.0 },
          { minQuantity: 2, maxQuantity: 10, unitPrice: 9.0 },
          { minQuantity: 11, maxQuantity: 30, unitPrice: 8.5 },
          { minQuantity: 31, maxQuantity: 100, unitPrice: 7.8 },
          { minQuantity: 101, maxQuantity: null, unitPrice: 7.0 },
        ],
      },
      finishLinks: { create: finishLinks },
    },
  });

  await prisma.product.createMany({
    data: [
      // ─── Cartões de Visita ────────────────────────────────────────────────
      {
        name: 'Couché Brilho 50un',
        description: 'Cartão couché 300g, formato 88x48mm, 4x0 (frente), refile. Lote de 50 unidades.',
        category: 'Terceirização Estratégica',
        premiumCategory: 'Cartões de Visita',
        pricingMode: 'OUTSOURCED',
        isOutsourced: true,
        supplierCost: 36.99,
        urgencyEnabled: true,
        sortOrder: 110,
        legacyProdutoTipo: 'CARTAO_VISITA',
      },
      {
        name: 'Couché Brilho 100un F/V',
        description: 'Cartão couché 300g, formato 88x48mm, 4x4 (frente e verso), refile. Lote de 100 unidades.',
        category: 'Terceirização Estratégica',
        premiumCategory: 'Cartões de Visita',
        pricingMode: 'OUTSOURCED',
        isOutsourced: true,
        supplierCost: 45.99,
        urgencyEnabled: true,
        sortOrder: 120,
        legacyProdutoTipo: 'CARTAO_VISITA',
      },
      {
        name: 'Premium 600g 100un',
        description: 'Cartão couché fosco 600g, 88x48mm, 4x4, laminação fosca, empastamento. Lote de 100 unidades.',
        category: 'Terceirização Estratégica',
        premiumCategory: 'Cartões de Visita',
        pricingMode: 'OUTSOURCED',
        isOutsourced: true,
        supplierCost: 73.99,
        urgencyEnabled: true,
        sortOrder: 130,
        legacyProdutoTipo: 'CARTAO_VISITA',
      },
      {
        name: 'Premium Luxo 250un',
        description: 'Cartão couché fosco 600g, 88x48mm, 4x4, Soft Touch + Hot Stamping Dourado, empastamento. Lote de 250 unidades.',
        category: 'Terceirização Estratégica',
        premiumCategory: 'Cartões de Visita',
        pricingMode: 'OUTSOURCED',
        isOutsourced: true,
        supplierCost: 114.99,
        urgencyEnabled: true,
        sortOrder: 140,
        legacyProdutoTipo: 'CARTAO_VISITA',
      },
      {
        name: 'Mini Cartão 100un',
        description: 'Cartão reciclato 240g, formato 43x48mm, 4x0, verniz localizado, refile. Lote de 100 unidades.',
        category: 'Terceirização Estratégica',
        premiumCategory: 'Cartões de Visita',
        pricingMode: 'OUTSOURCED',
        isOutsourced: true,
        supplierCost: 51.99,
        urgencyEnabled: true,
        sortOrder: 150,
        legacyProdutoTipo: 'CARTAO_VISITA',
      },
      {
        name: 'PVC Premium 50un',
        description: 'Cartão PVC Premium, formato 85x54mm, 4x0, 4 cantos arredondados. Lote de 50 unidades.',
        category: 'Terceirização Estratégica',
        premiumCategory: 'Cartões de Visita',
        pricingMode: 'OUTSOURCED',
        isOutsourced: true,
        supplierCost: 57.99,
        urgencyEnabled: true,
        sortOrder: 160,
        legacyProdutoTipo: 'CARTAO_VISITA',
      },
      // ─── Flyers ───────────────────────────────────────────────────────────
      {
        name: 'Flyer Couché 10x15 1000un',
        description: 'Flyer couché 115g, 10x15cm, 4x0, sem enobrecimento, refile. Lote de 1000 unidades.',
        category: 'Terceirização Estratégica',
        premiumCategory: 'Flyers e Panfletos',
        pricingMode: 'OUTSOURCED',
        isOutsourced: true,
        supplierCost: 89.99,
        urgencyEnabled: true,
        sortOrder: 170,
        legacyProdutoTipo: 'PANFLETO',
      },
      {
        name: 'Flyer A5 F/V 2500un',
        description: 'Flyer couché 150g, A5, 4x4 (frente e verso), verniz total, refile. Lote de 2500 unidades.',
        category: 'Terceirização Estratégica',
        premiumCategory: 'Flyers e Panfletos',
        pricingMode: 'OUTSOURCED',
        isOutsourced: true,
        supplierCost: 189.99,
        urgencyEnabled: true,
        sortOrder: 180,
        legacyProdutoTipo: 'PANFLETO',
      },
      // ─── Folders ──────────────────────────────────────────────────────────
      {
        name: 'Folder 1 Dobra 500un',
        description: 'Folder couché 170g, A4, 4x4, laminação fosca, 1 dobra. Lote de 500 unidades.',
        category: 'Terceirização Estratégica',
        premiumCategory: 'Folders e Institucionais',
        pricingMode: 'OUTSOURCED',
        isOutsourced: true,
        supplierCost: 249.99,
        urgencyEnabled: true,
        sortOrder: 190,
        legacyProdutoTipo: 'FOLDER',
      },
      {
        name: 'Folder 2 Dobras 1000un',
        description: 'Folder couché 170g, A3, 4x4, verniz total, 2 dobras. Lote de 1000 unidades.',
        category: 'Terceirização Estratégica',
        premiumCategory: 'Folders e Institucionais',
        pricingMode: 'OUTSOURCED',
        isOutsourced: true,
        supplierCost: 429.99,
        urgencyEnabled: true,
        sortOrder: 200,
        legacyProdutoTipo: 'FOLDER',
      },
    ],
  });

  console.log(`✅ Precificação premium criada · multiplicador ${pricingSettings.outsourcedMultiplier}x`);

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
        larguraCm: 300,
        alturaCm: 150,
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
        larguraCm: 10,
        alturaCm: 10,
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
        larguraCm: 200,
        alturaCm: 100,
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
        larguraCm: 500,
        alturaCm: 80,
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
        larguraCm: 20,
        alturaCm: 20,
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
      const [horaEntradaBase, minutoEntradaBase] = splitHorario(func.jornadaEntrada);
      const [horaSaidaBase, minutoSaidaBase] = splitHorario(func.jornadaSaida);

      // Horários simulados
      const entrada = new Date(dia);
      entrada.setHours(horaEntradaBase, minutoEntradaBase + Math.floor(Math.random() * 15), 0, 0);

      const almoco = new Date(dia);
      almoco.setHours(13, 0 + Math.floor(Math.random() * 10), 0, 0);

      const retorno = new Date(dia);
      retorno.setHours(14, 0 + Math.floor(Math.random() * 15), 0, 0);

      const saida = new Date(dia);
      saida.setHours(horaSaidaBase, minutoSaidaBase + Math.floor(Math.random() * 20), 0, 0);

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

  // ===== Checklist Diário =====
  const itensChecklist = await Promise.all([
    prisma.checklistItem.create({ data: { titulo: 'Abrir a loja', horarioLimite: '08:30', ordem: 1 } }),
    prisma.checklistItem.create({ data: { titulo: 'Ligar computadores', horarioLimite: '08:45', ordem: 2 } }),
    prisma.checklistItem.create({ data: { titulo: 'Verificar emails', horarioLimite: '09:00', ordem: 3 } }),
    prisma.checklistItem.create({ data: { titulo: 'Organizar estoque', horarioLimite: '10:00', ordem: 4 } }),
    prisma.checklistItem.create({ data: { titulo: 'Limpar área de trabalho', horarioLimite: '10:30', ordem: 5 } }),
    prisma.checklistItem.create({ data: { titulo: 'Conferir pedidos do dia', horarioLimite: '11:00', ordem: 6 } }),
    prisma.checklistItem.create({ data: { titulo: 'Tirar o lixo', horarioLimite: '17:00', ordem: 7 } }),
    prisma.checklistItem.create({ data: { titulo: 'Fechar e travar a loja', horarioLimite: '18:30', ordem: 8 } }),
  ]);

  // Registros de hoje — ~60% marcados como feitos
  const hojeDate = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const marcadores = [ana, carlos, julia, ana, carlos]; // quem marcou cada item

  for (let i = 0; i < 5; i++) {
    const item = itensChecklist[i]!;
    const marcador = marcadores[i]!;
    const [h = 9, m = 0] = (item.horarioLimite ?? '09:00').split(':').map(Number);
    const feitoEm = new Date(hoje);
    feitoEm.setHours(h, m - Math.floor(Math.random() * 10), 0, 0);

    await prisma.checklistRegistro.create({
      data: {
        itemId: item.id,
        userId: marcador.id,
        data: hojeDate,
        feito: true,
        feitoEm,
      },
    });
  }

  console.log('✅ Checklist criado');
  await syncPricingCatalog();
  console.log('✅ Catálogo comercial sincronizado');
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
