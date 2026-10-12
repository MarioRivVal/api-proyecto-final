import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';

// Conexión para el CLI de migraciones. En desarrollo carga los .ts de src/ y en el
// contenedor los .js de dist/.
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
});
