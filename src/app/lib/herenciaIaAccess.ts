export const HERENCIA_IA_ACCESS_RULES = {
  visitorDailyLimit: 2,
  registeredCustomerDailyLimit: 5,
  vipMinimumPlantSpend: 50,
};

export function getHerenciaIaDailyLimit(registered = false) {
  return registered
    ? HERENCIA_IA_ACCESS_RULES.registeredCustomerDailyLimit
    : HERENCIA_IA_ACCESS_RULES.visitorDailyLimit;
}

export function isHerenciaIaVip(plantSpend: number) {
  return Number(plantSpend || 0) >= HERENCIA_IA_ACCESS_RULES.vipMinimumPlantSpend;
}

export function getHerenciaIaAccessMessage({
  email,
  registered = false,
  plantSpend = 0,
  remainingMessages = 0,
}: {
  email?: string;
  registered?: boolean;
  plantSpend?: number;
  remainingMessages?: number;
}) {
  if (isHerenciaIaVip(plantSpend)) {
    return "Acceso VIP sin límite diario: has superado 50 € en compras pagadas de plantas.";
  }

  if (remainingMessages <= 0) {
    return "Has consumido tus mensajes de Herenc(IA) de hoy. Vuelve mañana o supera 50 € en compras pagadas de plantas para seguir usándola.";
  }

  if (!email) return "Acceso de visitante disponible.";

  if (!registered) {
    return "Ese correo no figura todavía como cliente registrado. Se aplica el límite de visitante.";
  }

  return "Acceso de cliente registrado disponible.";
}
