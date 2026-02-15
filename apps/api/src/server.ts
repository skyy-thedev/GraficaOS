import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { authRoutes } from './routes/auth.routes';
import { userRoutes } from './routes/user.routes';
import { pontoRoutes } from './routes/ponto.routes';
import { arteRoutes } from './routes/arte.routes';

const app = express();

// Log CORS origin para debug em produção
console.log(`🌐 CORS origin configurado: ${env.FRONTEND_URL}`);
console.log(`🔧 NODE_ENV: ${env.NODE_ENV}`);

// Middlewares globais
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use('/uploads', express.static(env.UPLOAD_DIR));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/pontos', pontoRoutes);
app.use('/api/artes', arteRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Middleware de tratamento de erros (sempre por último)
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`🚀 GráficaOS API rodando na porta ${env.PORT}`);
});

export { app };
