import { useEffect, useState } from 'react';

interface Props {
  restanteMs: number | null;
  recibidoEn: number;
}

export function Cronometro({ restanteMs, recibidoEn }: Props) {
  const [ahora, setAhora] = useState(() => performance.now());

  useEffect(() => {
    if (restanteMs === null) return;
    const id = setInterval(() => setAhora(performance.now()), 250);
    return () => clearInterval(id);
  }, [restanteMs, recibidoEn]);

  if (restanteMs === null) return null;

  const transcurrido = ahora - recibidoEn;
  const restante = Math.max(0, restanteMs - transcurrido);
  const segundos = Math.ceil(restante / 1000);

  return <div className="cronometro">{segundos}</div>;
}
