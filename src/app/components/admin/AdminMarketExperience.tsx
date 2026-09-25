import { Home, Layers3, MapPin, Shirt, Sparkles, Store, WandSparkles } from "lucide-react";
import type { SiteContent } from "../../lib/siteContent";
import {
  getMarketExperience,
  type MarketExperienceContent,
  withMarketExperience,
} from "../../lib/marketExperience";

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      )}
    </label>
  );
}

function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Field label={label} value={value} onChange={onChange} />
      {value ? (
        <img
          src={value}
          alt=""
          className="h-32 w-full rounded-xl border border-border object-cover"
        />
      ) : null}
    </div>
  );
}

export function AdminMarketExperience({
  site,
  onChange,
}: {
  site: SiteContent;
  onChange: (site: SiteContent) => void;
}) {
  const market = getMarketExperience(site);

  const setMarket = (next: MarketExperienceContent) => {
    onChange(withMarketExperience(site, next));
  };

  const patch = (value: Partial<MarketExperienceContent>) => {
    setMarket({ ...market, ...value });
  };

  const patchHome = (value: Partial<MarketExperienceContent["home"]>) => {
    setMarket({ ...market, home: { ...market.home, ...value } });
  };

  const patchPromo = (
    kind: "dulce" | "moda",
    value: Partial<MarketExperienceContent["dulce"]>
  ) => {
    setMarket({ ...market, [kind]: { ...market[kind], ...value } } as MarketExperienceContent);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-[#dce6dc] bg-[#fbfaf6] shadow-sm">
      <div className="border-b border-[#dce6dc] bg-gradient-to-r from-[#173d2a] to-[#315b42] px-6 py-5 text-white">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-white/75">
              <Layers3 className="h-4 w-4" />
              Frontend sincronizado
            </div>
            <h3 className="mt-2 text-2xl font-black">HERENCIA MARKET · Contenido visible</h3>
            <p className="mt-1 max-w-3xl text-sm text-white/80">
              Esta zona corresponde directamente a la nueva cara de la tienda. Lo que edites aquí cambia
              Inicio, Servicios, Dulce, Moda, Nosotros y HERENCIA SALES al publicar.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold">
            Frontend ⇄ Administración
          </div>
        </div>
      </div>

      <div className="space-y-8 p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="mb-4 flex items-center gap-2 font-black">
              <MapPin className="h-5 w-5 text-primary" />
              Ubicación y franja superior
            </div>
            <div className="space-y-4">
              <Field
                label="Ubicación pública"
                value={market.locationLabel}
                onChange={(locationLabel) => patch({ locationLabel })}
              />
              <Field
                label="Mensaje superior"
                value={market.announcement}
                onChange={(announcement) => patch({ announcement })}
                multiline
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="mb-4 flex items-center gap-2 font-black">
              <Store className="h-5 w-5 text-primary" />
              Menú principal
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {market.navigation.map((item, index) => (
                <div key={index} className="rounded-xl border border-border bg-[#fbfaf6] p-3">
                  <Field
                    label={`Enlace ${index + 1} · texto`}
                    value={item.label}
                    onChange={(label) => {
                      const navigation = market.navigation.map((current, i) =>
                        i === index ? { ...current, label } : current
                      );
                      patch({ navigation });
                    }}
                  />
                  <div className="mt-2">
                    <Field
                      label="Destino"
                      value={item.href}
                      onChange={(href) => {
                        const navigation = market.navigation.map((current, i) =>
                          i === index ? { ...current, href } : current
                        );
                        patch({ navigation });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="mb-5 flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-black">Inicio · Hero y estructura principal</h4>
              <p className="text-sm text-muted-foreground">
                La fotografía principal debe representar hogar, naturaleza y estilo de vida; no un ramo como protagonista.
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <Field label="Texto pequeño" value={market.home.kicker} onChange={(kicker) => patchHome({ kicker })} />
              <Field label="Título principal" value={market.home.title} onChange={(title) => patchHome({ title })} />
              <Field
                label="Descripción"
                value={market.home.description}
                onChange={(description) => patchHome({ description })}
                multiline
              />
              <Field
                label="Título de categorías"
                value={market.home.categoriesTitle}
                onChange={(categoriesTitle) => patchHome({ categoriesTitle })}
              />
              <Field
                label="Título de servicios"
                value={market.home.servicesTitle}
                onChange={(servicesTitle) => patchHome({ servicesTitle })}
              />
              <Field
                label="Título de productos destacados"
                value={market.home.featuredTitle}
                onChange={(featuredTitle) => patchHome({ featuredTitle })}
              />
              <Field
                label="Texto de productos destacados"
                value={market.home.featuredSubtitle}
                onChange={(featuredSubtitle) => patchHome({ featuredSubtitle })}
                multiline
              />
            </div>
            <ImageField
              label="Foto principal · URL"
              value={market.home.heroImageUrl}
              onChange={(heroImageUrl) => patchHome({ heroImageUrl })}
            />
          </div>

          <div className="mt-6">
            <p className="mb-3 font-black">Categorías visibles en Inicio</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {market.home.categories.map((category, index) => (
                <div key={index} className="space-y-3 rounded-2xl border border-border bg-[#fbfaf6] p-4">
                  <Field
                    label="Nombre"
                    value={category.title}
                    onChange={(title) => {
                      const categories = market.home.categories.map((item, i) =>
                        i === index ? { ...item, title } : item
                      );
                      patchHome({ categories });
                    }}
                  />
                  <Field
                    label="Texto corto"
                    value={category.subtitle}
                    onChange={(subtitle) => {
                      const categories = market.home.categories.map((item, i) =>
                        i === index ? { ...item, subtitle } : item
                      );
                      patchHome({ categories });
                    }}
                  />
                  <Field
                    label="Destino"
                    value={category.href}
                    onChange={(href) => {
                      const categories = market.home.categories.map((item, i) =>
                        i === index ? { ...item, href } : item
                      );
                      patchHome({ categories });
                    }}
                  />
                  <ImageField
                    label="Imagen · URL"
                    value={category.imageUrl}
                    onChange={(imageUrl) => {
                      const categories = market.home.categories.map((item, i) =>
                        i === index ? { ...item, imageUrl } : item
                      );
                      patchHome({ categories });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-3 font-black">Servicios visibles en Inicio</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {market.home.services.map((service, index) => (
                <div key={index} className="space-y-3 rounded-2xl border border-border bg-[#fbfaf6] p-4">
                  <Field
                    label="Servicio"
                    value={service.title}
                    onChange={(title) => {
                      const services = market.home.services.map((item, i) =>
                        i === index ? { ...item, title } : item
                      );
                      patchHome({ services });
                    }}
                  />
                  <Field
                    label="Descripción"
                    value={service.subtitle}
                    onChange={(subtitle) => {
                      const services = market.home.services.map((item, i) =>
                        i === index ? { ...item, subtitle } : item
                      );
                      patchHome({ services });
                    }}
                    multiline
                  />
                  <Field
                    label="Destino"
                    value={service.href}
                    onChange={(href) => {
                      const services = market.home.services.map((item, i) =>
                        i === index ? { ...item, href } : item
                      );
                      patchHome({ services });
                    }}
                  />
                  <Field
                    label="Texto del botón"
                    value={service.ctaLabel}
                    onChange={(ctaLabel) => {
                      const services = market.home.services.map((item, i) =>
                        i === index ? { ...item, ctaLabel } : item
                      );
                      patchHome({ services });
                    }}
                  />
                  <ImageField
                    label="Imagen · URL"
                    value={service.imageUrl}
                    onChange={(imageUrl) => {
                      const services = market.home.services.map((item, i) =>
                        i === index ? { ...item, imageUrl } : item
                      );
                      patchHome({ services });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-3 font-black">Beneficios visibles en Inicio</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {market.home.trust.map((item, index) => (
                <div key={index} className="space-y-3 rounded-2xl border border-border bg-[#fbfaf6] p-4">
                  <Field
                    label="Título"
                    value={item.title}
                    onChange={(title) => {
                      const trust = market.home.trust.map((current, i) =>
                        i === index ? { ...current, title } : current
                      );
                      patchHome({ trust });
                    }}
                  />
                  <Field
                    label="Descripción"
                    value={item.description}
                    onChange={(description) => {
                      const trust = market.home.trust.map((current, i) =>
                        i === index ? { ...current, description } : current
                      );
                      patchHome({ trust });
                    }}
                    multiline
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="mb-5">
            <h4 className="font-black">Página de Servicios y Contacto</h4>
            <p className="text-sm text-muted-foreground">
              Estos campos están conectados a las nuevas ventanas del frontend.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-border bg-[#fbfaf6] p-4">
              <p className="font-black">Servicios</p>
              <Field
                label="Título de página"
                value={site.servicesPage.title}
                onChange={(title) =>
                  onChange({ ...site, servicesPage: { ...site.servicesPage, title } })
                }
              />
              <Field
                label="Subtítulo"
                value={site.servicesPage.subtitle}
                onChange={(subtitle) =>
                  onChange({ ...site, servicesPage: { ...site.servicesPage, subtitle } })
                }
                multiline
              />
            </div>
            <div className="space-y-4 rounded-xl border border-border bg-[#fbfaf6] p-4">
              <p className="font-black">Contacto</p>
              <Field
                label="Título de página"
                value={site.contactPage.title}
                onChange={(title) =>
                  onChange({ ...site, contactPage: { ...site.contactPage, title } })
                }
              />
              <Field
                label="Subtítulo"
                value={site.contactPage.subtitle}
                onChange={(subtitle) =>
                  onChange({ ...site, contactPage: { ...site.contactPage, subtitle } })
                }
                multiline
              />
              <Field
                label="Título del formulario"
                value={site.contactPage.helpTitle}
                onChange={(helpTitle) =>
                  onChange({ ...site, contactPage: { ...site.contactPage, helpTitle } })
                }
              />
              <Field
                label="Texto del formulario"
                value={site.contactPage.helpIntro}
                onChange={(helpIntro) =>
                  onChange({ ...site, contactPage: { ...site.contactPage, helpIntro } })
                }
                multiline
              />
            </div>
          </div>
        </div>

        {(["dulce", "moda"] as const).map((kind) => {
          const promo = market[kind];
          const Icon = kind === "dulce" ? Sparkles : Shirt;
          return (
            <div key={kind} className="rounded-2xl border border-border bg-white p-5">
              <div className="mb-5 flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <h4 className="font-black">{kind === "dulce" ? "Dulce" : "Moda"} · portada y banner</h4>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-4">
                  <Field label="Texto pequeño" value={promo.kicker} onChange={(kicker) => patchPromo(kind, { kicker })} />
                  <Field label="Título de banner" value={promo.title} onChange={(title) => patchPromo(kind, { title })} />
                  <Field label="Descripción de banner" value={promo.subtitle} onChange={(subtitle) => patchPromo(kind, { subtitle })} multiline />
                  <Field label="Título de página" value={promo.pageTitle} onChange={(pageTitle) => patchPromo(kind, { pageTitle })} />
                  <Field label="Subtítulo de página" value={promo.pageSubtitle} onChange={(pageSubtitle) => patchPromo(kind, { pageSubtitle })} multiline />
                  <Field label="Texto del botón" value={promo.buttonLabel} onChange={(buttonLabel) => patchPromo(kind, { buttonLabel })} />
                  <Field label="Destino" value={promo.href} onChange={(href) => patchPromo(kind, { href })} />
                </div>
                <ImageField label="Imagen · URL" value={promo.imageUrl} onChange={(imageUrl) => patchPromo(kind, { imageUrl })} />
              </div>
            </div>
          );
        })}

        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="mb-5 flex items-center gap-2">
            <WandSparkles className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-black">HERENCIA SALES · “Crear con Herencia”</h4>
              <p className="text-sm text-muted-foreground">
                Este es el chat comercial del frontend. No es asesoría gratuita: está orientado a crear, encontrar y vender.
              </p>
            </div>
          </div>
          <label className="mb-5 flex items-center gap-3 rounded-xl bg-[#f2f5ef] p-4 font-bold">
            <input
              type="checkbox"
              checked={market.sales.enabled}
              onChange={(event) =>
                setMarket({ ...market, sales: { ...market.sales, enabled: event.target.checked } })
              }
            />
            Mostrar “Crear con Herencia”
          </label>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field
              label="Texto del botón flotante"
              value={market.sales.buttonLabel}
              onChange={(buttonLabel) => setMarket({ ...market, sales: { ...market.sales, buttonLabel } })}
            />
            <Field
              label="Título del chat"
              value={market.sales.title}
              onChange={(title) => setMarket({ ...market, sales: { ...market.sales, title } })}
            />
            <Field
              label="Pregunta inicial"
              value={market.sales.prompt}
              onChange={(prompt) => setMarket({ ...market, sales: { ...market.sales, prompt } })}
            />
            <Field
              label="Texto inferior"
              value={market.sales.helperText}
              onChange={(helperText) => setMarket({ ...market, sales: { ...market.sales, helperText } })}
            />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {market.sales.quickActions.map((action, index) => (
              <div key={action.id} className="rounded-xl border border-border bg-[#fbfaf6] p-3">
                <Field
                  label={`Acción ${index + 1}`}
                  value={action.label}
                  onChange={(label) => {
                    const quickActions = market.sales.quickActions.map((item, i) =>
                      i === index ? { ...item, label } : item
                    );
                    setMarket({ ...market, sales: { ...market.sales, quickActions } });
                  }}
                />
                {action.id !== "photo" ? (
                  <div className="mt-2">
                    <Field
                      label="Prompt comercial"
                      value={action.prompt}
                      onChange={(prompt) => {
                        const quickActions = market.sales.quickActions.map((item, i) =>
                          i === index ? { ...item, prompt } : item
                        );
                        setMarket({ ...market, sales: { ...market.sales, quickActions } });
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="mb-5 flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <h4 className="font-black">Sobre Herencia</h4>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <Field label="Texto pequeño" value={market.about.kicker} onChange={(kicker) => setMarket({ ...market, about: { ...market.about, kicker } })} />
              <Field label="Título" value={market.about.title} onChange={(title) => setMarket({ ...market, about: { ...market.about, title } })} />
              <Field label="Descripción" value={market.about.description} onChange={(description) => setMarket({ ...market, about: { ...market.about, description } })} multiline />
            </div>
            <ImageField label="Imagen · URL" value={market.about.imageUrl} onChange={(imageUrl) => setMarket({ ...market, about: { ...market.about, imageUrl } })} />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {market.about.values.map((value, index) => (
              <div key={index} className="space-y-3 rounded-xl border border-border bg-[#fbfaf6] p-4">
                <Field
                  label="Valor / título"
                  value={value.title}
                  onChange={(title) => {
                    const values = market.about.values.map((current, i) =>
                      i === index ? { ...current, title } : current
                    );
                    setMarket({ ...market, about: { ...market.about, values } });
                  }}
                />
                <Field
                  label="Descripción"
                  value={value.description}
                  onChange={(description) => {
                    const values = market.about.values.map((current, i) =>
                      i === index ? { ...current, description } : current
                    );
                    setMarket({ ...market, about: { ...market.about, values } });
                  }}
                  multiline
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
