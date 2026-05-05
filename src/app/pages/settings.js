import { backendStorage } from '../lib/backendStorage'

export async function guardarClaveStripe(valor) {
  const current = JSON.parse(backendStorage.getItem('stripeSettings') || '{}')
  backendStorage.setItem('stripeSettings', JSON.stringify({ ...current, publishableKey: valor, enabled: true }))
}

export async function cargarClaveStripe() {
  const current = JSON.parse(backendStorage.getItem('stripeSettings') || '{}')
  return current.publishableKey || null
}
