import { prisma } from '../prisma/client';
import fs from 'fs';
import path from 'path';

interface CreateArteInput {
  clienteNome: string;
  clienteNumero: string;
  orcamentoNum: string;
  produto: 'AZULEJO' | 'BANNER' | 'ADESIVO' | 'PLACA' | 'FAIXA' | 'OUTRO';
  quantidade?: number;
  largura: number;
  altura: number;
  responsavelId: string;
  urgencia?: 'LOW' | 'NORMAL' | 'HIGH';
  prazo?: string;
  observacoes?: string;
}

interface UpdateArteInput {
  clienteNome?: string;
  clienteNumero?: string;
  orcamentoNum?: string;
  produto?: 'AZULEJO' | 'BANNER' | 'ADESIVO' | 'PLACA' | 'FAIXA' | 'OUTRO';
  quantidade?: number;
  largura?: number;
  altura?: number;
  responsavelId?: string;
  urgencia?: 'LOW' | 'NORMAL' | 'HIGH';
  prazo?: string | null;
  observacoes?: string | null;
}

/** Gera o próximo código sequencial de arte (ART-001, ART-002...) */
async function gerarCodigoArte(): Promise<string> {
  const ultimaArte = await prisma.arte.findFirst({
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  });

  if (!ultimaArte) return 'ART-001';

  const ultimoNumero = parseInt(ultimaArte.codigo.replace('ART-', ''), 10);
  const novoNumero = (isNaN(ultimoNumero) ? 0 : ultimoNumero) + 1;
  return `ART-${novoNumero.toString().padStart(3, '0')}`;
}

/** Lista todas as artes (ADMIN) ou apenas as do usuário (EMPLOYEE) */
export async function listArtes(userId: string, role: string) {
  const where = role === 'ADMIN' ? {} : { responsavelId: userId };

  return prisma.arte.findMany({
    where,
    include: {
      responsavel: {
        select: { id: true, name: true, initials: true, avatarColor: true },
      },
      arquivos: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/** Cria uma nova arte com código gerado automaticamente */
export async function createArte(data: CreateArteInput) {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const codigo = await gerarCodigoArte();

    try {
      return await prisma.arte.create({
        data: {
          codigo,
          clienteNome: data.clienteNome,
          clienteNumero: data.clienteNumero,
          orcamentoNum: data.orcamentoNum,
          produto: data.produto,
          quantidade: data.quantidade ?? 1,
          largura: data.largura,
          altura: data.altura,
          responsavelId: data.responsavelId,
          urgencia: data.urgencia ?? 'NORMAL',
          prazo: data.prazo ? new Date(data.prazo) : null,
          observacoes: data.observacoes ?? null,
        },
        include: {
          responsavel: {
            select: { id: true, name: true, initials: true, avatarColor: true },
          },
          arquivos: true,
        },
      });
    } catch (err: unknown) {
      const isUniqueViolation =
        err instanceof Error &&
        err.message.includes('Unique constraint failed on the fields: (`codigo`)');

      if (!isUniqueViolation || attempt === MAX_RETRIES - 1) {
        throw err;
      }
      // Retry with a new codigo
    }
  }

  throw new Error('Falha ao gerar código único para a arte após múltiplas tentativas');
}

/** Atualiza uma arte existente */
export async function updateArte(id: string, data: UpdateArteInput) {
  const updateData: Record<string, unknown> = {};

  if (data.clienteNome !== undefined) updateData.clienteNome = data.clienteNome;
  if (data.clienteNumero !== undefined) updateData.clienteNumero = data.clienteNumero;
  if (data.orcamentoNum !== undefined) updateData.orcamentoNum = data.orcamentoNum;
  if (data.produto !== undefined) updateData.produto = data.produto;
  if (data.quantidade !== undefined) updateData.quantidade = data.quantidade;
  if (data.largura !== undefined) updateData.largura = data.largura;
  if (data.altura !== undefined) updateData.altura = data.altura;
  if (data.responsavelId !== undefined) updateData.responsavelId = data.responsavelId;
  if (data.urgencia !== undefined) updateData.urgencia = data.urgencia;
  if (data.prazo !== undefined) updateData.prazo = data.prazo ? new Date(data.prazo) : null;
  if (data.observacoes !== undefined) updateData.observacoes = data.observacoes;

  return prisma.arte.update({
    where: { id },
    data: updateData,
    include: {
      responsavel: {
        select: { id: true, name: true, initials: true, avatarColor: true },
      },
      arquivos: true,
    },
  });
}

/** Avança o status da arte */
export async function updateArteStatus(id: string, status: 'TODO' | 'DOING' | 'REVIEW' | 'DONE') {
  return prisma.arte.update({
    where: { id },
    data: { status },
    include: {
      responsavel: {
        select: { id: true, name: true, initials: true, avatarColor: true },
      },
      arquivos: true,
    },
  });
}

/** Exclui uma arte e seus arquivos */
export async function deleteArte(id: string) {
  // Busca os arquivos para remover do disco
  const arte = await prisma.arte.findUnique({
    where: { id },
    include: { arquivos: true },
  });

  if (!arte) {
    throw Object.assign(new Error('Arte não encontrada'), { statusCode: 404 });
  }

  // Remove os arquivos físicos
  for (const arquivo of arte.arquivos) {
    const filePath = path.resolve(arquivo.nomeStorage);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // O Cascade vai apagar os registros de Arquivo automaticamente
  return prisma.arte.delete({ where: { id } });
}

/** Adiciona arquivos de referência a uma arte */
export async function addArquivos(arteId: string, files: Express.Multer.File[]) {
  const arquivos = files.map((file) => ({
    arteId,
    nomeOriginal: file.originalname,
    nomeStorage: file.path,
    tipo: file.mimetype,
    tamanho: file.size,
    url: `/uploads/${file.filename}`,
  }));

  await prisma.arquivo.createMany({ data: arquivos });

  return prisma.arte.findUnique({
    where: { id: arteId },
    include: {
      responsavel: {
        select: { id: true, name: true, initials: true, avatarColor: true },
      },
      arquivos: true,
    },
  });
}

/** Remove um arquivo de referência */
export async function deleteArquivo(arteId: string, arquivoId: string) {
  const arquivo = await prisma.arquivo.findFirst({
    where: { id: arquivoId, arteId },
  });

  if (!arquivo) {
    throw Object.assign(new Error('Arquivo não encontrado'), { statusCode: 404 });
  }

  // Remove o arquivo físico
  const filePath = path.resolve(arquivo.nomeStorage);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  return prisma.arquivo.delete({ where: { id: arquivoId } });
}
