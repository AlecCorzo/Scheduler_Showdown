type S = [string, number, number];
type Alg = 'FCFS' | 'SJF' | 'SRTF' | 'RR';
export const FIXTURES: Record<string, {
  procesos: [string, number, number][];   // [nombre, llegada, ráfaga]
  quantum: number;
  variantes: Record<Alg, S[][]>;
  empates: Record<Alg, number[]>;          // minutosEmpate
  modoB: Record<string, Alg[]>;            // objetivo → correctasModoB
}> = {
  ejemplo: {
    procesos: [['Ana', 0, 7], ['Beto', 2, 4], ['Caro', 4, 1], ['Dani', 5, 4]], quantum: 2,
    variantes: {
      FCFS: [[['Ana', 0, 7], ['Beto', 7, 11], ['Caro', 11, 12], ['Dani', 12, 16]]],
      SJF: [
        [['Ana', 0, 7], ['Caro', 7, 8], ['Beto', 8, 12], ['Dani', 12, 16]],
        [['Ana', 0, 7], ['Caro', 7, 8], ['Dani', 8, 12], ['Beto', 12, 16]],
      ],
      SRTF: [[['Ana', 0, 2], ['Beto', 2, 4], ['Caro', 4, 5], ['Beto', 5, 7], ['Dani', 7, 11], ['Ana', 11, 16]]],
      RR: [
        [['Ana', 0, 2], ['Beto', 2, 4], ['Ana', 4, 6], ['Caro', 6, 7], ['Beto', 7, 9], ['Dani', 9, 11], ['Ana', 11, 13], ['Dani', 13, 15], ['Ana', 15, 16]],
        [['Ana', 0, 2], ['Beto', 2, 4], ['Ana', 4, 6], ['Beto', 6, 8], ['Caro', 8, 9], ['Dani', 9, 11], ['Ana', 11, 13], ['Dani', 13, 15], ['Ana', 15, 16]],
        [['Ana', 0, 4], ['Beto', 4, 6], ['Ana', 6, 8], ['Caro', 8, 9], ['Dani', 9, 11], ['Beto', 11, 13], ['Ana', 13, 14], ['Dani', 14, 16]],
        [['Ana', 0, 4], ['Beto', 4, 6], ['Caro', 6, 7], ['Ana', 7, 9], ['Dani', 9, 11], ['Beto', 11, 13], ['Ana', 13, 14], ['Dani', 14, 16]],
      ],
    },
    empates: { FCFS: [], SJF: [8], SRTF: [], RR: [2, 4] },
    modoB: { Ana: ['FCFS', 'SJF'], Beto: ['SRTF'], Caro: ['SRTF'], Dani: ['SRTF'] },
  },
  ganaFCFS: {
    procesos: [['Ana', 0, 2], ['Beto', 1, 3], ['Caro', 2, 1]], quantum: 2,
    variantes: {
      FCFS: [[['Ana', 0, 2], ['Beto', 2, 5], ['Caro', 5, 6]]],
      SJF:  [[['Ana', 0, 2], ['Caro', 2, 3], ['Beto', 3, 6]]],
      SRTF: [[['Ana', 0, 2], ['Caro', 2, 3], ['Beto', 3, 6]]],
      RR:   [[['Ana', 0, 2], ['Beto', 2, 4], ['Caro', 4, 5], ['Beto', 5, 6]]],
    },
    empates: { FCFS: [], SJF: [], SRTF: [], RR: [] },
    modoB: { Ana: ['FCFS', 'SJF', 'SRTF', 'RR'], Beto: ['FCFS'], Caro: ['SJF', 'SRTF'] },
  },
  sjfConFCFS: {
    procesos: [['Ana', 0, 4], ['Beto', 0, 3], ['Caro', 1, 1]], quantum: 2,
    variantes: {
      FCFS: [
        [['Ana', 0, 4], ['Beto', 4, 7], ['Caro', 7, 8]],
        [['Beto', 0, 3], ['Ana', 3, 7], ['Caro', 7, 8]],
      ],
      SJF:  [[['Beto', 0, 3], ['Caro', 3, 4], ['Ana', 4, 8]]],
      SRTF: [[['Beto', 0, 1], ['Caro', 1, 2], ['Beto', 2, 4], ['Ana', 4, 8]]],
      RR: [
        [['Ana', 0, 2], ['Beto', 2, 4], ['Caro', 4, 5], ['Ana', 5, 7], ['Beto', 7, 8]],
        [['Beto', 0, 2], ['Ana', 2, 4], ['Caro', 4, 5], ['Beto', 5, 6], ['Ana', 6, 8]],
      ],
    },
    empates: { FCFS: [0], SJF: [], SRTF: [], RR: [0] },
    modoB: { Ana: ['FCFS', 'RR'], Beto: ['FCFS', 'SJF'], Caro: ['SRTF'] },
  },
  ganaSRTF: {
    procesos: [['Ana', 0, 1], ['Beto', 1, 3], ['Caro', 2, 1]], quantum: 3,
    variantes: {
      FCFS: [[['Ana', 0, 1], ['Beto', 1, 4], ['Caro', 4, 5]]],
      SJF:  [[['Ana', 0, 1], ['Beto', 1, 4], ['Caro', 4, 5]]],
      SRTF: [[['Ana', 0, 1], ['Beto', 1, 2], ['Caro', 2, 3], ['Beto', 3, 5]]],
      RR:   [[['Ana', 0, 1], ['Beto', 1, 4], ['Caro', 4, 5]]],
    },
    empates: { FCFS: [], SJF: [], SRTF: [], RR: [] },
    modoB: { Ana: ['FCFS', 'SJF', 'SRTF', 'RR'], Beto: ['FCFS', 'SJF', 'RR'], Caro: ['SRTF'] },
  },
  ganaRR: {
    procesos: [['Ana', 0, 1], ['Beto', 1, 4], ['Caro', 3, 3]], quantum: 3,
    variantes: {
      FCFS: [[['Ana', 0, 1], ['Beto', 1, 5], ['Caro', 5, 8]]],
      SJF:  [[['Ana', 0, 1], ['Beto', 1, 5], ['Caro', 5, 8]]],
      SRTF: [[['Ana', 0, 1], ['Beto', 1, 5], ['Caro', 5, 8]]],
      RR:   [[['Ana', 0, 1], ['Beto', 1, 4], ['Caro', 4, 7], ['Beto', 7, 8]]],
    },
    empates: { FCFS: [], SJF: [], SRTF: [], RR: [] },
    modoB: { Ana: ['FCFS', 'SJF', 'SRTF', 'RR'], Beto: ['FCFS', 'SJF', 'SRTF'], Caro: ['RR'] },
  },
};
