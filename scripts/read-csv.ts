import { readFileSync } from 'fs';
import { join } from 'path';

export type CsvRow = Record<string, string>;

// Lee data/<fichero> y devuelve una fila por objeto, con la cabecera como claves
export function readCsv(fileName: string): CsvRow[] {
  const text = readFileSync(join(__dirname, '..', 'data', fileName), 'utf8');
  // trim() también quita la marca invisible (BOM) que a veces pone Excel al principio
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const columns = header.split(';');

  return lines.map((line) => {
    const values = line.split(';');
    const row: CsvRow = {};
    columns.forEach((column, i) => {
      row[column] = (values[i] ?? '').trim();
    });
    return row;
  });
}
