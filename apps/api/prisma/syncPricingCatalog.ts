import 'dotenv/config';
import { prisma } from '../src/prisma/client';
import { listProducts, syncPricingCatalog } from '../src/services/pricing.service';

async function main() {
  const before = await prisma.product.count();
  await syncPricingCatalog();
  const products = await listProducts();
  const after = products.length;

  const trackedNames = [
    'Plastificação RG',
    'Plastificação A4',
    'Foto 10x15',
    'Foto 13x18',
    'Foto 15x20',
    'Caneca Branca Personalizada',
    'Caneca Alça e Interior Colorido',
    'Caneca Alça Coração',
    'Caneca Colher Personalizada',
    'Gravação a Laser',
    'Criação de Arte Simples',
    'Edição de Arte Pronta',
    'Vetorização de Logo',
    'Criação de Arte Complexa',
    'Impressão 3D',
    'Banner Personalizado',
    'Porta Retrato 10x15',
    'Porta Retrato 15x20',
    'QR Code Personalizado',
    'Cartão Couchê 300g 100un',
    'Cartão Premium 600g',
    'Cartão Hot Stamping',
    'Cartão Holográfico',
    'PVC Premium',
    'Folder 1 Dobra',
    'Folder 2 Dobras',
    'Folder Sanfona',
    'Folder Carteira',
    'Flyer Couchê 10x15',
  ];

  const available = products
    .filter((product) => trackedNames.includes(product.name))
    .map((product) => product.name)
    .sort((first, second) => first.localeCompare(second));

  console.log(`Produtos antes: ${before}`);
  console.log(`Produtos após sync: ${after}`);
  console.log('Itens confirmados:');
  for (const name of available) {
    console.log(`- ${name}`);
  }
}

main()
  .catch((error) => {
    console.error('Erro ao sincronizar catálogo de pricing:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });