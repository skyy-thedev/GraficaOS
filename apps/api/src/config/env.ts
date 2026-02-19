import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(25),
  PORT: z.coerce.number().default(3333),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Email (para exportação de relatórios)
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('GráficaOS <noreply@graficaos.com>'),

  // Horário considerado "pontual" (HH:MM)
  HORARIO_ENTRADA_PONTUAL: z.string().default('08:15'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
