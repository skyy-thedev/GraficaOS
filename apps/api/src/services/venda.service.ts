import { DateTime } from 'luxon';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/client';
import { previewPricing } from './pricing.service';

const responsavelSelect = {
  id: true,
  name: true,
  initials: true,
  avatarColor: true,
  loja: true,
} as const;

interface CreateVendaInput {
  clienteNome?: string;
  clienteDocumento?: string;
  clienteTelefone?: string;
  pricingProductId: string;
  quantidade: number;
  finishIds?: string[];
  sizeVariationId?: string;
  customWidthMeters?: number;
  customHeightMeters?: number;
  includeArtCreation?: boolean;
  descontoPercent?: number;
  urgencia?: 'NONE' | 'PRIORITARIO' | 'EXPRESS';
  status: 'AGUARDANDO' | 'CONCLUIDA';
  formaPagamento?: 'PIX' | 'DINHEIRO' | 'DEBITO' | 'CREDITO' | 'BOLETO' | 'TRANSFERENCIA' | 'OUTRO';
  observacoes?: string;
}

interface UpdateVendaInput {
  clienteNome?: string | null;
  clienteDocumento?: string | null;
  status?: 'AGUARDANDO' | 'CONCLUIDA';
  formaPagamento?: CreateVendaInput['formaPagamento'] | null;
  observacoes?: string | null;
}

async function gerarCodigoVenda(): Promise<string> {
  const anoAtual = DateTime.now().setZone('America/Sao_Paulo').year;
  const prefixo = `VDA-${anoAtual}-`;

  const vendas = await prisma.venda.findMany({
    where: {
      codigo: {
        startsWith: prefixo,
      },
    },
    select: { codigo: true },
  });

  const maiorNumero = vendas.reduce<number>((maior, venda: { codigo: string }) => {
    const match = venda.codigo.match(new RegExp(`^${prefixo}(\\d+)$`));
    const numero = match?.[1] ? Number.parseInt(match[1], 10) : 0;
    return Number.isNaN(numero) ? maior : Math.max(maior, numero);
  }, 0);

  return `${prefixo}${String(maiorNumero + 1).padStart(3, '0')}`;
}

function validarFormaPagamento(status: 'AGUARDANDO' | 'CONCLUIDA', formaPagamento?: string | null) {
  if (status === 'CONCLUIDA' && !formaPagamento) {
    throw Object.assign(new Error('Forma de pagamento é obrigatória para concluir a venda'), { statusCode: 400 });
  }
}

export async function listVendas(userId: string, role: 'ADMIN' | 'EMPLOYEE') {
  const where = role === 'ADMIN' ? {} : { responsavelId: userId };

  return prisma.venda.findMany({
    where,
    include: {
      responsavel: {
        select: responsavelSelect,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createVenda(userId: string, data: CreateVendaInput) {
  validarFormaPagamento(data.status, data.formaPagamento);

  const pricingResult = await previewPricing({
    productId: data.pricingProductId,
    quantity: data.quantidade,
    finishIds: data.finishIds,
    sizeVariationId: data.sizeVariationId,
    customWidthMeters: data.customWidthMeters,
    customHeightMeters: data.customHeightMeters,
    includeArtCreation: data.includeArtCreation,
    urgency: data.urgencia,
  });

  const descontoPercent = Math.min(30, Math.max(0, data.descontoPercent ?? 0));
  const valorOriginal = pricingResult.total;
  const valorTotal = descontoPercent > 0
    ? Number((valorOriginal * (1 - descontoPercent / 100)).toFixed(2))
    : valorOriginal;

  const createData = {
    codigo: await gerarCodigoVenda(),
    clienteNome: data.clienteNome?.trim() || null,
    clienteDocumento: data.clienteDocumento?.trim() || null,
    clienteTelefone: data.clienteTelefone?.trim() || null,
    produto: pricingResult.product.legacyProdutoTipo,
    produtoNome: pricingResult.product.name,
    pricingProductId: pricingResult.product.id,
    quantidade: data.quantidade,
    valorUnitario: pricingResult.baseUnitPrice,
    valorTotal,
    valorOriginal: descontoPercent > 0 ? valorOriginal : null,
    descontoPercent,
    subtotalBase: pricingResult.baseSubtotal,
    acabamentosValor: pricingResult.finishesAmount,
    urgenciaValor: pricingResult.urgency.amount,
    sizeVariationId: pricingResult.selectedSizeVariation?.id ?? null,
    sizeVariationNome: pricingResult.selectedSizeVariation?.name ?? null,
    acabamentos: pricingResult.selectedFinishes,
    pricingSnapshot: pricingResult,
    urgenciaNivel: pricingResult.urgency.level,
    status: data.status,
    formaPagamento: data.status === 'CONCLUIDA' ? data.formaPagamento ?? null : null,
    observacoes: data.observacoes?.trim() || null,
    responsavelId: userId,
    finalizadaEm: data.status === 'CONCLUIDA' ? new Date() : null,
  } as Prisma.VendaUncheckedCreateInput;

  return prisma.venda.create({
    data: createData,
    include: {
      responsavel: {
        select: responsavelSelect,
      },
    },
  });
}

export async function updateVenda(id: string, userId: string, role: 'ADMIN' | 'EMPLOYEE', data: UpdateVendaInput) {
  const venda = await prisma.venda.findFirst({
    where: role === 'ADMIN' ? { id } : { id, responsavelId: userId },
  });

  if (!venda) {
    throw Object.assign(new Error('Venda não encontrada'), { statusCode: 404 });
  }

  const nextStatus = data.status ?? venda.status;
  const nextFormaPagamento = data.formaPagamento === undefined ? venda.formaPagamento : data.formaPagamento;
  validarFormaPagamento(nextStatus, nextFormaPagamento);

  const updateData = {
    clienteNome: data.clienteNome === undefined ? undefined : (data.clienteNome?.trim() || null),
    clienteDocumento: data.clienteDocumento === undefined ? undefined : (data.clienteDocumento?.trim() || null),
    status: data.status,
    formaPagamento: nextStatus === 'CONCLUIDA' ? nextFormaPagamento ?? null : null,
    observacoes: data.observacoes === undefined ? undefined : (data.observacoes?.trim() || null),
    finalizadaEm: nextStatus === 'CONCLUIDA' ? (venda.finalizadaEm ?? new Date()) : null,
  } as Prisma.VendaUncheckedUpdateInput;

  return prisma.venda.update({
    where: { id },
    data: updateData,
    include: {
      responsavel: {
        select: responsavelSelect,
      },
    },
  });
}
