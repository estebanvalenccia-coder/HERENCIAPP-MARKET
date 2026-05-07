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
  if (email && !isHerenciaIaVip(totalPaid)) {
    return "Herenc(IA) está reservado para clientes con más de 50 € en compras pagadas.";
  }

  if (remainingMessages <= 0) {
    return "Has consumido tus mensajes de Herenc(IA). Para seguir usando la IA, vuelve mañana o realiza una nueva compra.";
  }

  return "Herenc(IA) disponible.";
}
