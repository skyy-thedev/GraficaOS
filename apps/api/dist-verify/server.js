"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/server.ts
var server_exports = {};
__export(server_exports, {
  app: () => app
});
module.exports = __toCommonJS(server_exports);
var import_config = require("dotenv/config");
var import_express8 = __toESM(require("express"));
var import_cors = __toESM(require("cors"));
var import_node_cron = __toESM(require("node-cron"));

// src/config/env.ts
var import_zod = require("zod");
var envSchema = import_zod.z.object({
  DATABASE_URL: import_zod.z.string().url(),
  JWT_SECRET: import_zod.z.string().min(8),
  JWT_REFRESH_SECRET: import_zod.z.string().min(8),
  JWT_EXPIRES_IN: import_zod.z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: import_zod.z.string().default("7d"),
  UPLOAD_DIR: import_zod.z.string().default("./uploads"),
  MAX_FILE_SIZE_MB: import_zod.z.coerce.number().default(25),
  PORT: import_zod.z.coerce.number().default(3333),
  FRONTEND_URL: import_zod.z.string().default("http://localhost:5173"),
  FRONTEND_URLS: import_zod.z.string().default(""),
  NODE_ENV: import_zod.z.enum(["development", "production", "test"]).default("development"),
  // Email (para exportação de relatórios)
  // Resend (recomendado para Render/Vercel — funciona via HTTP)
  RESEND_API_KEY: import_zod.z.string().default(""),
  EMAIL_FROM: import_zod.z.string().default("Gr\xE1ficaOS <onboarding@resend.dev>"),
  // SMTP (fallback — pode não funcionar em hosts que bloqueiam porta 587)
  SMTP_HOST: import_zod.z.string().default(""),
  SMTP_PORT: import_zod.z.coerce.number().default(587),
  SMTP_USER: import_zod.z.string().default(""),
  SMTP_PASS: import_zod.z.string().default(""),
  SMTP_FROM: import_zod.z.string().default("Gr\xE1ficaOS <noreply@graficaos.com>"),
  // Horário considerado "pontual" (HH:MM) — 15min de tolerância após entrada às 10h
  HORARIO_ENTRADA_PONTUAL: import_zod.z.string().default("10:15")
});
var parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("\u274C Vari\xE1veis de ambiente inv\xE1lidas:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}
var env = parsed.data;

// src/middlewares/errorHandler.ts
function errorHandler(err, _req, res, _next) {
  console.error("\u274C Erro:", err.message);
  if (err.code === "P2002") {
    res.status(409).json({
      message: "Registro duplicado. Este dado j\xE1 existe no sistema."
    });
    return;
  }
  if (err.code === "P2025") {
    res.status(404).json({
      message: "Registro n\xE3o encontrado."
    });
    return;
  }
  const statusCode = err.statusCode ?? 500;
  const message = statusCode === 500 ? "Erro interno do servidor" : err.message;
  res.status(statusCode).json({ message });
}

// src/routes/auth.routes.ts
var import_express = require("express");
var import_express_rate_limit = __toESM(require("express-rate-limit"));

// src/controllers/auth.controller.ts
var import_zod2 = require("zod");

// src/services/auth.service.ts
var import_bcryptjs = __toESM(require("bcryptjs"));
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));

// src/prisma/client.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
});

// src/services/auth.service.ts
function parseJwtExpiresIn(value) {
  const normalizedValue = value.trim().toLowerCase();
  if (/^\d+$/.test(normalizedValue)) {
    return Number(normalizedValue);
  }
  if (/^\d+(ms|s|m|h|d|w|y)$/.test(normalizedValue)) {
    return normalizedValue;
  }
  throw new Error(`Formato inv\xE1lido para expira\xE7\xE3o JWT: ${value}`);
}
function generateToken(userId, role) {
  return import_jsonwebtoken.default.sign({ sub: userId, role }, env.JWT_SECRET, {
    expiresIn: parseJwtExpiresIn(env.JWT_EXPIRES_IN)
  });
}
function generateRefreshToken(userId, role) {
  return import_jsonwebtoken.default.sign({ sub: userId, role }, env.JWT_REFRESH_SECRET, {
    expiresIn: parseJwtExpiresIn(env.JWT_REFRESH_EXPIRES_IN)
  });
}
async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email }
  });
  if (!user || !user.active) {
    throw Object.assign(new Error("Email ou senha inv\xE1lidos"), { statusCode: 401 });
  }
  const passwordMatch = await import_bcryptjs.default.compare(password, user.password);
  if (!passwordMatch) {
    throw Object.assign(new Error("Email ou senha inv\xE1lidos"), { statusCode: 401 });
  }
  const token = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id, user.role);
  return {
    token,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      loja: user.loja,
      jornadaEntrada: user.jornadaEntrada,
      jornadaSaida: user.jornadaSaida,
      avatarColor: user.avatarColor,
      initials: user.initials
    }
  };
}
async function refreshAccessToken(refreshToken) {
  try {
    const decoded = import_jsonwebtoken.default.verify(refreshToken, env.JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, role: true, active: true }
    });
    if (!user || !user.active) {
      throw Object.assign(new Error("Usu\xE1rio inativo"), { statusCode: 401 });
    }
    const token = generateToken(user.id, user.role);
    return { token };
  } catch {
    throw Object.assign(new Error("Refresh token inv\xE1lido"), { statusCode: 401 });
  }
}
async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      loja: true,
      jornadaEntrada: true,
      jornadaSaida: true,
      avatarColor: true,
      initials: true,
      active: true,
      createdAt: true
    }
  });
  if (!user || !user.active) {
    throw Object.assign(new Error("Usu\xE1rio n\xE3o encontrado"), { statusCode: 404 });
  }
  return user;
}

// src/controllers/auth.controller.ts
var loginSchema = import_zod2.z.object({
  email: import_zod2.z.string().email("Email inv\xE1lido"),
  password: import_zod2.z.string().min(1, "Senha \xE9 obrigat\xF3ria")
});
var refreshSchema = import_zod2.z.object({
  refreshToken: import_zod2.z.string().min(1, "Refresh token \xE9 obrigat\xF3rio")
});
async function login2(req, res, next) {
  try {
    const body = loginSchema.parse(req.body);
    const result = await login(body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
async function refresh(req, res, next) {
  try {
    const body = refreshSchema.parse(req.body);
    const result = await refreshAccessToken(body.refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
async function logout(_req, res) {
  res.json({ message: "Logout realizado com sucesso" });
}
async function me(req, res, next) {
  try {
    const user = await getMe(req.userId);
    res.json(user);
  } catch (error) {
    next(error);
  }
}

// src/middlewares/auth.ts
var import_jsonwebtoken2 = __toESM(require("jsonwebtoken"));
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token n\xE3o fornecido" });
    return;
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({ message: "Token inv\xE1lido" });
    return;
  }
  try {
    const decoded = import_jsonwebtoken2.default.verify(token, env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, role: true, active: true }
    });
    if (!user || !user.active) {
      res.status(401).json({ message: "Usu\xE1rio inativo ou n\xE3o encontrado" });
      return;
    }
    req.userId = decoded.sub;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ message: "Token inv\xE1lido ou expirado" });
    return;
  }
}
function adminOnly(req, res, next) {
  if (req.userRole !== "ADMIN") {
    res.status(403).json({ message: "Acesso restrito a administradores" });
    return;
  }
  next();
}

// src/routes/auth.routes.ts
var router = (0, import_express.Router)();
var loginLimiter = (0, import_express_rate_limit.default)({
  windowMs: 60 * 1e3,
  // 1 minuto
  max: 10,
  message: { message: "Muitas tentativas de login. Tente novamente em 1 minuto." },
  standardHeaders: true,
  legacyHeaders: false
});
router.post("/login", loginLimiter, login2);
router.post("/refresh", refresh);
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, me);

// src/routes/user.routes.ts
var import_express2 = require("express");

// src/controllers/user.controller.ts
var import_zod3 = require("zod");

// src/services/user.service.ts
var import_bcryptjs2 = __toESM(require("bcryptjs"));
function getInitials(name) {
  const parts = name.trim().split(" ");
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      loja: true,
      jornadaEntrada: true,
      jornadaSaida: true,
      avatarColor: true,
      initials: true,
      active: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { name: "asc" }
  });
}
async function createUser(data) {
  const hashedPassword = await import_bcryptjs2.default.hash(data.password, 12);
  const initials = getInitials(data.name);
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role ?? "EMPLOYEE",
      loja: data.loja ?? "PAPER_OFFICE_I",
      jornadaEntrada: data.jornadaEntrada ?? "10:00",
      jornadaSaida: data.jornadaSaida ?? "18:30",
      avatarColor: data.avatarColor ?? "#6c63ff",
      initials
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      loja: true,
      jornadaEntrada: true,
      jornadaSaida: true,
      avatarColor: true,
      initials: true,
      active: true,
      createdAt: true
    }
  });
}
async function updateUser(id, data) {
  const updateData = {};
  if (data.name) {
    updateData.name = data.name;
    updateData.initials = getInitials(data.name);
  }
  if (data.email) updateData.email = data.email;
  if (data.role) updateData.role = data.role;
  if (data.loja) updateData.loja = data.loja;
  if (data.jornadaEntrada) updateData.jornadaEntrada = data.jornadaEntrada;
  if (data.jornadaSaida) updateData.jornadaSaida = data.jornadaSaida;
  if (data.avatarColor) updateData.avatarColor = data.avatarColor;
  if (data.active !== void 0) updateData.active = data.active;
  if (data.password) {
    updateData.password = await import_bcryptjs2.default.hash(data.password, 12);
  }
  return prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      loja: true,
      jornadaEntrada: true,
      jornadaSaida: true,
      avatarColor: true,
      initials: true,
      active: true,
      createdAt: true,
      updatedAt: true
    }
  });
}
async function deleteUser(id) {
  return prisma.user.update({
    where: { id },
    data: { active: false },
    select: {
      id: true,
      name: true,
      active: true
    }
  });
}
async function hardDeleteUser(id) {
  await prisma.checklistRegistro.deleteMany({ where: { userId: id } });
  await prisma.ponto.deleteMany({ where: { userId: id } });
  const artes = await prisma.arte.findMany({ where: { responsavelId: id }, select: { id: true } });
  if (artes.length > 0) {
    const arteIds = artes.map((a) => a.id);
    await prisma.arquivo.deleteMany({ where: { arteId: { in: arteIds } } });
    await prisma.arte.deleteMany({ where: { responsavelId: id } });
  }
  return prisma.user.delete({
    where: { id },
    select: {
      id: true,
      name: true
    }
  });
}

