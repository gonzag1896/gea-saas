// Filtro del buscador de clientes (corre en el navegador sobre la lista ya
// cargada). Ignora mayúsculas y acentos, y todas las palabras escritas tienen
// que aparecer en el nombre, en cualquier orden ("diaz esteban" encuentra
// "DIAZ BENITEZ ESTEBAN DANIEL"). También busca por RUT, sin importar puntos
// ni guiones. Los que empiezan con lo escrito van primero.
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const soloAlfanumerico = (s: string) => s.replace(/[^a-z0-9]/g, "");

export function filtrarClientes<T extends { nombre: string; rut?: string | null }>(clientes: T[], texto: string): T[] {
  const consulta = normalizar(texto);
  if (!consulta) return clientes;
  const palabras = consulta.split(/\s+/);
  const consultaRut = soloAlfanumerico(consulta);

  const coincidencias: { cliente: T; empieza: boolean }[] = [];
  for (const cliente of clientes) {
    const nombre = normalizar(cliente.nombre);
    const porNombre = palabras.every((p) => nombre.includes(p));
    const porRut = consultaRut.length >= 3 && cliente.rut ? soloAlfanumerico(normalizar(cliente.rut)).includes(consultaRut) : false;
    if (porNombre || porRut) coincidencias.push({ cliente, empieza: nombre.startsWith(consulta) });
  }
  // sort estable: dentro de cada grupo se conserva el orden alfabético original
  return coincidencias.sort((a, b) => Number(b.empieza) - Number(a.empieza)).map((c) => c.cliente);
}
