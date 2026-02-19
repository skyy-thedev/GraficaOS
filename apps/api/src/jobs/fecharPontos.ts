import { prisma } from '../prisma/client';

/**
 * Job de encerramento automático de pontos.
 * Roda às 22h e encerra todos os pontos de hoje que têm entrada mas não têm saída.
 */
export async function fecharPontosAbertos() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const horarioEncerramento = new Date();
  horarioEncerramento.setHours(22, 0, 0, 0);

  // Buscar pontos de hoje que têm entrada mas NÃO têm saída
  const pontosAbertos = await prisma.ponto.findMany({
    where: {
      date: hoje,
      entrada: { not: null },
      saida: null,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  if (pontosAbertos.length === 0) {
    console.log('✅ Nenhum ponto aberto para encerrar');
    return { encerrados: 0, usuarios: [] };
  }

  // Atualizar todos com saída = 22:00
  const resultado = await prisma.ponto.updateMany({
    where: {
      id: { in: pontosAbertos.map((p) => p.id) },
    },
    data: {
      saida: horarioEncerramento,
      encerramentoAutomatico: true,
    },
  });

  const usuarios = pontosAbertos.map((p) => ({
    id: p.user.id,
    name: p.user.name,
    entrada: p.entrada,
  }));

  console.log(`⏰ ${resultado.count} pontos encerrados automaticamente às 22h`);
  usuarios.forEach((u) => {
    console.log(`   → ${u.name} (entrada: ${u.entrada ? new Date(u.entrada).toLocaleTimeString('pt-BR') : '—'})`);
  });

  return { encerrados: resultado.count, usuarios };
}
