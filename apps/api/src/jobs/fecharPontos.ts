import { prisma } from '../prisma/client';
import { getHojeEmSaoPaulo, getAgoraEmSaoPaulo } from '../utils/timezone';

/**
 * Job de encerramento automático de pontos.
 * Roda às 22h (horário de Brasília) e encerra todos os pontos de hoje que têm entrada mas não têm saída.
 */
export async function fecharPontosAbertos() {
  const hoje = getHojeEmSaoPaulo();
  const agoraEmSP = getAgoraEmSaoPaulo();

  // Criar DateTime para 22:00 de hoje em SP e converter para JS Date (UTC)
  const horarioEncerramento = agoraEmSP.set({ hour: 22, minute: 0, second: 0, millisecond: 0 }).toJSDate();

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

  // Atualizar todos com saída = 22:00 (horário de Brasília, convertido para UTC)
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

  console.log(`⏰ ${resultado.count} pontos encerrados automaticamente às 22h (horário de Brasília)`);
  usuarios.forEach((u) => {
    console.log(`   → ${u.name}`);
  });

  return { encerrados: resultado.count, usuarios };
}
