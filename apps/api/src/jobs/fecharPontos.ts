import { prisma } from '../prisma/client';

/**
 * Retorna a data/hora atual no fuso de São Paulo.
 */
function getBrazilNow(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  return new Date(
    Number(get('year')), Number(get('month')) - 1, Number(get('day')),
    Number(get('hour')), Number(get('minute')), Number(get('second'))
  );
}

/**
 * Job de encerramento automático de pontos.
 * Roda às 22h (horário de Brasília) e encerra todos os pontos de hoje que têm entrada mas não têm saída.
 */
export async function fecharPontosAbertos() {
  const br = getBrazilNow();
  const hoje = new Date(Date.UTC(br.getFullYear(), br.getMonth(), br.getDate()));

  const horarioEncerramento = new Date(
    br.getFullYear(), br.getMonth(), br.getDate(), 22, 0, 0
  );

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
