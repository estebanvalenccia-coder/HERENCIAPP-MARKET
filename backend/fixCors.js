const defaultOrigins = [
  "https://www.herenciamarket.es",
  "https://herenciamarket.es",
  "https://herenciapp-market.vercel.app",
];

const localPorts = ["5173", "5174", "4173", "3000", "8080"];
const localHosts = ["localhost", "127.0.0.1"];

const localNetworkHosts = [];
for (const subnet of ["192.168.0", "192.168.1", "10.0.0", "172.16.0"]) {
  for (let i = 1; i <= 254; i += 1) {
    localNetworkHosts.push(`${subnet}.${i}`);
  }
}

const localOrigins = [...localHosts, ...localNetworkHosts].flatMap((host) =>
  localPorts.map((port) => `http://${host}:${port}`)
);

const existingOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

process.env.CORS_ORIGIN = Array.from(
  new Set([...existingOrigins, ...defaultOrigins, ...localOrigins])
).join(",");

console.log("CORS preparado para Herencia Market, Vercel y tablet FLORES en red local.");
