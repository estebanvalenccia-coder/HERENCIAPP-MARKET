export const HERENCIA_IA_ACCESS_RULES = {
  visitorDailyLimit: 2,
  registeredCustomerDailyLimit: 5,
  vipMinimumSpend: 50,
};

export function getHerenciaIaDailyLimit(email?: string) {
  return email ? HERENCIA_IA_ACCESS_RULES.registeredCustomerDailyLimit : HERENCIA_IA_ACCESS_RULES.visitorDailyLimit;
}

export function isHerenciaIaVip(totalPaid: number) {
  return Number(totalPaid || 0) >= HERENCIA_IA_ACCESS_RULES.vipMinimumSpend;
}

export function getHerenciaIaAccessMessage({
  email,
  totalPaid = 0,
  remainingMessages = 0,
}: {
  email?: string;
  totalPaid?: number;
  remainingMessages?: number;
}) {
  if (remainingMessages <= 0) {
    return "Has consumido tus mensajes de Herenc(IA) de hoy. Vuelve mañana para seguir usando el asistente.";
  }

  if (!email) {
    return "Acceso de visitante disponible.";
  }

  if (isHerenciaIaVip(totalPaid)) {
    return "Acceso VIP disponible. Gracias por ser uno de nuestros mejores clientes.";
  }

  return "Acceso de cliente disponible.";
}