// src/controllers/user.controller.ts
var timeSchema = import_zod3.z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Hor\xE1rio deve estar no formato HH:mm");
var createUserSchema = import_zod3.z.object({
  name: import_zod3.z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: import_zod3.z.string().email("Email inv\xE1lido"),
  password: import_zod3.z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  role: import_zod3.z.enum(["ADMIN", "EMPLOYEE"]).optional(),
  loja: import_zod3.z.enum(["PAPER_OFFICE_I", "PAPER_OFFICE_II"]).optional(),
  jornadaEntrada: timeSchema.optional(),
  jornadaSaida: timeSchema.optional(),
  avatarColor: import_zod3.z.string().optional()
});
var updateUserSchema = import_zod3.z.object({
  name: import_zod3.z.string().min(2).optional(),
  email: import_zod3.z.string().email().optional(),
  password: import_zod3.z.string().min(6).optional(),
  role: import_zod3.z.enum(["ADMIN", "EMPLOYEE"]).optional(),
  loja: import_zod3.z.enum(["PAPER_OFFICE_I", "PAPER_OFFICE_II"]).optional(),
  jornadaEntrada: timeSchema.optional(),
  jornadaSaida: timeSchema.optional(),
  avatarColor: import_zod3.z.string().optional(),
  active: import_zod3.z.boolean().optional()
});
async function list(_req, res, next) {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
}
async function create(req, res, next) {
  try {
    const body = createUserSchema.parse(req.body);
    const user = await createUser(body);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
}
async function update(req, res, next) {
  try {
    const body = updateUserSchema.parse(req.body);
    const user = await updateUser(req.params.id, body);
    res.json(user);
  } catch (error) {
    next(error);
  }
}
async function remove(req, res, next) {
  try {
    const user = await deleteUser(req.params.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
}
async function hardRemove(req, res, next) {
  try {
    const user = await hardDeleteUser(req.params.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
}

// src/routes/user.routes.ts
var router2 = (0, import_express2.Router)();
router2.use(authMiddleware);
router2.use(adminOnly);
router2.get("/", list);
router2.post("/", create);
router2.put("/:id", update);
router2.delete("/:id", remove);
router2.delete("/:id/permanent", hardRemove);

// src/routes/ponto.routes.ts
var import_express3 = require("express");

// src/controllers/ponto.controller.ts
var import_zod4 = require("zod");

// src/services/ponto.service.ts
var import_jsonwebtoken3 = __toESM(require("jsonwebtoken"));
var import_exceljs = __toESM(require("exceljs"));
var import_pdfkit = __toESM(require("pdfkit"));
var import_nodemailer = __toESM(require("nodemailer"));
var import_resend = require("resend");
var import_luxon2 = require("luxon");

// src/utils/timezone.ts
var import_luxon = require("luxon");
var TIMEZONE = "America/Sao_Paulo";
function toSaoPaulo(date) {
  return import_luxon.DateTime.fromJSDate(date, { zone: "UTC" }).setZone(TIMEZONE);
}
function getHojeEmSaoPaulo() {
  const agoraEmSP = import_luxon.DateTime.now().setZone(TIMEZONE);
  return import_luxon.DateTime.utc(
    agoraEmSP.year,
    agoraEmSP.month,
    agoraEmSP.day,
    0,
    0,
    0,
    0
  ).toJSDate();
}
function getAgoraEmSaoPaulo() {
  return import_luxon.DateTime.now().setZone(TIMEZONE);
}
function parseDateOnly(date) {
  return import_luxon.DateTime.fromObject(
    { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
  );
}
function formatarDateOnlyBR(date) {
  return parseDateOnly(date).toFormat("dd/MM/yyyy");
}
function formatarHoraBR(date) {
  if (!date) return "\u2014";
  const dt = date instanceof Date ? toSaoPaulo(date) : date;
  return dt.toFormat("HH:mm");
}
function formatarDataHoraBR(date) {
  const dt = date instanceof Date ? toSaoPaulo(date) : date;
  return dt.toFormat("dd/MM/yyyy HH:mm");
}
function getHoraMinutoSP(date) {
  const dt = toSaoPaulo(date);
  return { hora: dt.hour, minuto: dt.minute };
}

// src/services/ponto.service.ts
async function listPontos(userId, role) {
  const where = role === "ADMIN" ? {} : { userId };
  return prisma.ponto.findMany({
    where,
    include: {
      user: {
        select: { id: true, name: true, initials: true, avatarColor: true, loja: true }
      }
    },
    orderBy: { date: "desc" }
  });
}
async function getPontoHoje(userId) {
  const today = getHojeEmSaoPaulo();
  let ponto = await prisma.ponto.findUnique({
    where: {
      userId_date: { userId, date: today }
    },
    include: {
      user: {
        select: { id: true, name: true, initials: true, avatarColor: true, loja: true }
      }
    }
  });
  return ponto;
}
async function baterPonto(userId) {
  const today = getHojeEmSaoPaulo();
  const agora = /* @__PURE__ */ new Date();
  let ponto = await prisma.ponto.findUnique({
    where: {
      userId_date: { userId, date: today }
    }
  });
  if (!ponto) {
    ponto = await prisma.ponto.create({
      data: {
        userId,
        date: today,
        entrada: agora
      }
    });
    return getPontoComUser(ponto.id);
  }
  if (ponto.entrada === null) {
    ponto = await prisma.ponto.update({
      where: { id: ponto.id },
      data: { entrada: agora }
    });
  } else if (ponto.almoco === null) {
    ponto = await prisma.ponto.update({
      where: { id: ponto.id },
      data: { almoco: agora }
    });
  } else if (ponto.retorno === null) {
    ponto = await prisma.ponto.update({
      where: { id: ponto.id },
      data: { retorno: agora }
    });
  } else if (ponto.saida === null) {
    ponto = await prisma.ponto.update({
      where: { id: ponto.id },
      data: { saida: agora }
    });
  } else {
    throw Object.assign(new Error("Jornada do dia j\xE1 encerrada"), { statusCode: 400 });
  }
  return getPontoComUser(ponto.id);
}
async function getPontoComUser(pontoId) {
  return prisma.ponto.findUnique({
    where: { id: pontoId },
    include: {
      user: {
        select: { id: true, name: true, initials: true, avatarColor: true, loja: true }
      }
    }
  });
}
function getStatusComprovante(ponto) {
  if (ponto.status) {
    return ponto.status;
  }
  if (ponto.entrada || ponto.saida) {
    return "NORMAL";
  }
  return "FALTA";
}
async function getPontoComprovanteById(pontoId) {
  return prisma.ponto.findUnique({
    where: { id: pontoId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          loja: true,
          role: true
        }
      }
    }
  });
}
async function gerarTokenComprovante(params) {
  const { pontoId, requestUserId, requestUserRole } = params;
  const ponto = await prisma.ponto.findUnique({
    where: { id: pontoId },
    select: { id: true, userId: true }
  });
  if (!ponto) {
    throw Object.assign(new Error("Ponto n\xE3o encontrado"), { statusCode: 404 });
  }
  if (requestUserRole !== "ADMIN" && ponto.userId !== requestUserId) {
    throw Object.assign(new Error("Voc\xEA n\xE3o tem acesso a este comprovante"), { statusCode: 403 });
  }
  const token = import_jsonwebtoken3.default.sign(
    {
      type: "PONTO_COMPROVANTE",
      pontoId: ponto.id,
      userId: ponto.userId
    },
    env.JWT_SECRET,
    { expiresIn: "365d" }
  );
  return {
    token,
    urlValidacao: `${env.FRONTEND_URL.replace(/\/$/, "")}/validar-comprovante/${token}`
  };
}
async function validarComprovanteToken(token) {
  let payload;
  try {
    payload = import_jsonwebtoken3.default.verify(token, env.JWT_SECRET);
  } catch {
    throw Object.assign(new Error("Token do comprovante inv\xE1lido ou expirado"), { statusCode: 400 });
  }
  if (payload.type !== "PONTO_COMPROVANTE" || !payload.pontoId || !payload.userId) {
    throw Object.assign(new Error("Token do comprovante inv\xE1lido"), { statusCode: 400 });
  }
  const ponto = await getPontoComprovanteById(payload.pontoId);
  if (!ponto || ponto.userId !== payload.userId) {
    throw Object.assign(new Error("Comprovante n\xE3o encontrado"), { statusCode: 404 });
  }
  return {
    pontoId: ponto.id,
    urlValidacao: `${env.FRONTEND_URL.replace(/\/$/, "")}/validar-comprovante/${token}`,
    verificadoEm: (/* @__PURE__ */ new Date()).toISOString(),
    funcionario: {
      id: ponto.user.id,
      nome: ponto.user.name,
      loja: ponto.user.loja,
      role: ponto.user.role
    },
    expediente: {
      data: ponto.date.toISOString(),
      status: getStatusComprovante(ponto),
      horasTrabalhadas: calcularHoras(ponto),
      encerramentoAutomatico: ponto.encerramentoAutomatico,
      emitidoEm: ponto.updatedAt.toISOString()
    },
    registros: {
      entrada: ponto.entrada?.toISOString() ?? null,
      almoco: ponto.almoco?.toISOString() ?? null,
      retorno: ponto.retorno?.toISOString() ?? null,
      saida: ponto.saida?.toISOString() ?? null
    }
  };
}
function calcularHoras(ponto) {
  if (!ponto.entrada || !ponto.saida) return null;
  let totalMs = ponto.saida.getTime() - ponto.entrada.getTime();
  if (ponto.almoco && ponto.retorno) {
    const almocoMs = ponto.retorno.getTime() - ponto.almoco.getTime();
    totalMs -= almocoMs;
  }
  const totalMinutes = Math.floor(totalMs / 6e4);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${minutes.toString().padStart(2, "0")}m`;
}
async function getRelatorio(params) {
  const { userId, loja, startDate, endDate, requestUserId, requestUserRole } = params;
  const filterUserId = requestUserRole === "ADMIN" ? userId ?? void 0 : requestUserId;
  const usuariosEscopo = await carregarUsuariosEscopo(filterUserId, requestUserRole === "ADMIN" ? loja : void 0);
  const userIds = usuariosEscopo.map((user) => user.id);
  const pontos = await prisma.ponto.findMany({
    where: {
      ...userIds.length > 0 ? { userId: { in: userIds } } : { userId: "__no-user__" },
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    },
    include: {
      user: {
        select: { id: true, name: true, initials: true, avatarColor: true, loja: true }
      }
    },
    orderBy: { date: "asc" }
  });
  return pontos.map((ponto) => ({
    ...ponto,
    horasTrabalhadas: calcularHoras(ponto)
  }));
}
function listarDatasPeriodo(startDate, endDate) {
  const datas = [];
  let cursor = import_luxon2.DateTime.fromISO(startDate, { zone: "utc" }).startOf("day");
  const end = import_luxon2.DateTime.fromISO(endDate, { zone: "utc" }).startOf("day");
  while (cursor <= end) {
    datas.push(cursor.toISODate());
    cursor = cursor.plus({ days: 1 });
  }
  return datas;
}
function getHojeDateKeySP() {
  return import_luxon2.DateTime.now().setZone("America/Sao_Paulo").toISODate();
}
function limitarDataFinalAoHoje(endDate) {
  const hoje2 = getHojeDateKeySP();
  return endDate < hoje2 ? endDate : hoje2;
}
function getDateOnlyKey(date) {
  return parseDateOnly(date).toISODate();
}
function getDiaSemanaDateKey(dateKey) {
  return import_luxon2.DateTime.fromISO(dateKey, { zone: "utc" }).weekday % 7;
}
function isDiaUtilDateKey(dateKey) {
  return true;
}
function getWeekLabelFromDateKey(dateKey) {
  return import_luxon2.DateTime.fromISO(dateKey, { zone: "utc" }).startOf("week").toFormat("dd/MM");
}
function getEasterDateKey(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = (h + l - 7 * m + 114) % 31 + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function shiftDateKey(dateKey, days) {
  return import_luxon2.DateTime.fromISO(dateKey, { zone: "utc" }).plus({ days }).toISODate();
}
function isFeriadoDateKey(dateKey) {
  const fixedHolidays = /* @__PURE__ */ new Set([
    "01-01",
    "04-21",
    "05-01",
    "09-07",
    "10-12",
    "11-02",
    "11-15",
    "11-20",
    "12-25"
  ]);
  const [, month, day] = dateKey.split("-");
  if (fixedHolidays.has(`${month}-${day}`)) {
    return true;
  }
  const year = Number(dateKey.slice(0, 4));
  const pascoa = getEasterDateKey(year);
  const moveableHolidays = /* @__PURE__ */ new Set([
    shiftDateKey(pascoa, -48),
    shiftDateKey(pascoa, -47),
    shiftDateKey(pascoa, -2),
    pascoa,
    shiftDateKey(pascoa, 60)
  ]);
  return moveableHolidays.has(dateKey);
}
function buildPontoMap(pontos) {
  return new Map(pontos.map((ponto) => [`${ponto.userId}:${getDateOnlyKey(new Date(ponto.date))}`, ponto]));
}
function isEntradaPontualPorJornada(params) {
  const { entrada, jornadaEntrada, dateKey, toleranciaMinutos = 15 } = params;
  const { hora, minuto } = getHoraMinutoSP(entrada);
  const entradaMinutos = hora * 60 + minuto;
  const [jornadaHora, jornadaMinuto] = jornadaEntrada.split(":").map(Number);
  const jornadaMinutos = (jornadaHora ?? 0) * 60 + (jornadaMinuto ?? 0);
  const diaSemana = getDiaSemanaDateKey(dateKey);
  const feriado = isFeriadoDateKey(dateKey);
  if (diaSemana === 0 || feriado) {
    const jornadaDomingoMinutos = 12 * 60;
    if (entradaMinutos <= jornadaDomingoMinutos + toleranciaMinutos) {
      return true;
    }
  }
  return entradaMinutos <= jornadaMinutos + toleranciaMinutos;
}
async function carregarUsuariosEscopo(filterUserId, loja) {
  if (filterUserId) {
    const user = await prisma.user.findUnique({
      where: { id: filterUserId },
      select: { id: true, name: true, jornadaEntrada: true, role: true, loja: true, active: true }
    });
    return user && user.active && user.role === "EMPLOYEE" && (!loja || user.loja === loja) ? [{ id: user.id, name: user.name, jornadaEntrada: user.jornadaEntrada, role: user.role }] : [];
  }
  return prisma.user.findMany({
    where: { active: true, role: "EMPLOYEE", ...loja ? { loja } : {} },
    select: { id: true, name: true, jornadaEntrada: true, role: true },
    orderBy: { name: "asc" }
  });
}
async function carregarFolgasPorUsuario(userIds) {
  const folgaMap = /* @__PURE__ */ new Map();
  if (userIds.length === 0) {
    return folgaMap;
  }
  const folgas = await prisma.folgaConfig.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, diaSemana: true }
  });
  for (const userId of userIds) {
    folgaMap.set(userId, /* @__PURE__ */ new Set());
  }
  for (const folga of folgas) {
    folgaMap.get(folga.userId)?.add(folga.diaSemana);
  }
  return folgaMap;
}
function isDiaEsperadoParaTrabalho(params) {
  const { dateKey, folgaDiasSemana, ponto } = params;
  if (!isDiaUtilDateKey(dateKey)) return false;
  if (folgaDiasSemana.has(getDiaSemanaDateKey(dateKey))) return false;
  if (ponto?.status === "FOLGA") return false;
  return true;
}
function calcularStreaksEsperados(params) {
  const hoje2 = import_luxon2.DateTime.now().setZone("America/Sao_Paulo").toISODate();
  const datasRelevantes = params.datasPeriodo.filter((dateKey) => dateKey <= hoje2).filter((dateKey) => {
    const ponto = params.pontoMap.get(`${params.userId}:${dateKey}`);
    return isDiaEsperadoParaTrabalho({ dateKey, folgaDiasSemana: params.folgaDiasSemana, ponto });
  }).sort((a, b) => b.localeCompare(a));
  let streakAtual = 0;
  let maiorStreak = 0;
  let currentRun = 0;
  let contandoAtual = true;
  for (const dateKey of datasRelevantes) {
    const ponto = params.pontoMap.get(`${params.userId}:${dateKey}`);
    const presente = !!ponto?.entrada;
    if (presente) {
      currentRun++;
      if (contandoAtual) {
        streakAtual++;
      }
    } else {
      contandoAtual = false;
      if (currentRun > maiorStreak) {
        maiorStreak = currentRun;
      }
      currentRun = 0;
    }
  }
  if (currentRun > maiorStreak) {
    maiorStreak = currentRun;
  }
  return { streakAtual, maiorStreak };
}
async function getMetricas(params) {
  const { userId, loja, startDate, endDate, requestUserId, requestUserRole } = params;
  const endDateLimitado = limitarDataFinalAoHoje(endDate);
  const filterUserId = requestUserRole === "ADMIN" ? userId ?? void 0 : requestUserId;
  const usuariosEscopo = await carregarUsuariosEscopo(filterUserId, requestUserRole === "ADMIN" ? loja : void 0);
  const userIds = usuariosEscopo.map((user) => user.id);
  const jornadaMap = new Map(usuariosEscopo.map((user) => [user.id, user.jornadaEntrada]));
  const folgaMap = await carregarFolgasPorUsuario(userIds);
  const datasPeriodo = startDate <= endDateLimitado ? listarDatasPeriodo(startDate, endDateLimitado) : [];
  const pontos = await prisma.ponto.findMany({
    where: {
      ...userIds.length > 0 ? { userId: { in: userIds } } : { userId: "__no-user__" },
      date: { gte: new Date(startDate), lte: new Date(endDateLimitado) }
    },
    include: {
      user: { select: { id: true, name: true } }
    },
    orderBy: { date: "asc" }
  });
  const pontoMap = buildPontoMap(pontos);
  let totalDias = 0;
  let diasTrabalhados = 0;
  let diasFalta = 0;
  const weekMap = /* @__PURE__ */ new Map();
  for (const user of usuariosEscopo) {
    const folgaDiasSemana = folgaMap.get(user.id) ?? /* @__PURE__ */ new Set();
    for (const dateKey of datasPeriodo) {
      const ponto = pontoMap.get(`${user.id}:${dateKey}`);
      if (!isDiaEsperadoParaTrabalho({ dateKey, folgaDiasSemana, ponto })) {
        continue;
      }
      totalDias++;
      const weekLabel = getWeekLabelFromDateKey(dateKey);
      if (!weekMap.has(weekLabel)) {
        weekMap.set(weekLabel, { presencas: 0, total: 0 });
      }
      const week = weekMap.get(weekLabel);
      week.total++;
      if (ponto?.entrada) {
        diasTrabalhados++;
        week.presencas++;
      } else {
        diasFalta++;
      }
    }
  }
  const percentualPresenca = totalDias > 0 ? Math.round(diasTrabalhados / totalDias * 100) : 0;
  let totalMinutos = 0;
  const horasPorDiaMap = /* @__PURE__ */ new Map();
  let diasPontuais = 0;
  let encerramentosAutomaticos = 0;
  for (const ponto of pontos) {
    const mins = calcularMinutos(ponto);
    totalMinutos += mins;
    const dateKey = getDateOnlyKey(new Date(ponto.date));
    horasPorDiaMap.set(dateKey, (horasPorDiaMap.get(dateKey) ?? 0) + mins);
    if (ponto.entrada) {
      const jornadaEntrada = jornadaMap.get(ponto.userId) ?? env.HORARIO_ENTRADA_PONTUAL;
      if (isEntradaPontualPorJornada({ entrada: new Date(ponto.entrada), jornadaEntrada, dateKey, toleranciaMinutos: 15 })) {
        diasPontuais++;
      }
    }
    if (ponto.encerramentoAutomatico) {
      encerramentosAutomaticos++;
    }
  }
  const horasPorDia = Array.from(horasPorDiaMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([dateKey, minutos]) => ({
    data: import_luxon2.DateTime.fromISO(dateKey, { zone: "utc" }).toFormat("dd/MM"),
    horas: Math.round(minutos / 60 * 100) / 100
  }));
  const totalH = Math.floor(totalMinutos / 60);
  const totalM = totalMinutos % 60;
  const totalHorasTrabalhadas = `${totalH}h${totalM.toString().padStart(2, "0")}m`;
  const mediaMinutosPorDia = diasTrabalhados > 0 ? Math.round(totalMinutos / diasTrabalhados) : 0;
  const mediaH = Math.floor(mediaMinutosPorDia / 60);
  const mediaM = mediaMinutosPorDia % 60;
  const mediaHorasPorDia = `${mediaH}h${mediaM.toString().padStart(2, "0")}m`;
  const percentualPontualidade = diasTrabalhados > 0 ? Math.round(diasPontuais / diasTrabalhados * 100) : 0;
  const { streakAtual, maiorStreak } = usuariosEscopo.length === 1 ? calcularStreaksEsperados({
    userId: usuariosEscopo[0].id,
    datasPeriodo,
    pontoMap,
    folgaDiasSemana: folgaMap.get(usuariosEscopo[0].id) ?? /* @__PURE__ */ new Set()
  }) : { streakAtual: 0, maiorStreak: 0 };
  const frequenciaSemanal = Array.from(weekMap.entries()).map(([semana, data]) => ({
    semana,
    ...data
  }));
  return {
    periodo: { inicio: startDate, fim: endDateLimitado },
    totalDias,
    diasTrabalhados,
    diasFalta,
    percentualPresenca,
    totalHorasTrabalhadas,
    mediaHorasPorDia,
    diasPontuais,
    percentualPontualidade,
    streakAtual,
    maiorStreak,
    encerramentosAutomaticos,
    horasPorDia,
    frequenciaSemanal
  };
}
function calcularMinutos(ponto) {
  if (!ponto.entrada) return 0;
  const fimRef = ponto.saida ?? /* @__PURE__ */ new Date();
  let totalMs = fimRef.getTime() - ponto.entrada.getTime();
  if (ponto.almoco && ponto.retorno) {
    totalMs -= ponto.retorno.getTime() - ponto.almoco.getTime();
  }
  return Math.max(0, Math.floor(totalMs / 6e4));
}
function pontosToRows(pontos) {
  return pontos.map((p) => {
    const horas = calcularHoras(p) ?? "\u2014";
    let status = "Ausente";
    if (p.saida) status = "Completo";
    else if (p.entrada) status = "Parcial";
    return {
      nome: p.user.name,
      data: formatarDateOnlyBR(new Date(p.date)),
      entrada: formatarHoraBR(p.entrada ? new Date(p.entrada) : null),
      almoco: formatarHoraBR(p.almoco ? new Date(p.almoco) : null),
      retorno: formatarHoraBR(p.retorno ? new Date(p.retorno) : null),
      saida: formatarHoraBR(p.saida ? new Date(p.saida) : null),
      horas,
      status,
      encAuto: p.encerramentoAutomatico ? "Sim" : "N\xE3o"
    };
  });
}
async function fetchExportPontos(params) {
  const usuariosEscopo = await carregarUsuariosEscopo(params.userId, params.loja);
  const userIds = usuariosEscopo.map((user) => user.id);
  return prisma.ponto.findMany({
    where: {
      ...userIds.length > 0 ? { userId: { in: userIds } } : { userId: "__no-user__" },
      date: { gte: new Date(params.startDate), lte: new Date(params.endDate) }
    },
    include: { user: { select: { id: true, name: true, initials: true, avatarColor: true } } },
    orderBy: { date: "asc" }
  });
}
async function exportCSV(params) {
  const pontos = await fetchExportPontos(params);
  const rows = pontosToRows(pontos);
  const header = "Funcion\xE1rio,Data,Entrada,Almo\xE7o,Retorno,Sa\xEDda,Horas Trabalhadas,Status,Enc.Auto\n";
  const csvRows = rows.map(
    (r) => `"${r.nome}","${r.data}","${r.entrada}","${r.almoco}","${r.retorno}","${r.saida}","${r.horas}","${r.status}","${r.encAuto}"`
  );
  return "\uFEFF" + header + csvRows.join("\n");
}
async function exportXLSX(params) {
  const pontos = await fetchExportPontos(params);
  const rows = pontosToRows(pontos);
  const workbook = new import_exceljs.default.Workbook();
  workbook.creator = "Gr\xE1ficaOS";
  const sheet = workbook.addWorksheet("Pontos");
  const headerStyle = {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF6C63FF" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" }
    }
  };
  sheet.columns = [
    { header: "Funcion\xE1rio", key: "nome", width: 25 },
    { header: "Data", key: "data", width: 14 },
    { header: "Entrada", key: "entrada", width: 10 },
    { header: "Almo\xE7o", key: "almoco", width: 10 },
    { header: "Retorno", key: "retorno", width: 10 },
    { header: "Sa\xEDda", key: "saida", width: 10 },
    { header: "Horas", key: "horas", width: 12 },
    { header: "Status", key: "status", width: 12 },
    { header: "Enc. Auto", key: "encAuto", width: 10 }
  ];
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.style = headerStyle;
  });
  headerRow.height = 28;
  for (const row of rows) {
    sheet.addRow(row);
  }
  const resumo = workbook.addWorksheet("Resumo");
  resumo.columns = [
    { header: "Funcion\xE1rio", key: "nome", width: 25 },
    { header: "Total Horas", key: "totalHoras", width: 14 },
    { header: "Dias Trabalhados", key: "diasTrabalhados", width: 18 },
    { header: "Faltas", key: "faltas", width: 10 },
    { header: "Enc. Auto", key: "encAuto", width: 12 }
  ];
  const resumoHeader = resumo.getRow(1);
  resumoHeader.eachCell((cell) => {
    cell.style = headerStyle;
  });
  resumoHeader.height = 28;
  const porUsuario = /* @__PURE__ */ new Map();
  for (const ponto of pontos) {
    const uid = ponto.userId;
    if (!porUsuario.has(uid)) {
      porUsuario.set(uid, { totalMin: 0, dias: 0, faltas: 0, enc: 0 });
    }
    const u = porUsuario.get(uid);
    if (ponto.entrada) {
      u.dias++;
      u.totalMin += calcularMinutos(ponto);
    } else {
      u.faltas++;
    }
    if (ponto.encerramentoAutomatico) u.enc++;
  }
  for (const ponto of pontos) {
    const uid = ponto.userId;
    const u = porUsuario.get(uid);
    if (!u) continue;
    const h = Math.floor(u.totalMin / 60);
    const m = u.totalMin % 60;
    if (resumo.getColumn("nome").values?.includes(ponto.user.name)) continue;
    resumo.addRow({
      nome: ponto.user.name,
      totalHoras: `${h}h${m.toString().padStart(2, "0")}m`,
      diasTrabalhados: u.dias,
      faltas: u.faltas,
      encAuto: u.enc
    });
  }
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
async function exportPDF(params) {
  const pontos = await fetchExportPontos(params);
  const rows = pontosToRows(pontos);
  return new Promise((resolve, reject) => {
    const doc = new import_pdfkit.default({ size: "A4", layout: "landscape", margin: 40 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(18).font("Helvetica-Bold").text("Gr\xE1ficaOS \u2014 Relat\xF3rio de Pontos", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#666666").text(`Per\xEDodo: ${params.startDate} a ${params.endDate} | Gerado em: ${formatarDataHoraBR(/* @__PURE__ */ new Date())}`, { align: "center" });
    doc.moveDown(1);
    const headers = ["Funcion\xE1rio", "Data", "Entrada", "Almo\xE7o", "Retorno", "Sa\xEDda", "Horas", "Status", "Enc.Auto"];
    const colWidths = [130, 70, 60, 60, 60, 60, 70, 65, 55];
    const startX = 40;
    let y = doc.y;
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
    let x = startX;
    for (let i = 0; i < headers.length; i++) {
      doc.rect(x, y, colWidths[i], 20).fill("#6c63ff");
      doc.fillColor("#ffffff").text(headers[i], x + 4, y + 6, { width: colWidths[i] - 8 });
      x += colWidths[i];
    }
    y += 20;
    doc.font("Helvetica").fontSize(7).fillColor("#333333");
    for (const row of rows) {
      if (y > 540) {
        doc.addPage();
        y = 40;
        x = startX;
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
        for (let i = 0; i < headers.length; i++) {
          doc.rect(x, y, colWidths[i], 20).fill("#6c63ff");
          doc.fillColor("#ffffff").text(headers[i], x + 4, y + 6, { width: colWidths[i] - 8 });
          x += colWidths[i];
        }
        y += 20;
        doc.font("Helvetica").fontSize(7).fillColor("#333333");
      }
      const values = [row.nome, row.data, row.entrada, row.almoco, row.retorno, row.saida, row.horas, row.status, row.encAuto];
      x = startX;
      const bgColor = rows.indexOf(row) % 2 === 0 ? "#f8f8f8" : "#ffffff";
      for (let i = 0; i < values.length; i++) {
        doc.rect(x, y, colWidths[i], 18).fill(bgColor);
        doc.fillColor("#333333").text(values[i], x + 4, y + 5, { width: colWidths[i] - 8 });
        x += colWidths[i];
      }
      y += 18;
    }
    const resumoMap = /* @__PURE__ */ new Map();
    for (const p of pontos) {
      const existing = resumoMap.get(p.user.name);
      let mins = 0;
      let worked = 0;
      if (p.entrada && p.saida) {
        let ms = p.saida.getTime() - p.entrada.getTime();
        if (p.almoco && p.retorno) ms -= p.retorno.getTime() - p.almoco.getTime();
        mins = Math.max(0, Math.floor(ms / 6e4));
        worked = 1;
      } else if (p.entrada) {
        worked = 1;
      }
      if (existing) {
        existing.minutos += mins;
        existing.dias += worked;
      } else {
        resumoMap.set(p.user.name, { nome: p.user.name, minutos: mins, dias: worked });
      }
    }
    const resumo = Array.from(resumoMap.values()).sort((a, b) => b.minutos - a.minutos);
    if (resumo.length > 0) {
      const resumoHeight = 30 + resumo.length * 18 + (resumo.length > 1 ? 20 : 0) + 20;
      if (y + resumoHeight > 540) {
        doc.addPage();
        y = 40;
      } else {
        y += 20;
      }
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#333333").text("Resumo do Per\xEDodo", startX, y);
      y += 20;
      const rHeaders = ["Funcion\xE1rio", "Dias Trabalhados", "Total de Horas", "M\xE9dia Di\xE1ria"];
      const rColWidths = [200, 120, 140, 140];
      let rx = startX;
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
      for (let i = 0; i < rHeaders.length; i++) {
        doc.rect(rx, y, rColWidths[i], 20).fill("#6c63ff");
        doc.fillColor("#ffffff").text(rHeaders[i], rx + 4, y + 6, { width: rColWidths[i] - 8 });
        rx += rColWidths[i];
      }
      y += 20;
      doc.font("Helvetica").fontSize(8).fillColor("#333333");
      for (let idx = 0; idx < resumo.length; idx++) {
        const r = resumo[idx];
        const h = Math.floor(r.minutos / 60);
        const m = r.minutos % 60;
        const totalStr = `${h}h${m.toString().padStart(2, "0")}m`;
        const avgMin = r.dias > 0 ? Math.round(r.minutos / r.dias) : 0;
        const avgH = Math.floor(avgMin / 60);
        const avgM = avgMin % 60;
        const avgStr = `${avgH}h${avgM.toString().padStart(2, "0")}m / dia`;
        const rValues = [r.nome, `${r.dias} ${r.dias === 1 ? "dia" : "dias"}`, totalStr, avgStr];
        rx = startX;
        const bgColor = idx % 2 === 0 ? "#f0f0ff" : "#ffffff";
        for (let i = 0; i < rValues.length; i++) {
          doc.rect(rx, y, rColWidths[i], 18).fill(bgColor);
          doc.fillColor("#333333").text(rValues[i], rx + 4, y + 5, { width: rColWidths[i] - 8 });
          rx += rColWidths[i];
        }
        y += 18;
      }
      if (resumo.length > 1) {
        const totalDias = resumo.reduce((s, r) => s + r.dias, 0);
        const totalMin = resumo.reduce((s, r) => s + r.minutos, 0);
        const totalH = Math.floor(totalMin / 60);
        const totalM = totalMin % 60;
        const avgGeral = totalDias > 0 ? Math.round(totalMin / totalDias) : 0;
        const avgGeralH = Math.floor(avgGeral / 60);
        const avgGeralM = avgGeral % 60;
        rx = startX;
        const tValues = [
          "TOTAL GERAL",
          `${totalDias} dias`,
          `${totalH}h${totalM.toString().padStart(2, "0")}m`,
          `${avgGeralH}h${avgGeralM.toString().padStart(2, "0")}m / dia`
        ];
        for (let i = 0; i < tValues.length; i++) {
          doc.rect(rx, y, rColWidths[i], 20).fill("#e8e6ff");
          doc.font("Helvetica-Bold").fontSize(8).fillColor("#333333").text(tValues[i], rx + 4, y + 6, { width: rColWidths[i] - 8 });
          rx += rColWidths[i];
        }
        y += 20;
      }
    }
    doc.moveDown(2);
    doc.fontSize(7).fillColor("#999999").text(`Total de registros: ${rows.length}`, startX);
    doc.end();
  });
}
async function enviarRelatorioPorEmail(params) {
  const hasResend = !!env.RESEND_API_KEY;
  const hasSMTP = !!env.SMTP_HOST && !!env.SMTP_USER;
  if (!hasResend && !hasSMTP) {
    throw Object.assign(
      new Error(
        "Email n\xE3o configurado. Configure RESEND_API_KEY (recomendado) ou SMTP_HOST + SMTP_USER + SMTP_PASS no servidor."
      ),
      { statusCode: 400 }
    );
  }
  const pdfBuffer = await exportPDF(params);
  const filename = `relatorio-pontos-${params.startDate}-a-${params.endDate}.pdf`;
  const subject = `Gr\xE1ficaOS \u2014 Relat\xF3rio de Pontos (${params.startDate} a ${params.endDate})`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6c63ff;">Gr\xE1ficaOS</h2>
      <p>Segue em anexo o relat\xF3rio de pontos do per\xEDodo <strong>${params.startDate}</strong> a <strong>${params.endDate}</strong>.</p>
      <hr style="border: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">Este email foi gerado automaticamente pelo sistema Gr\xE1ficaOS.</p>
    </div>
  `;
  try {
    if (hasResend) {
      const resend = new import_resend.Resend(env.RESEND_API_KEY);
      await resend.emails.send({
        from: env.EMAIL_FROM || "Gr\xE1ficaOS <onboarding@resend.dev>",
        to: [params.destinatario],
        subject,
        html,
        attachments: [
          {
            filename,
            content: pdfBuffer.toString("base64")
          }
        ]
      });
    } else {
      const isGmail = env.SMTP_HOST.includes("gmail");
      const transporter = import_nodemailer.default.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS
        },
        ...isGmail ? { tls: { rejectUnauthorized: false } } : {}
      });
      await transporter.sendMail({
        from: env.SMTP_FROM || `Gr\xE1ficaOS <${env.SMTP_USER}>`,
        to: params.destinatario,
        subject,
        html,
        attachments: [
          {
            filename,
            content: pdfBuffer,
            contentType: "application/pdf"
          }
        ]
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("\u274C Erro ao enviar email:", msg);
    throw Object.assign(
      new Error(`Falha ao enviar email: ${msg}`),
      { statusCode: 500 }
    );
  }
  return { sent: true, message: `Relat\xF3rio enviado para ${params.destinatario}` };
}
async function getAnomalias(params) {
  const usuariosEscopo = await carregarUsuariosEscopo(params.userId, params.loja);
  const userIds = usuariosEscopo.map((user) => user.id);
  const pontos = await prisma.ponto.findMany({
    where: {
      ...userIds.length > 0 ? { userId: { in: userIds } } : { userId: "__no-user__" },
      date: { gte: new Date(params.startDate), lte: new Date(params.endDate) }
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { date: "asc" }
  });
  const anomalias2 = [];
  for (const ponto of pontos) {
    const dataStr = formatarDateOnlyBR(new Date(ponto.date));
    const base = { pontoId: ponto.id, userId: ponto.userId, userName: ponto.user.name, data: dataStr };
    if (ponto.entrada && ponto.saida) {
      const totalMs = new Date(ponto.saida).getTime() - new Date(ponto.entrada).getTime();
      let jornMs = totalMs;
      if (ponto.almoco && ponto.retorno) {
        jornMs -= new Date(ponto.retorno).getTime() - new Date(ponto.almoco).getTime();
      }
      const jornadaH = jornMs / 36e5;
      if (jornadaH > 12) {
        anomalias2.push({
          ...base,
          tipo: "JORNADA_EXCESSIVA",
          severidade: "ALTA",
          descricao: `Jornada de ${Math.round(jornadaH * 10) / 10}h detectada (limite: 12h)`,
          sugestao: "Verificar se houve erro na batida de ponto"
        });
      }
    }
    if (ponto.almoco && ponto.retorno) {
      const intervaloMs = new Date(ponto.retorno).getTime() - new Date(ponto.almoco).getTime();
      const intervaloMin = intervaloMs / 6e4;
      if (intervaloMin < 30) {
        anomalias2.push({
          ...base,
          tipo: "INTERVALO_CURTO",
          severidade: "MEDIA",
          descricao: `Intervalo de almo\xE7o de ${Math.round(intervaloMin)}min (m\xEDnimo legal: 30min)`,
          sugestao: "Verificar se o funcion\xE1rio est\xE1 fazendo intervalo adequado"
        });
      }
    }
    if (ponto.entrada) {
      const { hora } = getHoraMinutoSP(new Date(ponto.entrada));
      if (hora < 5) {
        anomalias2.push({
          ...base,
          tipo: "ENTRADA_MUITO_CEDO",
          severidade: "BAIXA",
          descricao: `Entrada \xE0s ${formatarHoraBR(new Date(ponto.entrada))} (antes das 05h)`,
          sugestao: "Hor\xE1rio incomum \u2014 pode ser erro de batida"
        });
      }
    }
    if (ponto.saida && !ponto.encerramentoAutomatico) {
      const { hora } = getHoraMinutoSP(new Date(ponto.saida));
      if (hora >= 23) {
        anomalias2.push({
          ...base,
          tipo: "SAIDA_MUITO_TARDE",
          severidade: "MEDIA",
          descricao: `Sa\xEDda \xE0s ${formatarHoraBR(new Date(ponto.saida))} (ap\xF3s 23h)`,
          sugestao: "Verificar se h\xE1 hora extra n\xE3o autorizada"
        });
      }
    }
    if (ponto.entrada && ponto.almoco) {
      const diffMs = new Date(ponto.almoco).getTime() - new Date(ponto.entrada).getTime();
      if (diffMs < 3e5 && diffMs >= 0) {
        anomalias2.push({
          ...base,
          tipo: "MULTIPLAS_BATIDAS_RAPIDAS",
          severidade: "ALTA",
          descricao: `Entrada e almo\xE7o registrados com menos de 5min de diferen\xE7a`,
          sugestao: "Poss\xEDvel duplica\xE7\xE3o de batida \u2014 verificar com o funcion\xE1rio"
        });
      }
    }
  }
  return anomalias2;
}
async function getInsights(params) {
  const { startDate, endDate, loja } = params;
  const endDateLimitado = limitarDataFinalAoHoje(endDate);
  const users = await prisma.user.findMany({ where: { active: true, role: "EMPLOYEE", ...loja ? { loja } : {} }, select: { id: true, name: true, jornadaEntrada: true } });
  const userIds = users.map((user) => user.id);
  const folgaMap = await carregarFolgasPorUsuario(userIds);
  const datasPeriodo = startDate <= endDateLimitado ? listarDatasPeriodo(startDate, endDateLimitado) : [];
  const pontos = await prisma.ponto.findMany({
    where: {
      ...userIds.length > 0 ? { userId: { in: userIds } } : { userId: "__no-user__" },
      date: { gte: new Date(startDate), lte: new Date(endDateLimitado) }
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { date: "asc" }
  });
  const pontoMap = buildPontoMap(pontos);
  const porFunc = /* @__PURE__ */ new Map();
  for (const user of users) {
    porFunc.set(user.id, {
      nome: user.name,
      diasEsperados: 0,
      diasPresente: 0,
      diasPontual: 0,
      totalMinutos: 0,
      encAuto: 0
    });
  }
  for (const user of users) {
    const folgaDiasSemana = folgaMap.get(user.id) ?? /* @__PURE__ */ new Set();
    const f = porFunc.get(user.id);
    for (const dateKey of datasPeriodo) {
      const ponto = pontoMap.get(`${user.id}:${dateKey}`);
      if (!isDiaEsperadoParaTrabalho({ dateKey, folgaDiasSemana, ponto })) {
        continue;
      }
      f.diasEsperados++;
      if (ponto?.entrada) {
        f.diasPresente++;
      }
    }
  }
  for (const ponto of pontos) {
    const f = porFunc.get(ponto.userId);
    if (!f) continue;
    if (ponto.entrada) {
      f.totalMinutos += calcularMinutos(ponto);
      const jornadaEntrada = users.find((user) => user.id === ponto.userId)?.jornadaEntrada ?? env.HORARIO_ENTRADA_PONTUAL;
      if (isEntradaPontualPorJornada({ entrada: new Date(ponto.entrada), jornadaEntrada, dateKey: getDateOnlyKey(new Date(ponto.date)) })) {
        f.diasPontual++;
      }
    }
    if (ponto.encerramentoAutomatico) f.encAuto++;
  }
  const destaques = [];
  const recomendacoes = [];
  const totalPresencas = Array.from(porFunc.values()).reduce((sum, f) => sum + f.diasPresente, 0);
  const esperadoTotal = Array.from(porFunc.values()).reduce((sum, f) => sum + f.diasEsperados, 0);
  const presencaGeral = esperadoTotal > 0 ? Math.round(totalPresencas / esperadoTotal * 100) : 0;
  if (presencaGeral >= 90) {
    destaques.push({
      tipo: "POSITIVO",
      titulo: "Presen\xE7a excelente",
      descricao: `A equipe manteve ${presencaGeral}% de presen\xE7a no per\xEDodo`,
      metrica: `${presencaGeral}%`
    });
  } else if (presencaGeral < 70) {
    destaques.push({
      tipo: "ATENCAO",
      titulo: "Presen\xE7a abaixo do ideal",
      descricao: `Apenas ${presencaGeral}% de presen\xE7a no per\xEDodo`,
      metrica: `${presencaGeral}%`
    });
  }
  const totalEncAuto = pontos.filter((p) => p.encerramentoAutomatico).length;
  if (totalEncAuto > 0) {
    const usersComEncAuto = new Set(pontos.filter((p) => p.encerramentoAutomatico).map((p) => p.user.name));
    destaques.push({
      tipo: "ATENCAO",
      titulo: `${totalEncAuto} encerramento(s) autom\xE1tico(s)`,
      descricao: `${usersComEncAuto.size} funcion\xE1rio(s) tiveram pontos encerrados automaticamente`,
      metrica: `${totalEncAuto}`
    });
    for (const [, f] of porFunc) {
      if (f.encAuto >= 3) {
        recomendacoes.push(`Considere conversar com ${f.nome} sobre os ${f.encAuto} encerramentos autom\xE1ticos`);
      }
    }
  }
  let melhorPresenca = null;
  let melhorPontualidade = null;
  let maisHoras = null;
  let maisHorasMin = 0;
  for (const [, f] of porFunc) {
    const pctPresenca = f.diasEsperados > 0 ? Math.round(f.diasPresente / f.diasEsperados * 100) : 0;
    const pctPontual = f.diasPresente > 0 ? Math.round(f.diasPontual / f.diasPresente * 100) : 0;
    if (!melhorPresenca || pctPresenca > melhorPresenca.percentual) {
      melhorPresenca = { nome: f.nome, percentual: pctPresenca };
    }
    if (!melhorPontualidade || pctPontual > melhorPontualidade.percentual) {
      melhorPontualidade = { nome: f.nome, percentual: pctPontual };
    }
    const h = Math.floor(f.totalMinutos / 60);
    const m = f.totalMinutos % 60;
    const horasStr = `${h}h${m.toString().padStart(2, "0")}m`;
    if (f.totalMinutos > maisHorasMin) {
      maisHoras = { nome: f.nome, horas: horasStr };
      maisHorasMin = f.totalMinutos;
    }
  }
  if (melhorPresenca && melhorPresenca.percentual >= 100) {
    destaques.push({
      tipo: "POSITIVO",
      titulo: `${melhorPresenca.nome} com 100% de presen\xE7a`,
      descricao: "Considere reconhecimento formal"
    });
    recomendacoes.push(`${melhorPresenca.nome} teve 100% de presen\xE7a. Considere reconhecimento formal.`);
  }
  let totalPontuais = 0;
  let totalDiasPresentes = 0;
  for (const [, f] of porFunc) {
    totalPontuais += f.diasPontual;
    totalDiasPresentes += f.diasPresente;
  }
  const pontualidadeGeral = totalDiasPresentes > 0 ? Math.round(totalPontuais / totalDiasPresentes * 100) : 0;
  if (pontualidadeGeral >= 90) {
    destaques.push({
      tipo: "POSITIVO",
      titulo: "Pontualidade exemplar",
      descricao: `${pontualidadeGeral}% dos registros dentro do hor\xE1rio`,
      metrica: `${pontualidadeGeral}%`
    });
  } else if (pontualidadeGeral < 60) {
    destaques.push({
      tipo: "ATENCAO",
      titulo: "Pontualidade precisa de aten\xE7\xE3o",
      descricao: `Apenas ${pontualidadeGeral}% dos registros no hor\xE1rio`,
      metrica: `${pontualidadeGeral}%`
    });
    recomendacoes.push("Considere uma conversa em equipe sobre hor\xE1rios de entrada");
  }
  return {
    periodo: { inicio: startDate, fim: endDateLimitado },
    destaques,
    funcionarioDestaque: { melhorPresenca, melhorPontualidade, maisHoras },
    recomendacoes
  };
}
async function editarPonto(input) {
  const ponto = await prisma.ponto.findUnique({
    where: { id: input.pontoId }
  });
  if (!ponto) {
    throw Object.assign(new Error("Ponto n\xE3o encontrado"), { statusCode: 404 });
  }
  function parseTimeField(value, pontoDate) {
    if (value === void 0) return void 0;
    if (value === null || value === "") return null;
    const hhmmMatch = value.match(/^(\d{2}):(\d{2})$/);
    if (hhmmMatch) {
      const [, hh, mm] = hhmmMatch;
      const pontoSP = import_luxon2.DateTime.fromJSDate(pontoDate, { zone: "America/Sao_Paulo" });
      const target = pontoSP.set({ hour: parseInt(hh), minute: parseInt(mm), second: 0, millisecond: 0 });
      return target.toJSDate();
    }
    return new Date(value);
  }
  const data = {};
  const entradaParsed = parseTimeField(input.entrada, ponto.date);
  if (entradaParsed !== void 0) data.entrada = entradaParsed;
  const almocoParsed = parseTimeField(input.almoco, ponto.date);
  if (almocoParsed !== void 0) data.almoco = almocoParsed;
  const retornoParsed = parseTimeField(input.retorno, ponto.date);
  if (retornoParsed !== void 0) data.retorno = retornoParsed;
  const saidaParsed = parseTimeField(input.saida, ponto.date);
  if (saidaParsed !== void 0) data.saida = saidaParsed;
  if (input.status) {
    data.status = input.status;
    if (input.status === "FOLGA" || input.status === "FALTA") {
      data.entrada = null;
      data.almoco = null;
      data.retorno = null;
      data.saida = null;
    }
  }
  if (input.date) {
    const newDate = import_luxon2.DateTime.fromISO(input.date, { zone: "America/Sao_Paulo" }).startOf("day").toJSDate();
    data.date = newDate;
  }
  const updated = await prisma.ponto.update({
    where: { id: input.pontoId },
    data,
    include: {
      user: {
        select: { id: true, name: true, initials: true, avatarColor: true }
      }
    }
  });
  return updated;
}
async function criarPontoManual(input) {
  const dateObj = import_luxon2.DateTime.fromISO(input.date, { zone: "America/Sao_Paulo" }).startOf("day").toJSDate();
  const existing = await prisma.ponto.findUnique({
    where: { userId_date: { userId: input.userId, date: dateObj } }
  });
  if (existing) {
    throw Object.assign(new Error("J\xE1 existe um registro de ponto para este funcion\xE1rio nesta data."), { statusCode: 409 });
  }
  function toDate(hhmm) {
    if (!hhmm) return null;
    const match = hhmm.match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, hh, mm] = match;
    const dt = import_luxon2.DateTime.fromJSDate(dateObj, { zone: "America/Sao_Paulo" }).set({ hour: parseInt(hh), minute: parseInt(mm), second: 0, millisecond: 0 });
    return dt.toJSDate();
  }
  const status = input.status ?? "NORMAL";
  const isFolgaFalta = status === "FOLGA" || status === "FALTA";
  const ponto = await prisma.ponto.create({
    data: {
      userId: input.userId,
      date: dateObj,
      entrada: isFolgaFalta ? null : toDate(input.entrada),
      almoco: isFolgaFalta ? null : toDate(input.almoco),
      retorno: isFolgaFalta ? null : toDate(input.retorno),
      saida: isFolgaFalta ? null : toDate(input.saida),
      status
    },
    include: {
      user: { select: { id: true, name: true, initials: true, avatarColor: true } }
    }
  });
  return ponto;
}
async function listarFolgas(userId) {
  const where = userId ? { userId } : {};
  return prisma.folgaConfig.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, initials: true, avatarColor: true } }
    },
    orderBy: [{ userId: "asc" }, { diaSemana: "asc" }]
  });
}
async function configurarFolgas(userId, diasSemana) {
  await prisma.folgaConfig.deleteMany({ where: { userId } });
  if (diasSemana.length > 0) {
    await prisma.folgaConfig.createMany({
      data: diasSemana.map((dia) => ({ userId, diaSemana: dia }))
    });
  }
  return prisma.folgaConfig.findMany({
    where: { userId },
    include: {
      user: { select: { id: true, name: true, initials: true, avatarColor: true } }
    },
    orderBy: { diaSemana: "asc" }
  });
}

