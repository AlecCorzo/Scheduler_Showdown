// Mismos colores fijos que componentes/Gantt.tsx para el escenario de
// ejemplo (Ana/Beto/Caro/Dani), más una paleta de respaldo para cualquier
// otro nombre que se escriba en el simulador.
const FIJOS: Record<string, string> = {
  Ana: '#9b8cff',
  Beto: '#4fd1d9',
  Caro: '#ff9f5a',
  Dani: '#f06aae',
};

const RESPALDO = ['#9b8cff', '#4fd1d9', '#ff9f5a', '#f06aae', '#c4e17f', '#ff6f6f', '#6fa8ff', '#e0b0ff'];

export function coloresPorProceso(nombres: string[]): Record<string, string> {
  const resultado: Record<string, string> = {};
  let siguiente = 0;
  for (const nombre of nombres) {
    if (FIJOS[nombre]) {
      resultado[nombre] = FIJOS[nombre]!;
    } else {
      resultado[nombre] = RESPALDO[siguiente % RESPALDO.length]!;
      siguiente++;
    }
  }
  return resultado;
}
