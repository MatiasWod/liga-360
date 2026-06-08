/** Genera un id legible y razonablemente único con prefijo de tipo (t-, c-, s-, m-, ...). */
export function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
