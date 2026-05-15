/**
 * migrate-catalog-v32.ts
 *
 * Migração segura do catálogo para v3.2 baseada na tabela comercial real.
 * NÃO apaga usuários, vendas, artes, pontos ou checklist.
 *
 * O que faz:
 *   1. Desativa produtos antigos com nomes da versão anterior
 *   2. Cria (ou atualiza por nome) os 10 produtos da planilha
 *   3. Mantém tudo o mais intacto
 *
 * Como rodar:
 *   npx tsx apps/api/prisma/migrate-catalog-v32.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLD_PRODUCT_NAMES = [
  'Cartão Couchê 300g 100un',
  'Cartão Premium 600g',
  'Cartão Hot Stamping',
  'Cartão Holográfico',
  'PVC Premium',
  'Flyer Couchê 10x15',
  'Folder 1 Dobra',
  'Folder 2 Dobras',
  'Folder Sanfona',
  'Folder Carteira',
];

interface NewProduct {
  name: string;
  description: string;
  category: string;
  premiumCategory: string;
  supplierCost: number;
  sortOrder: number;
  legacyProdutoTipo: string;
}

const NEW_PRODUCTS: NewProduct[] = [
  // ─── Cartões de Visita ─────────────────────────────────────────────────────
  {
    name: 'Couché Brilho 50un',
    description: 'Cartão couché 300g, 88×48mm, 4x0 (frente), sem enobrecimento, refile. Lote de 50 unidades.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Cartões de Visita',
    supplierCost: 36.99,   // venda 2.5×: R$ 92,48
    sortOrder: 110,
    legacyProdutoTipo: 'CARTAO_VISITA',
  },
  {
    name: 'Couché Brilho 100un F/V',
    description: 'Cartão couché 300g, 88×48mm, 4x4 (frente e verso), sem enobrecimento, refile. Lote de 100 unidades.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Cartões de Visita',
    supplierCost: 45.99,   // venda 2.5×: R$ 114,98
    sortOrder: 120,
    legacyProdutoTipo: 'CARTAO_VISITA',
  },
  {
    name: 'Premium 600g 100un',
    description: 'Cartão couché fosco 600g, 88×48mm, 4x4, laminação fosca, empastamento. Lote de 100 unidades.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Cartões de Visita',
    supplierCost: 73.99,   // venda 2.5×: R$ 184,98
    sortOrder: 130,
    legacyProdutoTipo: 'CARTAO_VISITA',
  },
  {
    name: 'Premium Luxo 250un',
    description: 'Cartão couché fosco 600g, 88×48mm, 4x4, Soft Touch + Hot Stamping Dourado, empastamento. Lote de 250 unidades.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Cartões de Visita',
    supplierCost: 114.99,  // venda 2.5×: R$ 287,48
    sortOrder: 140,
    legacyProdutoTipo: 'CARTAO_VISITA',
  },
  {
    name: 'Mini Cartão 100un',
    description: 'Cartão reciclato 240g, 43×48mm, 4x0, verniz localizado, refile. Lote de 100 unidades.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Cartões de Visita',
    supplierCost: 51.99,   // venda 2.5×: R$ 129,98
    sortOrder: 150,
    legacyProdutoTipo: 'CARTAO_VISITA',
  },
  {
    name: 'PVC Premium 50un',
    description: 'Cartão PVC Premium, 85×54mm, 4x0, 4 cantos arredondados. Lote de 50 unidades.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Cartões de Visita',
    supplierCost: 57.99,   // venda 2.5×: R$ 144,98
    sortOrder: 160,
    legacyProdutoTipo: 'CARTAO_VISITA',
  },
  // ─── Flyers ────────────────────────────────────────────────────────────────
  {
    name: 'Flyer Couché 10x15 1000un',
    description: 'Flyer couché 115g, 10×15cm, 4x0, sem enobrecimento, refile. Lote de 1000 unidades.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Flyers e Panfletos',
    supplierCost: 89.99,   // venda 2.5×: R$ 224,98
    sortOrder: 170,
    legacyProdutoTipo: 'PANFLETO',
  },
  {
    name: 'Flyer A5 F/V 2500un',
    description: 'Flyer couché 150g, A5, 4x4 (frente e verso), verniz total, refile. Lote de 2500 unidades.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Flyers e Panfletos',
    supplierCost: 189.99,  // venda 2.5×: R$ 474,98
    sortOrder: 180,
    legacyProdutoTipo: 'PANFLETO',
  },
  // ─── Folders ───────────────────────────────────────────────────────────────
  {
    name: 'Folder 1 Dobra 500un',
    description: 'Folder couché 170g, A4, 4x4, laminação fosca, 1 dobra. Lote de 500 unidades.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Folders e Institucionais',
    supplierCost: 249.99,  // venda 2.5×: R$ 624,98
    sortOrder: 190,
    legacyProdutoTipo: 'FOLDER',
  },
  {
    name: 'Folder 2 Dobras 1000un',
    description: 'Folder couché 170g, A3, 4x4, verniz total, 2 dobras. Lote de 1000 unidades.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Folders e Institucionais',
    supplierCost: 429.99,  // venda 2.5×: R$ 1.074,98
    sortOrder: 200,
    legacyProdutoTipo: 'FOLDER',
  },
];

async function main() {
  console.log('🔄 Iniciando migração do catálogo v3.2...\n');

  // 1. Desativar produtos antigos (não apaga — apenas tira do catálogo ativo)
  const deactivated = await prisma.product.updateMany({
    where: { name: { in: OLD_PRODUCT_NAMES } },
    data: { active: false },
  });
  console.log(`⛔ ${deactivated.count} produto(s) antigo(s) desativado(s)`);

  // 2. Obter IDs de acabamentos existentes para vincular
  const finishes = await prisma.productFinish.findMany({
    where: { active: true },
    select: { id: true },
  });
  const finishLinks = finishes.map((f) => ({ finishId: f.id }));

  // 3. Upsert por nome — cria se não existe, atualiza se já existe
  let created = 0;
  let updated = 0;

  for (const product of NEW_PRODUCTS) {
    const existing = await prisma.product.findUnique({
      where: { name: product.name },
      select: { id: true },
    });

    if (!existing) {
      await prisma.product.create({
        data: {
          name: product.name,
          description: product.description,
          category: product.category,
          premiumCategory: product.premiumCategory,
          pricingMode: 'OUTSOURCED',
          isOutsourced: true,
          supplierCost: product.supplierCost,
          urgencyEnabled: true,
          active: true,
          sortOrder: product.sortOrder,
          legacyProdutoTipo: product.legacyProdutoTipo as never,
          finishLinks: { create: finishLinks },
        },
      });
      console.log(`  ✅ Criado: ${product.name}`);
      created++;
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.productFinishProduct.deleteMany({ where: { productId: existing.id } });
        await tx.product.update({
          where: { id: existing.id },
          data: {
            description: product.description,
            category: product.category,
            premiumCategory: product.premiumCategory,
            pricingMode: 'OUTSOURCED',
            isOutsourced: true,
            supplierCost: product.supplierCost,
            urgencyEnabled: true,
            active: true,
            sortOrder: product.sortOrder,
            legacyProdutoTipo: product.legacyProdutoTipo as never,
            finishLinks: { create: finishLinks },
          },
        });
      });
      console.log(`  🔁 Atualizado: ${product.name}`);
      updated++;
    }
  }

  console.log(`\n✅ Migração concluída: ${created} criado(s), ${updated} atualizado(s)`);
  console.log('👤 Usuários, vendas, artes, pontos e checklist: intactos');
}

main()
  .catch((e) => {
    console.error('❌ Erro na migração:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
