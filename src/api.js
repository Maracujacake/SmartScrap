export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Não foi possível carregar os dados.');
    error.status = response.status;
    throw error;
  }
  return data;
}
export const number = (value, digits = 1) => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: digits });
export const currency = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const lotCode = id => `SS-${new Date().getFullYear()}-${String(id).padStart(4,'0')}`;
export const dateLabel = date => date ? new Date(`${date.slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','') : 'A definir';
export const initials = name => (name || '').split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('');
export const materialColors = { 'Aço':'#078563', 'Ferro':'#31c6a5', 'Alumínio':'#54a7ee', 'Cobre':'#eda66d', 'Inox':'#8a9cb4', 'Outros':'#c8d1dd' };