// src/controllers/ponto.controller.ts
var relatorioSchema = import_zod4.z.object({
  userId: import_zod4.z.string().optional(),
  loja: import_zod4.z.enum(["PAPER_OFFICE_I", "PAPER_OFFICE_II"]).optional(),
  startDate: import_zod4.z.string().min(1, "Data inicial \xE9 obrigat\xF3ria"),
  endDate: import_zod4.z.string().min(1, "Data final \xE9 obrigat\xF3ria")
});
var emailSchema = import_zod4.z.object({
  userId: import_zod4.z.string().optional(),
  loja: import_zod4.z.enum(["PAPER_OFFICE_I", "PAPER_OFFICE_II"]).optional(),
  startDate: import_zod4.z.string().min(1),
  endDate: import_zod4.z.string().min(1),
  destinatario: import_zod4.z.string().email("Email inv\xE1lido")
});
var editarPontoSchema = import_zod4.z.object({
  entrada: import_zod4.z.string().nullable().optional(),
  almoco: import_zod4.z.string().nullable().optional(),
  retorno: import_zod4.z.string().nullable().optional(),
  saida: import_zod4.z.string().nullable().optional(),
  status: import_zod4.z.enum(["NORMAL", "FOLGA", "FALTA"]).optional(),
  date: import_zod4.z.string().optional()
});
var pontoManualSchema = import_zod4.z.object({
  userId: import_zod4.z.string().min(1, "Funcion\xE1rio \xE9 obrigat\xF3rio"),
  date: import_zod4.z.string().min(1, "Data \xE9 obrigat\xF3ria"),
  entrada: import_zod4.z.string().nullable().optional(),
  almoco: import_zod4.z.string().nullable().optional(),
  retorno: import_zod4.z.string().nullable().optional(),
  saida: import_zod4.z.string().nullable().optional(),
  status: import_zod4.z.enum(["NORMAL", "FOLGA", "FALTA"]).optional()
});
var configurarFolgasSchema = import_zod4.z.object({
  userId: import_zod4.z.string().min(1),
  diasSemana: import_zod4.z.array(import_zod4.z.number().min(0).max(6))
});
var comprovanteTokenParamsSchema = import_zod4.z.object({
  id: import_zod4.z.string().min(1, "Ponto \xE9 obrigat\xF3rio")
});
var comprovanteValidacaoParamsSchema = import_zod4.z.object({
  token: import_zod4.z.string().min(1, "Token \xE9 obrigat\xF3rio")
});
async function list2(req, res, next) {
  try {
    const pontos = await listPontos(req.userId, req.userRole);
    res.json(pontos);
  } catch (error) {
    next(error);
  }
}
async function hoje(req, res, next) {
  try {
    const ponto = await getPontoHoje(req.userId);
    res.json(ponto);
  } catch (error) {
    next(error);
  }
}
async function bater(req, res, next) {
  try {
    const ponto = await baterPonto(req.userId);
    res.json(ponto);
  } catch (error) {
    next(error);
  }
}
async function relatorio(req, res, next) {
  try {
    const query = relatorioSchema.parse(req.query);
    const pontos = await getRelatorio({
      userId: query.userId,
      loja: query.loja,
      startDate: query.startDate,
      endDate: query.endDate,
      requestUserId: req.userId,
      requestUserRole: req.userRole
    });
    res.json(pontos);
  } catch (error) {
    next(error);
  }
}
async function metricas(req, res, next) {
  try {
    const query = relatorioSchema.parse(req.query);
    const result = await getMetricas({
      userId: query.userId,
      loja: query.loja,
      startDate: query.startDate,
      endDate: query.endDate,
      requestUserId: req.userId,
      requestUserRole: req.userRole
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}
async function exportCSV2(req, res, next) {
  try {
    const query = relatorioSchema.parse(req.query);
    const csv = await exportCSV({
      userId: query.userId,
      loja: query.loja,
      startDate: query.startDate,
      endDate: query.endDate
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="pontos-${query.startDate}-${query.endDate}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
}
async function exportXLSX2(req, res, next) {
  try {
    const query = relatorioSchema.parse(req.query);
    const buffer = await exportXLSX({
      userId: query.userId,
      loja: query.loja,
      startDate: query.startDate,
      endDate: query.endDate
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="pontos-${query.startDate}-${query.endDate}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}
async function exportPDF2(req, res, next) {
  try {
    const query = relatorioSchema.parse(req.query);
    const buffer = await exportPDF({
      userId: query.userId,
      loja: query.loja,
      startDate: query.startDate,
      endDate: query.endDate
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="pontos-${query.startDate}-${query.endDate}.pdf"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}
async function enviarEmail(req, res, next) {
  try {
    const body = emailSchema.parse(req.body);
    const result = await enviarRelatorioPorEmail(body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
async function anomalias(req, res, next) {
  try {
    const query = relatorioSchema.parse(req.query);
    const result = await getAnomalias({
      userId: query.userId,
      loja: query.loja,
      startDate: query.startDate,
      endDate: query.endDate
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}
async function insights(req, res, next) {
  try {
    const query = relatorioSchema.parse(req.query);
    const result = await getInsights({
      loja: query.loja,
      startDate: query.startDate,
      endDate: query.endDate
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}
async function gerarTokenComprovante2(req, res, next) {
  try {
    const params = comprovanteTokenParamsSchema.parse(req.params);
    const result = await gerarTokenComprovante({
      pontoId: params.id,
      requestUserId: req.userId,
      requestUserRole: req.userRole
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}
async function validarComprovantePublico(req, res, next) {
  try {
    const params = comprovanteValidacaoParamsSchema.parse(req.params);
    const result = await validarComprovanteToken(params.token);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
async function editar(req, res, next) {
  try {
    const id = req.params.id;
    const body = editarPontoSchema.parse(req.body);
    const ponto = await editarPonto({
      pontoId: id,
      entrada: body.entrada,
      almoco: body.almoco,
      retorno: body.retorno,
      saida: body.saida,
      status: body.status,
      date: body.date
    });
    res.json(ponto);
  } catch (error) {
    next(error);
  }
}
async function criarManual(req, res, next) {
  try {
    const body = pontoManualSchema.parse(req.body);
    const ponto = await criarPontoManual({
      userId: body.userId,
      date: body.date,
      entrada: body.entrada,
      almoco: body.almoco,
      retorno: body.retorno,
      saida: body.saida,
      status: body.status
    });
    res.status(201).json(ponto);
  } catch (error) {
    next(error);
  }
}
async function listarFolgas2(req, res, next) {
  try {
    const userId = req.query.userId;
    const folgas = await listarFolgas(userId);
    res.json(folgas);
  } catch (error) {
    next(error);
  }
}
async function configurarFolgas2(req, res, next) {
  try {
    const body = configurarFolgasSchema.parse(req.body);
    const folgas = await configurarFolgas(body.userId, body.diasSemana);
    res.json(folgas);
  } catch (error) {
    next(error);
  }
}

// src/routes/ponto.routes.ts
var router3 = (0, import_express3.Router)();
router3.get("/comprovante/:token", validarComprovantePublico);
router3.use(authMiddleware);
router3.get("/", list2);
router3.get("/hoje", hoje);
router3.post("/bater", bater);
router3.get("/relatorio", relatorio);
router3.get("/metricas", metricas);
router3.get("/anomalias", anomalias);
router3.get("/insights", insights);
router3.get("/:id/comprovante-token", gerarTokenComprovante2);
router3.post("/manual", adminOnly, criarManual);
router3.get("/folgas", adminOnly, listarFolgas2);
router3.post("/folgas", adminOnly, configurarFolgas2);
router3.put("/:id", adminOnly, editar);
router3.get("/export/csv", adminOnly, exportCSV2);
router3.get("/export/xlsx", adminOnly, exportXLSX2);
router3.get("/export/pdf", adminOnly, exportPDF2);
router3.post("/export/email", adminOnly, enviarEmail);

// src/routes/arte.routes.ts
var import_express4 = require("express");

// src/controllers/arte.controller.ts
var import_zod5 = require("zod");

// src/services/arte.service.ts
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_luxon3 = require("luxon");
var responsavelSelect = {
  id: true,
  name: true,
  initials: true,
  avatarColor: true,
  loja: true
};
async function gerarCodigoArte() {
  const ultimaArte = await prisma.arte.findFirst({
    orderBy: { codigo: "desc" },
    select: { codigo: true }
  });
  if (!ultimaArte) return "ART-001";
  const ultimoNumero = parseInt(ultimaArte.codigo.replace("ART-", ""), 10);
  const novoNumero = (isNaN(ultimoNumero) ? 0 : ultimoNumero) + 1;
  return `ART-${novoNumero.toString().padStart(3, "0")}`;
}
async function gerarNumeroOrcamento() {
  const anoAtual = import_luxon3.DateTime.now().setZone("America/Sao_Paulo").year;
  const prefixo = `ORC-${anoAtual}-`;
  const orcamentos = await prisma.arte.findMany({
    where: {
      orcamentoNum: {
        startsWith: prefixo
      }
    },
    select: { orcamentoNum: true }
  });
  const maiorNumero = orcamentos.reduce((maior, arte) => {
    const match = arte.orcamentoNum.match(new RegExp(`^${prefixo}(\\d+)$`));
    const numero = match?.[1] ? parseInt(match[1], 10) : 0;
    return Number.isNaN(numero) ? maior : Math.max(maior, numero);
  }, 0);
  return `${prefixo}${String(maiorNumero + 1).padStart(3, "0")}`;
}
async function listArtes(userId, role) {
  const where = role === "ADMIN" ? {} : { responsavelId: userId };
  return prisma.arte.findMany({
    where,
    include: {
      responsavel: {
        select: responsavelSelect
      },
      arquivos: true
    },
    orderBy: { createdAt: "desc" }
  });
}
async function createArte(data) {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const codigo = await gerarCodigoArte();
    const orcamentoNum = data.orcamentoNum?.trim() || await gerarNumeroOrcamento();
    try {
      return await prisma.arte.create({
        data: {
          codigo,
          clienteNome: data.clienteNome,
          clienteNumero: data.clienteNumero,
          orcamentoNum,
          produto: data.produto,
          quantidade: data.quantidade ?? 1,
          larguraCm: data.larguraCm,
          alturaCm: data.alturaCm,
          responsavelId: data.responsavelId,
          urgencia: data.urgencia ?? "NORMAL",
          prazo: data.prazo ? new Date(data.prazo) : null,
          observacoes: data.observacoes ?? null
        },
        include: {
          responsavel: {
            select: responsavelSelect
          },
          arquivos: true
        }
      });
    } catch (err) {
      const isUniqueViolation = err instanceof Error && err.message.includes("Unique constraint failed on the fields: (`codigo`)");
      if (!isUniqueViolation || attempt === MAX_RETRIES - 1) {
        throw err;
      }
    }
  }
  throw new Error("Falha ao gerar c\xF3digo \xFAnico para a arte ap\xF3s m\xFAltiplas tentativas");
}
async function updateArte(id, data) {
  const updateData = {};
  if (data.clienteNome !== void 0) updateData.clienteNome = data.clienteNome;
  if (data.clienteNumero !== void 0) updateData.clienteNumero = data.clienteNumero;
  if (data.orcamentoNum !== void 0) updateData.orcamentoNum = data.orcamentoNum;
  if (data.produto !== void 0) updateData.produto = data.produto;
  if (data.quantidade !== void 0) updateData.quantidade = data.quantidade;
  if (data.larguraCm !== void 0) updateData.larguraCm = data.larguraCm;
  if (data.alturaCm !== void 0) updateData.alturaCm = data.alturaCm;
  if (data.responsavelId !== void 0) updateData.responsavelId = data.responsavelId;
  if (data.urgencia !== void 0) updateData.urgencia = data.urgencia;
  if (data.prazo !== void 0) updateData.prazo = data.prazo ? new Date(data.prazo) : null;
  if (data.observacoes !== void 0) updateData.observacoes = data.observacoes;
  return prisma.arte.update({
    where: { id },
    data: updateData,
    include: {
      responsavel: {
        select: responsavelSelect
      },
      arquivos: true
    }
  });
}
async function updateArteStatus(id, status) {
  return prisma.arte.update({
    where: { id },
    data: { status },
    include: {
      responsavel: {
        select: responsavelSelect
      },
      arquivos: true
    }
  });
}
async function deleteArte(id) {
  const arte = await prisma.arte.findUnique({
    where: { id },
    include: { arquivos: true }
  });
  if (!arte) {
    throw Object.assign(new Error("Arte n\xE3o encontrada"), { statusCode: 404 });
  }
  for (const arquivo of arte.arquivos) {
    const filePath = import_path.default.resolve(arquivo.nomeStorage);
    if (import_fs.default.existsSync(filePath)) {
      import_fs.default.unlinkSync(filePath);
    }
  }
  return prisma.arte.delete({ where: { id } });
}
async function addArquivos(arteId, files) {
  const arquivos = files.map((file) => ({
    arteId,
    nomeOriginal: file.originalname,
    nomeStorage: file.path,
    tipo: file.mimetype,
    tamanho: file.size,
    url: `/uploads/${file.filename}`
  }));
  await prisma.arquivo.createMany({ data: arquivos });
  return prisma.arte.findUnique({
    where: { id: arteId },
    include: {
      responsavel: {
        select: responsavelSelect
      },
      arquivos: true
    }
  });
}
async function deleteArquivo(arteId, arquivoId) {
  const arquivo = await prisma.arquivo.findFirst({
    where: { id: arquivoId, arteId }
  });
  if (!arquivo) {
    throw Object.assign(new Error("Arquivo n\xE3o encontrado"), { statusCode: 404 });
  }
  const filePath = import_path.default.resolve(arquivo.nomeStorage);
  if (import_fs.default.existsSync(filePath)) {
    import_fs.default.unlinkSync(filePath);
  }
  return prisma.arquivo.delete({ where: { id: arquivoId } });
}

// src/controllers/arte.controller.ts
var produtoTipoSchema = import_zod5.z.enum(["AZULEJO", "BANNER", "ADESIVO", "ADESIVO_RECORTE", "LONA", "PLACA", "FAIXA", "CARTAO_VISITA", "PANFLETO", "FOLDER", "PERFURADO", "ENVELOPAMENTO", "BACKLIGHT", "OUTRO"]);
var createArteSchema = import_zod5.z.object({
  clienteNome: import_zod5.z.string().min(1, "Nome do cliente \xE9 obrigat\xF3rio"),
  clienteNumero: import_zod5.z.string().min(1, "N\xFAmero do cliente \xE9 obrigat\xF3rio"),
  orcamentoNum: import_zod5.z.string().min(1).optional(),
  produto: produtoTipoSchema,
  quantidade: import_zod5.z.number().int().min(1).optional(),
  larguraCm: import_zod5.z.number().int().positive("Largura deve ser positiva"),
  alturaCm: import_zod5.z.number().int().positive("Altura deve ser positiva"),
  responsavelId: import_zod5.z.string().min(1, "Respons\xE1vel \xE9 obrigat\xF3rio"),
  urgencia: import_zod5.z.enum(["LOW", "NORMAL", "HIGH"]).optional(),
  prazo: import_zod5.z.string().optional(),
  observacoes: import_zod5.z.string().optional()
});
var updateArteSchema = import_zod5.z.object({
  clienteNome: import_zod5.z.string().min(1).optional(),
  clienteNumero: import_zod5.z.string().min(1).optional(),
  orcamentoNum: import_zod5.z.string().min(1).optional(),
  produto: produtoTipoSchema.optional(),
  quantidade: import_zod5.z.number().int().min(1).optional(),
  larguraCm: import_zod5.z.number().int().positive().optional(),
  alturaCm: import_zod5.z.number().int().positive().optional(),
  responsavelId: import_zod5.z.string().min(1).optional(),
  urgencia: import_zod5.z.enum(["LOW", "NORMAL", "HIGH"]).optional(),
  prazo: import_zod5.z.string().nullable().optional(),
  observacoes: import_zod5.z.string().nullable().optional()
});
var statusSchema = import_zod5.z.object({
  status: import_zod5.z.enum(["TODO", "DOING", "REVIEW", "DONE"])
});
async function list3(req, res, next) {
  try {
    const artes = await listArtes(req.userId, req.userRole);
    res.json(artes);
  } catch (error) {
    next(error);
  }
}
async function create2(req, res, next) {
  try {
    const body = createArteSchema.parse(req.body);
    const arte = await createArte(body);
    res.status(201).json(arte);
  } catch (error) {
    next(error);
  }
}
async function update2(req, res, next) {
  try {
    const body = updateArteSchema.parse(req.body);
    const arte = await updateArte(req.params.id, body);
    res.json(arte);
  } catch (error) {
    next(error);
  }
}
async function updateStatus(req, res, next) {
  try {
    const body = statusSchema.parse(req.body);
    const arte = await updateArteStatus(req.params.id, body.status);
    res.json(arte);
  } catch (error) {
    next(error);
  }
}
async function remove2(req, res, next) {
  try {
    await deleteArte(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
async function uploadArquivos(req, res, next) {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      res.status(400).json({ message: "Nenhum arquivo enviado" });
      return;
    }
    const arte = await addArquivos(req.params.id, files);
    res.json(arte);
  } catch (error) {
    next(error);
  }
}
async function deleteArquivo2(req, res, next) {
  try {
    await deleteArquivo(req.params.id, req.params.arquivoId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// src/middlewares/upload.ts
var import_multer = __toESM(require("multer"));
var import_path2 = __toESM(require("path"));
var import_crypto = __toESM(require("crypto"));
var import_fs2 = __toESM(require("fs"));
if (!import_fs2.default.existsSync(env.UPLOAD_DIR)) {
  import_fs2.default.mkdirSync(env.UPLOAD_DIR, { recursive: true });
}
var storage = import_multer.default.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, env.UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const hash = import_crypto.default.randomBytes(16).toString("hex");
    const ext = import_path2.default.extname(file.originalname);
    cb(null, `${hash}${ext}`);
  }
});
var fileFilter = (_req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/postscript",
    // .ai, .eps
    "image/vnd.adobe.photoshop",
    // .psd
    "application/x-coreldraw",
    // .cdr
    "image/svg+xml"
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de arquivo n\xE3o permitido: ${file.mimetype}`));
  }
};
var upload = (0, import_multer.default)({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024
  }
});

// src/routes/arte.routes.ts
var router4 = (0, import_express4.Router)();
router4.use(authMiddleware);
router4.get("/", list3);
router4.post("/", create2);
router4.put("/:id", update2);
router4.put("/:id/status", updateStatus);
router4.delete("/:id", remove2);
router4.post("/:id/arquivos", upload.array("arquivos", 10), uploadArquivos);
router4.delete("/:id/arquivos/:arquivoId", deleteArquivo2);

// src/routes/checklist.routes.ts
var import_express5 = require("express");

// src/controllers/checklist.controller.ts
var import_zod6 = require("zod");

// src/services/checklist.service.ts
function getToday() {
  return getHojeEmSaoPaulo();
}
function isAtrasado(horarioLimite, feito) {
  if (!horarioLimite || feito) return false;
  const agora = getAgoraEmSaoPaulo();
  const [h, m] = horarioLimite.split(":").map(Number);
  return agora.hour > (h ?? 0) || agora.hour === (h ?? 0) && agora.minute > (m ?? 0);
}
function isNoHorario(feitoEm, horarioLimite) {
  if (!feitoEm || !horarioLimite) return false;
  const [h, m] = horarioLimite.split(":").map(Number);
  const { hora, minuto } = getHoraMinutoSP(feitoEm);
  return hora < (h ?? 0) || hora === (h ?? 0) && minuto <= (m ?? 0);
}
async function listarItens(role) {
  const where = role === "ADMIN" ? {} : { ativo: true };
  return prisma.checklistItem.findMany({
    where,
    orderBy: { ordem: "asc" }
  });
}
async function criarItem(data) {
  if (data.ordem === void 0) {
    const ultimo = await prisma.checklistItem.findFirst({
      orderBy: { ordem: "desc" }
    });
    data.ordem = (ultimo?.ordem ?? 0) + 1;
  }
  return prisma.checklistItem.create({ data });
}
async function editarItem(id, data) {
  return prisma.checklistItem.update({
    where: { id },
    data
  });
}
async function toggleAtivoItem(id) {
  const item = await prisma.checklistItem.findUniqueOrThrow({ where: { id } });
  return prisma.checklistItem.update({
    where: { id },
    data: { ativo: !item.ativo }
  });
}
async function deletarItem(id) {
  return prisma.checklistItem.delete({ where: { id } });
}
async function getChecklistHoje() {
  const today = getToday();
  const itens = await prisma.checklistItem.findMany({
    where: { ativo: true },
    orderBy: { ordem: "asc" }
  });
  const registros = await prisma.checklistRegistro.findMany({
    where: { data: today },
    include: {
      user: {
        select: { id: true, name: true, initials: true, avatarColor: true }
      }
    }
  });
  const registroMap = new Map(registros.map((r) => [r.itemId, r]));
  return itens.map((item) => {
    const reg = registroMap.get(item.id);
    const feito = reg?.feito ?? false;
    const feitoEm = reg?.feitoEm ?? null;
    const feitoPor = feito && reg?.user ? reg.user : null;
    const atrasado = isAtrasado(item.horarioLimite, feito);
    return {
      id: item.id,
      titulo: item.titulo,
      descricao: item.descricao,
      horarioLimite: item.horarioLimite,
      ordem: item.ordem,
      ativo: item.ativo,
      feito,
      feitoEm: feitoEm?.toISOString() ?? null,
      feitoPor,
      atrasado
    };
  });
}
async function marcarItem(itemId, userId) {
  const today = getToday();
  await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId } });
  const existente = await prisma.checklistRegistro.findUnique({
    where: { itemId_data: { itemId, data: today } }
  });
  if (existente) {
    const novoFeito = !existente.feito;
    await prisma.checklistRegistro.update({
      where: { id: existente.id },
      data: {
        feito: novoFeito,
        feitoEm: novoFeito ? /* @__PURE__ */ new Date() : null,
        userId: novoFeito ? userId : existente.userId
      }
    });
  } else {
    await prisma.checklistRegistro.create({
      data: {
        itemId,
        userId,
        data: today,
        feito: true,
        feitoEm: /* @__PURE__ */ new Date()
      }
    });
  }
  return getChecklistHoje();
}
async function getRelatorio2(startDate, endDate) {
  const start = /* @__PURE__ */ new Date(startDate + "T00:00:00");
  const end = /* @__PURE__ */ new Date(endDate + "T23:59:59");
  const registros = await prisma.checklistRegistro.findMany({
    where: {
      data: { gte: start, lte: end }
    },
    include: {
      item: true,
      user: { select: { name: true } }
    },
    orderBy: { data: "asc" }
  });
  const itensAtivos = await prisma.checklistItem.findMany({
    where: { ativo: true },
    orderBy: { ordem: "asc" }
  });
  const diasMap = /* @__PURE__ */ new Map();
  const current = new Date(start);
  while (current <= end) {
    const key = current.toISOString().slice(0, 10);
    diasMap.set(key, []);
    current.setDate(current.getDate() + 1);
  }
  for (const reg of registros) {
    const key = reg.data.toISOString().slice(0, 10);
    const arr = diasMap.get(key);
    if (arr) arr.push(reg);
  }
  const resultado = Array.from(diasMap.entries()).map(([data, regs]) => {
    const totalItens = itensAtivos.length;
    const regMap = new Map(regs.map((r) => [r.itemId, r]));
    const itens = itensAtivos.map((item) => {
      const reg = regMap.get(item.id);
      const feito = reg?.feito ?? false;
      const feitoEm = reg?.feitoEm ?? null;
      const feitoPor = reg?.user?.name ?? null;
      const noHorario = isNoHorario(feitoEm, item.horarioLimite);
      return {
        titulo: item.titulo,
        feito,
        feitoEm: feitoEm?.toISOString() ?? null,
        feitoPor,
        horarioLimite: item.horarioLimite,
        noHorario
      };
    });
    const itensConcluidos = itens.filter((i) => i.feito).length;
    const percentual = totalItens > 0 ? Math.round(itensConcluidos / totalItens * 100) : 0;
    return {
      data,
      totalItens,
      itensConcluidos,
      percentual,
      itens
    };
  });
  return resultado;
}

// src/controllers/checklist.controller.ts
var criarItemSchema = import_zod6.z.object({
  titulo: import_zod6.z.string().min(2).max(100),
  descricao: import_zod6.z.string().max(300).optional(),
  horarioLimite: import_zod6.z.string().regex(/^\d{2}:\d{2}$/).optional(),
  ordem: import_zod6.z.number().int().min(0).optional()
});
var editarItemSchema = import_zod6.z.object({
  titulo: import_zod6.z.string().min(2).max(100).optional(),
  descricao: import_zod6.z.string().max(300).optional(),
  horarioLimite: import_zod6.z.string().regex(/^\d{2}:\d{2}$/).optional(),
  ordem: import_zod6.z.number().int().min(0).optional()
});
var relatorioQuerySchema = import_zod6.z.object({
  startDate: import_zod6.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: import_zod6.z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
async function listarItens2(req, res, next) {
  try {
    const itens = await listarItens(req.userRole);
    res.json(itens);
  } catch (error) {
    next(error);
  }
}
async function criarItem2(req, res, next) {
  try {
    if (req.userRole !== "ADMIN") {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const data = criarItemSchema.parse(req.body);
    const item = await criarItem(data);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
}
async function editarItem2(req, res, next) {
  try {
    if (req.userRole !== "ADMIN") {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const data = editarItemSchema.parse(req.body);
    const item = await editarItem(req.params.id, data);
    res.json(item);
  } catch (error) {
    next(error);
  }
}
async function toggleItem(req, res, next) {
  try {
    if (req.userRole !== "ADMIN") {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const item = await toggleAtivoItem(req.params.id);
    res.json(item);
  } catch (error) {
    next(error);
  }
}
async function deletarItem2(req, res, next) {
  try {
    if (req.userRole !== "ADMIN") {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    await deletarItem(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
async function checklistHoje(_req, res, next) {
  try {
    const itens = await getChecklistHoje();
    res.json(itens);
  } catch (error) {
    next(error);
  }
}
async function marcarItem2(req, res, next) {
  try {
    const itens = await marcarItem(req.params.itemId, req.userId);
    res.json(itens);
  } catch (error) {
    next(error);
  }
}
async function relatorio2(req, res, next) {
  try {
    if (req.userRole !== "ADMIN") {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const query = relatorioQuerySchema.parse(req.query);
    const resultado = await getRelatorio2(query.startDate, query.endDate);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
}

// src/routes/checklist.routes.ts
var router5 = (0, import_express5.Router)();
router5.use(authMiddleware);
router5.get("/itens", listarItens2);
router5.post("/itens", criarItem2);
router5.put("/itens/:id", editarItem2);
router5.patch("/itens/:id/toggle", toggleItem);
router5.delete("/itens/:id", deletarItem2);
router5.get("/hoje", checklistHoje);
router5.post("/marcar/:itemId", marcarItem2);
router5.get("/relatorio", relatorio2);

// src/routes/pricing.routes.ts
var import_express6 = require("express");

// src/controllers/pricing.controller.ts
var import_zod7 = require("zod");

// src/services/pricing.service.ts
var productInclude = {
  pricingTiers: {
    orderBy: { minQuantity: "asc" }
  },
  sizeVariations: {
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  },
  finishLinks: {
    include: {
      finish: true
    }
  }
};
var INITIAL_FINISHES = [
  { name: "Encaderna\xE7\xE3o", type: "BINDING", value: 19.9, pricingType: "FIXED" },
  { name: "Plastifica\xE7\xE3o A4", type: "LAMINATION", value: 14.9, pricingType: "FIXED" },
  { name: "Corte Especial", type: "SPECIAL_CUT", value: 9.9, pricingType: "FIXED" },
  { name: "Vinco/Dobra", type: "CREASE_FOLD", value: 4.9, pricingType: "FIXED" },
  { name: "Lamina\xE7\xE3o Fosca", type: "LAMINATION", value: 30, pricingType: "PERCENTAGE" },
  { name: "Lamina\xE7\xE3o Hologr\xE1fica", type: "LAMINATION", value: 50, pricingType: "PERCENTAGE" }
];
var INITIAL_PRODUCTS = [
  {
    name: "Impress\xE3o A4 PB",
    description: "Linha interna para produ\xE7\xE3o r\xE1pida com tabela progressiva por volume.",
    category: "Impress\xE3o Interna",
    premiumCategory: "Opera\xE7\xE3o Expressa",
    sortOrder: 10,
    pricingMode: "PROGRESSIVE",
    legacyProdutoTipo: null,
    pricingTiers: [
      { minQuantity: 1, maxQuantity: 1, unitPrice: 3 },
      { minQuantity: 2, maxQuantity: 10, unitPrice: 2.5 },
      { minQuantity: 11, maxQuantity: 30, unitPrice: 1.9 },
      { minQuantity: 31, maxQuantity: 100, unitPrice: 1.4 },
      { minQuantity: 101, maxQuantity: null, unitPrice: 1 }
    ]
  },
  {
    name: "Impress\xE3o A4 Colorido",
    description: "Acabamento colorido premium com ganho progressivo por tiragem.",
    category: "Impress\xE3o Interna",
    premiumCategory: "Linha Corporativa",
    sortOrder: 20,
    pricingMode: "PROGRESSIVE",
    legacyProdutoTipo: null,
    pricingTiers: [
      { minQuantity: 1, maxQuantity: 1, unitPrice: 8.9 },
      { minQuantity: 2, maxQuantity: 10, unitPrice: 7.5 },
      { minQuantity: 11, maxQuantity: 30, unitPrice: 5.9 },
      { minQuantity: 31, maxQuantity: 100, unitPrice: 4.5 },
      { minQuantity: 101, maxQuantity: null, unitPrice: 2.9 }
    ]
  },
  {
    name: "Impress\xE3o A3 PB",
    description: "Formato ampliado em preto e branco com precifica\xE7\xE3o por escala.",
    category: "Impress\xE3o Interna",
    premiumCategory: "Grandes Formatos",
    sortOrder: 30,
    pricingMode: "PROGRESSIVE",
    legacyProdutoTipo: null,
    pricingTiers: [
      { minQuantity: 1, maxQuantity: 1, unitPrice: 6.9 },
      { minQuantity: 2, maxQuantity: 10, unitPrice: 5.9 },
      { minQuantity: 11, maxQuantity: 30, unitPrice: 4.5 },
      { minQuantity: 31, maxQuantity: 100, unitPrice: 3.2 },
      { minQuantity: 101, maxQuantity: null, unitPrice: 2.2 }
    ]
  },
  {
    name: "Impress\xE3o A3 Colorido",
    description: "Formato premium colorido para materiais high-ticket e apresenta\xE7\xF5es.",
    category: "Impress\xE3o Interna",
    premiumCategory: "Grandes Formatos",
    sortOrder: 40,
    pricingMode: "PROGRESSIVE",
    legacyProdutoTipo: null,
    pricingTiers: [
      { minQuantity: 1, maxQuantity: 1, unitPrice: 15.9 },
      { minQuantity: 2, maxQuantity: 10, unitPrice: 13.9 },
      { minQuantity: 11, maxQuantity: 30, unitPrice: 10.9 },
      { minQuantity: 31, maxQuantity: 100, unitPrice: 7.9 },
      { minQuantity: 101, maxQuantity: null, unitPrice: 4.9 }
    ]
  },
  {
    name: "Plastifica\xE7\xE3o RG",
    description: "Servi\xE7o r\xE1pido de plastifica\xE7\xE3o no formato RG para balc\xE3o e retirada expressa.",
    category: "Acabamentos R\xE1pidos",
    premiumCategory: "Opera\xE7\xE3o Expressa",
    sortOrder: 50,
    pricingMode: "FIXED",
    fixedUnitPrice: 8.9,
    legacyProdutoTipo: null
  },
  {
    name: "Plastifica\xE7\xE3o A4",
    description: "Servi\xE7o avulso de plastifica\xE7\xE3o A4 com valor fixo para venda r\xE1pida.",
    category: "Acabamentos R\xE1pidos",
    premiumCategory: "Opera\xE7\xE3o Expressa",
    sortOrder: 60,
    pricingMode: "FIXED",
    fixedUnitPrice: 14.9,
    legacyProdutoTipo: null
  },
  {
    name: "Foto 10x15",
    description: "Foto instant\xE2nea com curva progressiva at\xE9 valor balc\xE3o otimizado para grandes tiragens.",
    category: "Fotografia Instant\xE2nea",
    premiumCategory: "Opera\xE7\xE3o Expressa",
    sortOrder: 70,
    pricingMode: "PROGRESSIVE",
    legacyProdutoTipo: null,
    pricingTiers: [
      { minQuantity: 1, maxQuantity: 1, unitPrice: 5.5 },
      { minQuantity: 2, maxQuantity: 10, unitPrice: 5 },
      { minQuantity: 11, maxQuantity: 30, unitPrice: 4.5 },
      { minQuantity: 31, maxQuantity: 100, unitPrice: 4 },
      { minQuantity: 101, maxQuantity: null, unitPrice: 3.5 }
    ]
  },
  {
    name: "Foto 13x18",
    description: "Foto premium 13x18 com desconto progressivo para lotes maiores.",
    category: "Fotografia Instant\xE2nea",
    premiumCategory: "Linha Corporativa",
    sortOrder: 80,
    pricingMode: "PROGRESSIVE",
    legacyProdutoTipo: null,
    pricingTiers: [
      { minQuantity: 1, maxQuantity: 1, unitPrice: 10 },
      { minQuantity: 2, maxQuantity: 10, unitPrice: 9 },
      { minQuantity: 11, maxQuantity: 30, unitPrice: 8.5 },
      { minQuantity: 31, maxQuantity: 100, unitPrice: 7.8 },
      { minQuantity: 101, maxQuantity: null, unitPrice: 7 }
    ]
  },
  {
    name: "Foto 15x20",
    description: "Foto premium 15x20 com curva progressiva para venda avulsa e tiragens maiores.",
    category: "Fotografia Instant\xE2nea",
    premiumCategory: "Linha Corporativa",
    sortOrder: 90,
    pricingMode: "PROGRESSIVE",
    legacyProdutoTipo: null,
    pricingTiers: [
      { minQuantity: 1, maxQuantity: 1, unitPrice: 10 },
      { minQuantity: 2, maxQuantity: 10, unitPrice: 9 },
      { minQuantity: 11, maxQuantity: 30, unitPrice: 8.5 },
      { minQuantity: 31, maxQuantity: 100, unitPrice: 7.8 },
      { minQuantity: 101, maxQuantity: null, unitPrice: 7 }
    ]
  },
  {
    name: "Cart\xE3o Couch\xEA 300g 100un",
    description: "Cart\xE3o de visita terceirizado com regra comercial premium.",
    category: "Terceiriza\xE7\xE3o Estrat\xE9gica",
    premiumCategory: "Cart\xF5es de Visita",
    sortOrder: 110,
    pricingMode: "OUTSOURCED",
    isOutsourced: true,
    supplierCost: 45.99,
    legacyProdutoTipo: "CARTAO_VISITA"
  },
  {
    name: "Cart\xE3o Premium 600g",
    description: "Linha premium para cart\xF5es robustos com percep\xE7\xE3o high-ticket.",
    category: "Terceiriza\xE7\xE3o Estrat\xE9gica",
    premiumCategory: "Cart\xF5es de Visita",
    sortOrder: 120,
    pricingMode: "OUTSOURCED",
    isOutsourced: true,
    supplierCost: 73.99,
    legacyProdutoTipo: "CARTAO_VISITA"
  },
  {
    name: "Cart\xE3o Hot Stamping",
    description: "Cart\xE3o terceirizado com acabamento premium metalizado.",
    category: "Terceiriza\xE7\xE3o Estrat\xE9gica",
    premiumCategory: "Cart\xF5es de Visita",
    sortOrder: 130,
    pricingMode: "OUTSOURCED",
    isOutsourced: true,
    supplierCost: 80.99,
    legacyProdutoTipo: "CARTAO_VISITA"
  },
  {
    name: "Cart\xE3o Hologr\xE1fico",
    description: "Vers\xE3o terceirizada com apelo visual premium e acabamento hologr\xE1fico.",
    category: "Terceiriza\xE7\xE3o Estrat\xE9gica",
    premiumCategory: "Cart\xF5es de Visita",
    sortOrder: 140,
    pricingMode: "OUTSOURCED",
    isOutsourced: true,
    supplierCost: 55.99,
    legacyProdutoTipo: "CARTAO_VISITA"
  },
  {
    name: "PVC Premium",
    description: "Cart\xE3o em PVC terceirizado com valor agregado e venda corporativa.",
    category: "Terceiriza\xE7\xE3o Estrat\xE9gica",
    premiumCategory: "Cart\xF5es de Visita",
    sortOrder: 150,
    pricingMode: "OUTSOURCED",
    isOutsourced: true,
    supplierCost: 57.99,
    legacyProdutoTipo: "CARTAO_VISITA"
  },
  {
    name: "Flyer Couch\xEA 10x15",
    description: "Flyer terceirizado para campanhas promocionais com c\xE1lculo premium autom\xE1tico.",
    category: "Terceiriza\xE7\xE3o Estrat\xE9gica",
    premiumCategory: "Flyers e Panfletos",
    sortOrder: 160,
    pricingMode: "OUTSOURCED",
    isOutsourced: true,
    supplierCost: 32.9,
    legacyProdutoTipo: "PANFLETO"
  },
  {
    name: "Folder 2 Dobras",
    description: "Folder terceirizado para apresenta\xE7\xE3o corporativa com margem premium.",
    category: "Terceiriza\xE7\xE3o Estrat\xE9gica",
    premiumCategory: "Folders e Institucionais",
    sortOrder: 170,
    pricingMode: "OUTSOURCED",
    isOutsourced: true,
    supplierCost: 49.9,
    legacyProdutoTipo: "FOLDER"
  }
];
function trimOrNull(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
function normalizeTier(tier) {
  return {
    minQuantity: tier.minQuantity,
    maxQuantity: tier.maxQuantity ?? null,
    unitPrice: Number(tier.unitPrice.toFixed(2))
  };
}
function validatePricingTiers(tiers) {
  if (tiers.length === 0) {
    throw Object.assign(new Error("Produtos progressivos precisam ter ao menos uma faixa de pre\xE7o"), { statusCode: 400 });
  }
  const ordered = [...tiers].map(normalizeTier).sort((first, second) => first.minQuantity - second.minQuantity);
  if (ordered[0]?.minQuantity !== 1) {
    throw Object.assign(new Error("A primeira faixa deve come\xE7ar em 1 unidade"), { statusCode: 400 });
  }
  ordered.forEach((tier, index) => {
    const maxQuantity = tier.maxQuantity ?? null;
    if (maxQuantity !== null && maxQuantity < tier.minQuantity) {
      throw Object.assign(new Error("Faixa com quantidade m\xE1xima menor que a m\xEDnima"), { statusCode: 400 });
    }
    const next = ordered[index + 1];
    if (!next) return;
    if (maxQuantity === null) {
      throw Object.assign(new Error("Faixa aberta deve ser a \xFAltima da tabela"), { statusCode: 400 });
    }
    if (next.minQuantity !== maxQuantity + 1) {
      throw Object.assign(new Error("As faixas devem ser cont\xEDnuas, sem sobreposi\xE7\xE3o ou lacunas"), { statusCode: 400 });
    }
  });
}
function validateProductInput(input) {
  const resolvedMode = input.isOutsourced ? "OUTSOURCED" : input.pricingMode;
  if (resolvedMode === "PROGRESSIVE") {
    validatePricingTiers(input.pricingTiers ?? []);
  }
  if (resolvedMode === "FIXED" && (input.fixedUnitPrice ?? 0) <= 0) {
    throw Object.assign(new Error("Informe um pre\xE7o unit\xE1rio fixo para produtos em modo fixo"), { statusCode: 400 });
  }
  if (resolvedMode === "OUTSOURCED" && (input.supplierCost ?? 0) <= 0) {
    throw Object.assign(new Error("Informe o custo do fornecedor para produtos terceirizados"), { statusCode: 400 });
  }
}
function serializeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    premiumCategory: product.premiumCategory,
    legacyProdutoTipo: product.legacyProdutoTipo,
    isOutsourced: product.isOutsourced,
    supplierCost: product.supplierCost,
    pricingMode: product.pricingMode,
    fixedUnitPrice: product.fixedUnitPrice,
    urgencyEnabled: product.urgencyEnabled,
    active: product.active,
    sortOrder: product.sortOrder,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    pricingTiers: product.pricingTiers,
    sizeVariations: product.sizeVariations,
    availableFinishes: product.finishLinks.map((link) => link.finish).sort((first, second) => first.name.localeCompare(second.name)),
    availableFinishIds: product.finishLinks.map((link) => link.finishId)
  };
}
async function ensurePricingBootstrap() {
  await prisma.pricingSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      outsourcedMultiplier: 2.5
    }
  });
  const existingFinishes = await prisma.productFinish.findMany({
    select: { name: true }
  });
  const existingFinishNames = new Set(existingFinishes.map((finish) => finish.name));
  const missingFinishes = INITIAL_FINISHES.filter((finish) => !existingFinishNames.has(finish.name));
  if (missingFinishes.length > 0) {
    await prisma.productFinish.createMany({ data: missingFinishes });
  }
  const existingProducts = await prisma.product.findMany({
    select: { name: true }
  });
  const existingProductNames = new Set(existingProducts.map((product) => product.name));
  const finishes = await prisma.productFinish.findMany({ select: { id: true } });
  for (const product of INITIAL_PRODUCTS) {
    if (existingProductNames.has(product.name)) {
      continue;
    }
    await prisma.product.create({
      data: {
        name: product.name,
        description: product.description,
        category: product.category,
        premiumCategory: product.premiumCategory,
        legacyProdutoTipo: product.legacyProdutoTipo ?? null,
        isOutsourced: product.isOutsourced ?? false,
        supplierCost: product.supplierCost ?? null,
        pricingMode: product.pricingMode ?? "PROGRESSIVE",
        fixedUnitPrice: product.fixedUnitPrice ?? null,
        urgencyEnabled: true,
        active: true,
        sortOrder: product.sortOrder,
        pricingTiers: {
          create: (product.pricingTiers ?? []).map((tier) => ({
            minQuantity: tier.minQuantity,
            maxQuantity: tier.maxQuantity ?? null,
            unitPrice: tier.unitPrice
          }))
        },
        finishLinks: {
          create: finishes.map((finish) => ({
            finishId: finish.id
          }))
        }
      }
    });
  }
}
async function getSettingsRecord() {
  await ensurePricingBootstrap();
  return prisma.pricingSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      outsourcedMultiplier: 2.5
    }
  });
}
function resolveBaseUnitPrice(product, quantity, outsourcedMultiplier) {
  if (product.pricingMode === "OUTSOURCED" || product.isOutsourced) {
    const supplierCost = product.supplierCost ?? 0;
    if (supplierCost <= 0) {
      throw Object.assign(new Error("Produto terceirizado sem custo de fornecedor configurado"), { statusCode: 400 });
    }
    return {
      unitPrice: Number((supplierCost * outsourcedMultiplier).toFixed(2)),
      matchedTier: null,
      strategy: "outsourced"
    };
  }
  if (product.pricingMode === "FIXED") {
    const fixedUnitPrice = product.fixedUnitPrice ?? 0;
    if (fixedUnitPrice <= 0) {
      throw Object.assign(new Error("Produto fixo sem pre\xE7o unit\xE1rio configurado"), { statusCode: 400 });
    }
    return {
      unitPrice: Number(fixedUnitPrice.toFixed(2)),
      matchedTier: null,
      strategy: "fixed"
    };
  }
  const tier = product.pricingTiers.find((currentTier) => quantity >= currentTier.minQuantity && (currentTier.maxQuantity === null || quantity <= currentTier.maxQuantity));
  if (!tier) {
    throw Object.assign(new Error("Nenhuma faixa de pre\xE7o encontrada para a quantidade informada"), { statusCode: 400 });
  }
  return {
    unitPrice: Number(tier.unitPrice.toFixed(2)),
    matchedTier: tier,
    strategy: "progressive"
  };
}
async function getPricingSettings() {
  const settings = await getSettingsRecord();
  return settings;
}
async function updatePricingSettings(outsourcedMultiplier) {
  if (outsourcedMultiplier <= 0) {
    throw Object.assign(new Error("O multiplicador terceirizado deve ser maior que zero"), { statusCode: 400 });
  }
  return prisma.pricingSettings.upsert({
    where: { id: "default" },
    update: {
      outsourcedMultiplier: Number(outsourcedMultiplier.toFixed(2))
    },
    create: {
      id: "default",
      outsourcedMultiplier: Number(outsourcedMultiplier.toFixed(2))
    }
  });
}
async function listProductFinishes() {
  await ensurePricingBootstrap();
  return prisma.productFinish.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { name: "asc" }]
  });
}
async function listProducts() {
  await ensurePricingBootstrap();
  const products = await prisma.product.findMany({
    include: productInclude,
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }]
  });
  return products.map(serializeProduct);
}
async function createProduct(input) {
  await ensurePricingBootstrap();
  validateProductInput(input);
  const resolvedMode = input.isOutsourced ? "OUTSOURCED" : input.pricingMode;
  const finishIds = [...new Set(input.finishIds ?? [])];
  const product = await prisma.product.create({
    data: {
      name: input.name.trim(),
      description: trimOrNull(input.description),
      category: input.category.trim(),
      premiumCategory: trimOrNull(input.premiumCategory),
      legacyProdutoTipo: input.legacyProdutoTipo ?? null,
      isOutsourced: resolvedMode === "OUTSOURCED",
      supplierCost: resolvedMode === "OUTSOURCED" ? Number((input.supplierCost ?? 0).toFixed(2)) : null,
      pricingMode: resolvedMode,
      fixedUnitPrice: resolvedMode === "FIXED" ? Number((input.fixedUnitPrice ?? 0).toFixed(2)) : null,
      urgencyEnabled: input.urgencyEnabled ?? true,
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 0,
      pricingTiers: {
        create: resolvedMode === "PROGRESSIVE" ? (input.pricingTiers ?? []).map((tier) => ({
          minQuantity: tier.minQuantity,
          maxQuantity: tier.maxQuantity ?? null,
          unitPrice: Number(tier.unitPrice.toFixed(2))
        })) : []
      },
      sizeVariations: {
        create: (input.sizeVariations ?? []).map((variation, index) => ({
          name: variation.name.trim(),
          widthCm: variation.widthCm ?? null,
          heightCm: variation.heightCm ?? null,
          value: Number((variation.value ?? 0).toFixed(2)),
          pricingType: variation.pricingType ?? "FIXED",
          sortOrder: variation.sortOrder ?? index
        }))
      },
      finishLinks: {
        create: finishIds.map((finishId) => ({ finishId }))
      }
    },
    include: productInclude
  });
  return serializeProduct(product);
}
async function updateProduct(id, input) {
  await ensurePricingBootstrap();
  const existing = await prisma.product.findUnique({
    where: { id },
    include: productInclude
  });
  if (!existing) {
    throw Object.assign(new Error("Produto n\xE3o encontrado"), { statusCode: 404 });
  }
  const merged = {
    name: input.name ?? existing.name,
    description: input.description ?? existing.description ?? void 0,
    category: input.category ?? existing.category,
    premiumCategory: input.premiumCategory ?? existing.premiumCategory ?? void 0,
    legacyProdutoTipo: input.legacyProdutoTipo === void 0 ? existing.legacyProdutoTipo : input.legacyProdutoTipo,
    isOutsourced: input.isOutsourced ?? existing.isOutsourced,
    supplierCost: input.supplierCost === void 0 ? existing.supplierCost : input.supplierCost,
    pricingMode: input.pricingMode ?? existing.pricingMode,
    fixedUnitPrice: input.fixedUnitPrice === void 0 ? existing.fixedUnitPrice : input.fixedUnitPrice,
    urgencyEnabled: input.urgencyEnabled ?? existing.urgencyEnabled,
    active: input.active ?? existing.active,
    sortOrder: input.sortOrder ?? existing.sortOrder,
    pricingTiers: input.pricingTiers ?? existing.pricingTiers.map((tier) => ({
      minQuantity: tier.minQuantity,
      maxQuantity: tier.maxQuantity,
      unitPrice: tier.unitPrice
    })),
    sizeVariations: input.sizeVariations ?? existing.sizeVariations.map((variation) => ({
      name: variation.name,
      widthCm: variation.widthCm,
      heightCm: variation.heightCm,
      value: variation.value,
      pricingType: variation.pricingType,
      sortOrder: variation.sortOrder
    })),
    finishIds: input.finishIds ?? existing.finishLinks.map((link) => link.finishId)
  };
  validateProductInput(merged);
  const resolvedMode = merged.isOutsourced ? "OUTSOURCED" : merged.pricingMode;
  const finishIds = [...new Set(merged.finishIds ?? [])];
  const product = await prisma.$transaction(async (transaction) => {
    await transaction.pricingTier.deleteMany({ where: { productId: id } });
    await transaction.productSizeVariation.deleteMany({ where: { productId: id } });
    await transaction.productFinishProduct.deleteMany({ where: { productId: id } });
    return transaction.product.update({
      where: { id },
      data: {
        name: merged.name.trim(),
        description: trimOrNull(merged.description),
        category: merged.category.trim(),
        premiumCategory: trimOrNull(merged.premiumCategory),
        legacyProdutoTipo: merged.legacyProdutoTipo ?? null,
        isOutsourced: resolvedMode === "OUTSOURCED",
        supplierCost: resolvedMode === "OUTSOURCED" ? Number((merged.supplierCost ?? 0).toFixed(2)) : null,
        pricingMode: resolvedMode,
        fixedUnitPrice: resolvedMode === "FIXED" ? Number((merged.fixedUnitPrice ?? 0).toFixed(2)) : null,
        urgencyEnabled: merged.urgencyEnabled ?? true,
        active: merged.active ?? true,
        sortOrder: merged.sortOrder ?? 0,
        pricingTiers: {
          create: resolvedMode === "PROGRESSIVE" ? (merged.pricingTiers ?? []).map((tier) => ({
            minQuantity: tier.minQuantity,
            maxQuantity: tier.maxQuantity ?? null,
            unitPrice: Number(tier.unitPrice.toFixed(2))
          })) : []
        },
        sizeVariations: {
          create: (merged.sizeVariations ?? []).map((variation, index) => ({
            name: variation.name.trim(),
            widthCm: variation.widthCm ?? null,
            heightCm: variation.heightCm ?? null,
            value: Number((variation.value ?? 0).toFixed(2)),
            pricingType: variation.pricingType ?? "FIXED",
            sortOrder: variation.sortOrder ?? index
          }))
        },
        finishLinks: {
          create: finishIds.map((finishId) => ({ finishId }))
        }
      },
      include: productInclude
    });
  });
  return serializeProduct(product);
}
async function previewPricing(input) {
  await ensurePricingBootstrap();
  const settings = await getSettingsRecord();
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    include: productInclude
  });
  if (!product || !product.active) {
    throw Object.assign(new Error("Produto n\xE3o encontrado ou inativo"), { statusCode: 404 });
  }
  const { unitPrice, matchedTier, strategy } = resolveBaseUnitPrice(product, input.quantity, settings.outsourcedMultiplier);
  const baseSubtotal = Number((unitPrice * input.quantity).toFixed(2));
  const selectedVariation = input.sizeVariationId ? product.sizeVariations.find((variation) => variation.id === input.sizeVariationId) ?? null : null;
  const sizeVariationAmount = selectedVariation ? Number((selectedVariation.pricingType === "PERCENTAGE" ? baseSubtotal * (selectedVariation.value / 100) : selectedVariation.value).toFixed(2)) : 0;
  const subtotalBeforeFinishes = Number((baseSubtotal + sizeVariationAmount).toFixed(2));
  const requestedFinishIds = new Set(input.finishIds ?? []);
  const selectedFinishes = product.finishLinks.map((link) => link.finish).filter((finish) => requestedFinishIds.has(finish.id));
  const finishBreakdown = selectedFinishes.map((finish) => {
    const amount = finish.pricingType === "PERCENTAGE" ? subtotalBeforeFinishes * (finish.value / 100) : finish.value;
    return {
      id: finish.id,
      name: finish.name,
      pricingType: finish.pricingType,
      value: finish.value,
      amount: Number(amount.toFixed(2))
    };
  });
  const finishesAmount = Number(finishBreakdown.reduce((sum, finish) => sum + finish.amount, 0).toFixed(2));
  const subtotalWithFinishes = Number((subtotalBeforeFinishes + finishesAmount).toFixed(2));
  const urgencyMap = {
    NONE: 0,
    PRIORITARIO: 20,
    EXPRESS: 30
  };
  const urgencyPercentage = product.urgencyEnabled ? urgencyMap[input.urgency ?? "NONE"] : 0;
  const urgencyAmount = Number((subtotalWithFinishes * (urgencyPercentage / 100)).toFixed(2));
  const total = Number((subtotalWithFinishes + urgencyAmount).toFixed(2));
  return {
    product: serializeProduct(product),
    settings,
    quantity: input.quantity,
    pricingStrategy: strategy,
    baseUnitPrice: unitPrice,
    baseSubtotal,
    matchedTier: matchedTier ? {
      id: matchedTier.id,
      minQuantity: matchedTier.minQuantity,
      maxQuantity: matchedTier.maxQuantity,
      unitPrice: matchedTier.unitPrice
    } : null,
    selectedSizeVariation: selectedVariation ? {
      id: selectedVariation.id,
      name: selectedVariation.name,
      pricingType: selectedVariation.pricingType,
      value: selectedVariation.value,
      amount: sizeVariationAmount
    } : null,
    selectedFinishes: finishBreakdown,
    finishesAmount,
    subtotalBeforeUrgency: subtotalWithFinishes,
    urgency: {
      level: input.urgency ?? "NONE",
      percentage: urgencyPercentage,
      amount: urgencyAmount,
      enabled: product.urgencyEnabled
    },
    outsourcedMultiplier: settings.outsourcedMultiplier,
    total
  };
}

// src/controllers/pricing.controller.ts
var produtoTipoSchema2 = import_zod7.z.enum([
  "AZULEJO",
  "BANNER",
  "ADESIVO",
  "ADESIVO_RECORTE",
  "LONA",
  "PLACA",
  "FAIXA",
  "CARTAO_VISITA",
  "PANFLETO",
  "FOLDER",
  "PERFURADO",
  "ENVELOPAMENTO",
  "BACKLIGHT",
  "OUTRO"
]);
var pricingModeSchema = import_zod7.z.enum(["PROGRESSIVE", "FIXED", "OUTSOURCED"]);
var modifierTypeSchema = import_zod7.z.enum(["FIXED", "PERCENTAGE"]);
var urgencySchema = import_zod7.z.enum(["NONE", "PRIORITARIO", "EXPRESS"]);
var pricingTierSchema = import_zod7.z.object({
  minQuantity: import_zod7.z.number().int().min(1),
  maxQuantity: import_zod7.z.number().int().min(1).nullable().optional(),
  unitPrice: import_zod7.z.number().positive()
});
var sizeVariationSchema = import_zod7.z.object({
  name: import_zod7.z.string().min(1, "Nome da varia\xE7\xE3o \xE9 obrigat\xF3rio"),
  widthCm: import_zod7.z.number().positive().nullable().optional(),
  heightCm: import_zod7.z.number().positive().nullable().optional(),
  value: import_zod7.z.number().nonnegative().optional(),
  pricingType: modifierTypeSchema.optional(),
  sortOrder: import_zod7.z.number().int().min(0).optional()
});
var createProductSchema = import_zod7.z.object({
  name: import_zod7.z.string().min(2, "Nome do produto \xE9 obrigat\xF3rio"),
  description: import_zod7.z.string().optional(),
  category: import_zod7.z.string().min(2, "Categoria \xE9 obrigat\xF3ria"),
  premiumCategory: import_zod7.z.string().optional(),
  legacyProdutoTipo: produtoTipoSchema2.nullable().optional(),
  isOutsourced: import_zod7.z.boolean().optional(),
  supplierCost: import_zod7.z.number().positive().nullable().optional(),
  pricingMode: pricingModeSchema,
  fixedUnitPrice: import_zod7.z.number().positive().nullable().optional(),
  urgencyEnabled: import_zod7.z.boolean().optional(),
  active: import_zod7.z.boolean().optional(),
  sortOrder: import_zod7.z.number().int().min(0).optional(),
  pricingTiers: import_zod7.z.array(pricingTierSchema).optional(),
  sizeVariations: import_zod7.z.array(sizeVariationSchema).optional(),
  finishIds: import_zod7.z.array(import_zod7.z.string().min(1)).optional()
});
var updateProductSchema = createProductSchema.partial();
var updateSettingsSchema = import_zod7.z.object({
  outsourcedMultiplier: import_zod7.z.number().positive()
});
var previewPricingSchema = import_zod7.z.object({
  productId: import_zod7.z.string().min(1),
  quantity: import_zod7.z.number().int().min(1),
  finishIds: import_zod7.z.array(import_zod7.z.string().min(1)).optional(),
  sizeVariationId: import_zod7.z.string().min(1).optional(),
  urgency: urgencySchema.optional()
});
function resolveParamId(id) {
  return Array.isArray(id) ? id[0] : id;
}
async function getSettings(_req, res, next) {
  try {
    const settings = await getPricingSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
}
async function updateSettings(req, res, next) {
  try {
    const body = updateSettingsSchema.parse(req.body);
    const settings = await updatePricingSettings(body.outsourcedMultiplier);
    res.json(settings);
  } catch (error) {
    next(error);
  }
}
async function listFinishes(_req, res, next) {
  try {
    const finishes = await listProductFinishes();
    res.json(finishes);
  } catch (error) {
    next(error);
  }
}
async function listProducts2(_req, res, next) {
  try {
    const products = await listProducts();
    res.json(products);
  } catch (error) {
    next(error);
  }
}
async function createProduct2(req, res, next) {
  try {
    const body = createProductSchema.parse(req.body);
    const product = await createProduct(body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
}
async function updateProduct2(req, res, next) {
  try {
    const productId = resolveParamId(req.params.id);
    if (!productId) {
      res.status(400).json({ message: "ID do produto \xE9 obrigat\xF3rio" });
      return;
    }
    const body = updateProductSchema.parse(req.body);
    const product = await updateProduct(productId, body);
    res.json(product);
  } catch (error) {
    next(error);
  }
}
async function preview(req, res, next) {
  try {
    const body = previewPricingSchema.parse(req.body);
    const preview2 = await previewPricing(body);
    res.json(preview2);
  } catch (error) {
    next(error);
  }
}

// src/routes/pricing.routes.ts
var router6 = (0, import_express6.Router)();
router6.use(authMiddleware);
router6.get("/settings", getSettings);
router6.get("/finishes", listFinishes);
router6.get("/products", listProducts2);
router6.post("/preview", preview);
router6.put("/settings", adminOnly, updateSettings);
router6.post("/products", adminOnly, createProduct2);
router6.put("/products/:id", adminOnly, updateProduct2);

// src/routes/venda.routes.ts
var import_express7 = require("express");

// src/controllers/venda.controller.ts
var import_zod8 = require("zod");

// src/services/venda.service.ts
var import_luxon4 = require("luxon");
var responsavelSelect2 = {
  id: true,
  name: true,
  initials: true,
  avatarColor: true,
  loja: true
};
async function gerarCodigoVenda() {
  const anoAtual = import_luxon4.DateTime.now().setZone("America/Sao_Paulo").year;
  const prefixo = `VDA-${anoAtual}-`;
  const vendas = await prisma.venda.findMany({
    where: {
      codigo: {
        startsWith: prefixo
      }
    },
    select: { codigo: true }
  });
  const maiorNumero = vendas.reduce((maior, venda) => {
    const match = venda.codigo.match(new RegExp(`^${prefixo}(\\d+)$`));
    const numero = match?.[1] ? Number.parseInt(match[1], 10) : 0;
    return Number.isNaN(numero) ? maior : Math.max(maior, numero);
  }, 0);
  return `${prefixo}${String(maiorNumero + 1).padStart(3, "0")}`;
}
function validarFormaPagamento(status, formaPagamento) {
  if (status === "CONCLUIDA" && !formaPagamento) {
    throw Object.assign(new Error("Forma de pagamento \xE9 obrigat\xF3ria para concluir a venda"), { statusCode: 400 });
  }
}
async function listVendas(userId, role) {
  const where = role === "ADMIN" ? {} : { responsavelId: userId };
  return prisma.venda.findMany({
    where,
    include: {
      responsavel: {
        select: responsavelSelect2
      }
    },
    orderBy: { createdAt: "desc" }
  });
}
async function createVenda(userId, data) {
  validarFormaPagamento(data.status, data.formaPagamento);
  const pricingResult = await previewPricing({
    productId: data.pricingProductId,
    quantity: data.quantidade,
    finishIds: data.finishIds,
    sizeVariationId: data.sizeVariationId,
    urgency: data.urgencia
  });
  const createData = {
    codigo: await gerarCodigoVenda(),
    clienteNome: data.clienteNome?.trim() || null,
    clienteDocumento: data.clienteDocumento?.trim() || null,
    produto: pricingResult.product.legacyProdutoTipo,
    produtoNome: pricingResult.product.name,
    pricingProductId: pricingResult.product.id,
    quantidade: data.quantidade,
    valorUnitario: pricingResult.baseUnitPrice,
    valorTotal: pricingResult.total,
    subtotalBase: pricingResult.baseSubtotal,
    acabamentosValor: pricingResult.finishesAmount,
    urgenciaValor: pricingResult.urgency.amount,
    sizeVariationId: pricingResult.selectedSizeVariation?.id ?? null,
    sizeVariationNome: pricingResult.selectedSizeVariation?.name ?? null,
    acabamentos: pricingResult.selectedFinishes,
    pricingSnapshot: pricingResult,
    urgenciaNivel: pricingResult.urgency.level,
    status: data.status,
    formaPagamento: data.status === "CONCLUIDA" ? data.formaPagamento ?? null : null,
    observacoes: data.observacoes?.trim() || null,
    responsavelId: userId,
    finalizadaEm: data.status === "CONCLUIDA" ? /* @__PURE__ */ new Date() : null
  };
  return prisma.venda.create({
    data: createData,
    include: {
      responsavel: {
        select: responsavelSelect2
      }
    }
  });
}
async function updateVenda(id, userId, role, data) {
  const venda = await prisma.venda.findFirst({
    where: role === "ADMIN" ? { id } : { id, responsavelId: userId }
  });
  if (!venda) {
    throw Object.assign(new Error("Venda n\xE3o encontrada"), { statusCode: 404 });
  }
  const nextStatus = data.status ?? venda.status;
  const nextFormaPagamento = data.formaPagamento === void 0 ? venda.formaPagamento : data.formaPagamento;
  validarFormaPagamento(nextStatus, nextFormaPagamento);
  const updateData = {
    clienteNome: data.clienteNome === void 0 ? void 0 : data.clienteNome?.trim() || null,
    clienteDocumento: data.clienteDocumento === void 0 ? void 0 : data.clienteDocumento?.trim() || null,
    status: data.status,
    formaPagamento: nextStatus === "CONCLUIDA" ? nextFormaPagamento ?? null : null,
    observacoes: data.observacoes === void 0 ? void 0 : data.observacoes?.trim() || null,
    finalizadaEm: nextStatus === "CONCLUIDA" ? venda.finalizadaEm ?? /* @__PURE__ */ new Date() : null
  };
  return prisma.venda.update({
    where: { id },
    data: updateData,
    include: {
      responsavel: {
        select: responsavelSelect2
      }
    }
  });
}

// src/controllers/venda.controller.ts
var produtoTipoSchema3 = import_zod8.z.enum(["AZULEJO", "BANNER", "ADESIVO", "ADESIVO_RECORTE", "LONA", "PLACA", "FAIXA", "CARTAO_VISITA", "PANFLETO", "FOLDER", "PERFURADO", "ENVELOPAMENTO", "BACKLIGHT", "OUTRO"]);
var formaPagamentoSchema = import_zod8.z.enum(["PIX", "DINHEIRO", "DEBITO", "CREDITO", "BOLETO", "TRANSFERENCIA", "OUTRO"]);
var vendaStatusSchema = import_zod8.z.enum(["AGUARDANDO", "CONCLUIDA"]);
var pricingUrgencySchema = import_zod8.z.enum(["NONE", "PRIORITARIO", "EXPRESS"]);
var createVendaSchema = import_zod8.z.object({
  clienteNome: import_zod8.z.string().optional(),
  clienteDocumento: import_zod8.z.string().optional(),
  pricingProductId: import_zod8.z.string().min(1, "Produto premium \xE9 obrigat\xF3rio"),
  quantidade: import_zod8.z.number().int().min(1),
  finishIds: import_zod8.z.array(import_zod8.z.string().min(1)).optional(),
  sizeVariationId: import_zod8.z.string().min(1).optional(),
  urgencia: pricingUrgencySchema.optional(),
  status: vendaStatusSchema,
  formaPagamento: formaPagamentoSchema.optional(),
  observacoes: import_zod8.z.string().optional()
});
var updateVendaSchema = import_zod8.z.object({
  clienteNome: import_zod8.z.string().nullable().optional(),
  clienteDocumento: import_zod8.z.string().nullable().optional(),
  status: vendaStatusSchema.optional(),
  formaPagamento: formaPagamentoSchema.nullable().optional(),
  observacoes: import_zod8.z.string().nullable().optional()
});
async function list4(req, res, next) {
  try {
    const vendas = await listVendas(req.userId, req.userRole);
    res.json(vendas);
  } catch (error) {
    next(error);
  }
}
async function create3(req, res, next) {
  try {
    const body = createVendaSchema.parse(req.body);
    const venda = await createVenda(req.userId, body);
    res.status(201).json(venda);
  } catch (error) {
    next(error);
  }
}
async function update3(req, res, next) {
  try {
    const body = updateVendaSchema.parse(req.body);
    const vendaId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!vendaId) {
      res.status(400).json({ message: "ID da venda \xE9 obrigat\xF3rio" });
      return;
    }
    const venda = await updateVenda(vendaId, req.userId, req.userRole, body);
    res.json(venda);
  } catch (error) {
    next(error);
  }
}

// src/routes/venda.routes.ts
var router7 = (0, import_express7.Router)();
router7.use(authMiddleware);
router7.get("/", list4);
router7.post("/", create3);
router7.put("/:id", update3);

// src/jobs/fecharPontos.ts
async function fecharPontosAbertos() {
  const hoje2 = getHojeEmSaoPaulo();
  const agoraEmSP = getAgoraEmSaoPaulo();
  const horarioEncerramento = agoraEmSP.set({ hour: 22, minute: 0, second: 0, millisecond: 0 }).toJSDate();
  const pontosAbertos = await prisma.ponto.findMany({
    where: {
      date: hoje2,
      entrada: { not: null },
      saida: null
    },
    include: { user: { select: { id: true, name: true } } }
  });
  if (pontosAbertos.length === 0) {
    console.log("\u2705 Nenhum ponto aberto para encerrar");
    return { encerrados: 0, usuarios: [] };
  }
  const resultado = await prisma.ponto.updateMany({
    where: {
      id: { in: pontosAbertos.map((p) => p.id) }
    },
    data: {
      saida: horarioEncerramento,
      encerramentoAutomatico: true
    }
  });
  const usuarios = pontosAbertos.map((p) => ({
    id: p.user.id,
    name: p.user.name,
    entrada: p.entrada
  }));
  console.log(`\u23F0 ${resultado.count} pontos encerrados automaticamente \xE0s 22h (hor\xE1rio de Bras\xEDlia)`);
  usuarios.forEach((u) => {
    console.log(`   \u2192 ${u.name}`);
  });
  return { encerrados: resultado.count, usuarios };
}

// src/server.ts
process.env.TZ = "UTC";
var app = (0, import_express8.default)();
var allowedOrigins = Array.from(/* @__PURE__ */ new Set([
  env.FRONTEND_URL,
  ...env.FRONTEND_URLS.split(",").map((origin) => origin.trim()).filter(Boolean)
]));
console.log(`\u{1F310} CORS origin configurado: ${env.FRONTEND_URL}`);
console.log(`\u{1F310} CORS origins permitidos: ${allowedOrigins.join(", ")}`);
console.log(`\u{1F527} NODE_ENV: ${env.NODE_ENV}`);
app.use((0, import_cors.default)({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin n\xE3o permitida pelo CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(import_express8.default.json());
app.use("/uploads", import_express8.default.static(env.UPLOAD_DIR));
app.use("/api/auth", router);
app.use("/api/users", router2);
app.use("/api/pontos", router3);
app.use("/api/artes", router4);
app.use("/api/pricing", router6);
app.use("/api/vendas", router7);
app.use("/api/checklist", router5);
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.use(errorHandler);
app.listen(env.PORT, () => {
  console.log(`\u{1F680} Gr\xE1ficaOS API rodando na porta ${env.PORT}`);
});
import_node_cron.default.schedule("0 22 * * *", async () => {
  console.log("\u{1F559} Iniciando job de encerramento autom\xE1tico de pontos...");
  try {
    await fecharPontosAbertos();
  } catch (err) {
    console.error("\u274C Erro no job de encerramento:", err);
  }
}, { timezone: "America/Sao_Paulo" });
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  app
});
