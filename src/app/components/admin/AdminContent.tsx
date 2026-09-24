import { useEffect, useState } from "react";
import { ExternalLink, Image as ImageIcon, RotateCcw, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { backendStorage } from "../../lib/backendStorage";
import { defaultSiteContent, parseSiteContent, SiteContent, SiteLink } from "../../lib/siteContent";

function readLegacyBanner(key: "heroBanner" | "ctaBanner") {
  try {
    const raw = backendStorage.getItem(key);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return String(parsed?.imageUrl || "").trim();
  } catch {
    const raw = backendStorage.getItem(key);
    return String(raw || "").startsWith("data:image/") ? String(raw) : "";
  }
}

async function compressImage(file: File, maxWidth = 1920) {
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen");
  if (file.size > 8 * 1024 * 1024) throw new Error("La imagen supera 8 MB");

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo procesar la imagen"));
    img.src = source;
  });

  const scale = Math.min(1, maxWidth / Math.max(1, image.width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no puede procesar imágenes");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-foreground">{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
      )}
    </label>
  );
}

function LinkEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: SiteLink;
  onChange: (value: SiteLink) => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-background p-4 md:grid-cols-2">
      <Field label={`${title} · texto`} value={value.label} onChange={(label) => onChange({ ...value, label })} />
      <Field label={`${title} · destino/URL`} value={value.href} onChange={(href) => onChange({ ...value, href })} placeholder="/productos o https://..." />
    </div>
  );
}

function ImageEditor({
  label,
  value,
  onChange,
  maxWidth = 1920,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxWidth?: number;
}) {
  const [working, setWorking] = useState(false);

  async function upload(file?: File) {
    if (!file) return;
    setWorking(true);
    try {
      onChange(await compressImage(file, maxWidth));
      toast.success(`${label} actualizada`);
    } catch (error: any) {
      toast.error(error?.message || "No se pudo cargar la imagen");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-3">
      <Field label={`${label} · URL`} value={value.startsWith("data:image/") ? "" : value} onChange={onChange} placeholder="https://..." />
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground">
          <Upload className="h-4 w-4" /> {working ? "Procesando..." : "Subir foto"}
          <input type="file" accept="image/*" className="hidden" disabled={working} onChange={(e) => void upload(e.target.files?.[0])} />
        </label>
        {value && <button type="button" onClick={() => onChange("")} className="rounded-xl border border-border px-4 py-2 font-bold">Quitar foto</button>}
      </div>
      {value && <img src={value} alt={label} className="h-40 w-full rounded-xl border border-border object-cover" />}
    </div>
  );
}

export function AdminContent() {
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [saving, setSaving] = useState(false);

  const load = () => {
    const next = parseSiteContent(backendStorage.getItem("siteContent"));
    const heroLegacy = readLegacyBanner("heroBanner");
    const ctaLegacy = readLegacyBanner("ctaBanner");
    setSite({
      ...next,
      hero: { ...next.hero, imageUrl: next.hero.imageUrl || heroLegacy },
      cta: { ...next.cta, imageUrl: next.cta.imageUrl || ctaLegacy },
    });
  };

  useEffect(() => {
    load();
  }, []);

  async function saveAll() {
    setSaving(true);
    try {
      const results = await Promise.all([
        backendStorage.setItem("siteContent", JSON.stringify(site)),
        site.hero.imageUrl
          ? backendStorage.setItem("heroBanner", JSON.stringify({ imageUrl: site.hero.imageUrl }))
          : backendStorage.removeItem("heroBanner"),
        site.cta.imageUrl
          ? backendStorage.setItem("ctaBanner", JSON.stringify({ imageUrl: site.cta.imageUrl }))
          : backendStorage.removeItem("ctaBanner"),
      ]);

      if (results.some((result) => !result.ok)) {
        throw new Error(results.find((result) => !result.ok)?.error || "No se pudo sincronizar todo");
      }

      toast.success("Contenido guardado en el backend y publicado");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar el contenido");
    } finally {
      setSaving(false);
    }
  }

  function resetContent() {
    if (!window.confirm("¿Restaurar los textos, enlaces e imágenes base del sitio?")) return;
    setSite(defaultSiteContent);
    toast.info("Valores base cargados. Pulsa Guardar cambios para publicarlos.");
  }

  function updateFeature(index: number, patch: Partial<SiteContent["features"][number]>) {
    setSite((current) => ({
      ...current,
      features: current.features.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function updateCategory(index: number, patch: Partial<SiteContent["categories"][number]>) {
    setSite((current) => ({
      ...current,
      categories: current.categories.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function updateFooterLink(kind: "productLinks" | "serviceLinks", index: number, value: SiteLink) {
    setSite((current) => ({
      ...current,
      footer: {
        ...current.footer,
        [kind]: current.footer[kind].map((item, i) => (i === index ? value : item)),
      },
    }));
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3"><ImageIcon className="h-6 w-6 text-primary" /></div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Editor completo del sitio</h2>
            <p className="text-muted-foreground">Cambia textos, nombres, enlaces, botones, teléfonos, direcciones, logo y fotografías del frontend.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.open("/", "_blank")} className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-bold"><ExternalLink className="h-4 w-4" /> Ver sitio</button>
          <button type="button" onClick={resetContent} className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-bold"><RotateCcw className="h-4 w-4" /> Restaurar</button>
          <button type="button" onClick={() => void saveAll()} disabled={saving} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar cambios"}</button>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-5 text-xl font-black">Marca y logo</h3>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="Nombre de la marca" value={site.brand.name} onChange={(name) => setSite({ ...site, brand: { ...site.brand, name } })} />
            <Field label="Texto alternativo del logo" value={site.brand.logoAlt} onChange={(logoAlt) => setSite({ ...site, brand: { ...site.brand, logoAlt } })} />
          </div>
          <ImageEditor label="Logo" value={site.brand.logoUrl} onChange={(logoUrl) => setSite({ ...site, brand: { ...site.brand, logoUrl } })} maxWidth={900} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-2 text-xl font-black">Menú superior y funciones</h3>
        <p className="mb-5 text-sm text-muted-foreground">Puedes cambiar tanto el nombre visible como la ruta/URL que abre cada botón.</p>
        <div className="space-y-3">
          {(["home", "products", "services", "herencia"] as const).map((key) => (
            <LinkEditor key={key} title={key === "home" ? "Inicio" : key === "products" ? "Productos" : key === "services" ? "Servicios" : "Herenc(IA)"} value={site.navigation[key]} onChange={(value) => setSite({ ...site, navigation: { ...site.navigation, [key]: value } })} />
          ))}
          <div className="grid gap-3 rounded-xl border border-border bg-background p-4 md:grid-cols-2">
            <Field label="Destino icono carrito" value={site.headerActions.cartHref} onChange={(cartHref) => setSite({ ...site, headerActions: { ...site.headerActions, cartHref } })} />
            <Field label="Destino icono usuario" value={site.headerActions.profileHref} onChange={(profileHref) => setSite({ ...site, headerActions: { ...site.headerActions, profileHref } })} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-5 text-xl font-black">Portada / Hero</h3>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="Texto pequeño" value={site.hero.eyebrow} onChange={(eyebrow) => setSite({ ...site, hero: { ...site.hero, eyebrow } })} />
            <Field label="Descripción" value={site.hero.description} onChange={(description) => setSite({ ...site, hero: { ...site.hero, description } })} multiline />
            <LinkEditor title="Botón principal" value={site.hero.primaryButton} onChange={(primaryButton) => setSite({ ...site, hero: { ...site.hero, primaryButton } })} />
            <LinkEditor title="Botón secundario" value={site.hero.secondaryButton} onChange={(secondaryButton) => setSite({ ...site, hero: { ...site.hero, secondaryButton } })} />
          </div>
          <ImageEditor label="Foto de fondo principal" value={site.hero.imageUrl} onChange={(imageUrl) => setSite({ ...site, hero: { ...site.hero, imageUrl } })} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-5 text-xl font-black">Bloques de ventajas</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {site.features.map((feature, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-border bg-background p-4">
              <p className="font-black">Bloque {index + 1}</p>
              <Field label="Título" value={feature.title} onChange={(title) => updateFeature(index, { title })} />
              <Field label="Descripción" value={feature.description} onChange={(description) => updateFeature(index, { description })} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-5 text-xl font-black">Categorías de la Home</h3>
        <div className="mb-5 grid gap-4 lg:grid-cols-2">
          <Field label="Título de sección" value={site.categoriesHeading} onChange={(categoriesHeading) => setSite({ ...site, categoriesHeading })} />
          <Field label="Descripción de sección" value={site.categoriesDescription} onChange={(categoriesDescription) => setSite({ ...site, categoriesDescription })} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {site.categories.map((category, index) => (
            <div key={index} className="space-y-4 rounded-xl border border-border bg-background p-4">
              <p className="font-black">Tarjeta {index + 1}</p>
              <Field label="Nombre" value={category.name} onChange={(name) => updateCategory(index, { name })} />
              <Field label="Destino al hacer clic" value={category.href} onChange={(href) => updateCategory(index, { href })} />
              <ImageEditor label="Foto" value={category.imageUrl} onChange={(imageUrl) => updateCategory(index, { imageUrl })} maxWidth={1200} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-5 text-xl font-black">Banner inferior que aparece en tu captura</h3>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="Título" value={site.cta.title} onChange={(title) => setSite({ ...site, cta: { ...site.cta, title } })} />
            <Field label="Subtítulo" value={site.cta.subtitle} onChange={(subtitle) => setSite({ ...site, cta: { ...site.cta, subtitle } })} multiline />
            <LinkEditor title="Botón" value={site.cta.button} onChange={(button) => setSite({ ...site, cta: { ...site.cta, button } })} />
          </div>
          <ImageEditor label="Foto de fondo del banner" value={site.cta.imageUrl} onChange={(imageUrl) => setSite({ ...site, cta: { ...site.cta, imageUrl } })} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-5 text-xl font-black">Pie de página</h3>
        <div className="space-y-5">
          <Field label="Descripción bajo el logo" value={site.footer.description} onChange={(description) => setSite({ ...site, footer: { ...site.footer, description } })} multiline />
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-border bg-background p-4">
              <Field label="Título columna productos" value={site.footer.productsTitle} onChange={(productsTitle) => setSite({ ...site, footer: { ...site.footer, productsTitle } })} />
              {site.footer.productLinks.map((item, index) => <LinkEditor key={index} title={`Enlace ${index + 1}`} value={item} onChange={(value) => updateFooterLink("productLinks", index, value)} />)}
            </div>
            <div className="space-y-3 rounded-xl border border-border bg-background p-4">
              <Field label="Título columna servicios" value={site.footer.servicesTitle} onChange={(servicesTitle) => setSite({ ...site, footer: { ...site.footer, servicesTitle } })} />
              {site.footer.serviceLinks.map((item, index) => <LinkEditor key={index} title={`Enlace ${index + 1}`} value={item} onChange={(value) => updateFooterLink("serviceLinks", index, value)} />)}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-5 text-xl font-black">Contacto, direcciones y redes</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Título de contacto" value={site.footer.contactTitle} onChange={(contactTitle) => setSite({ ...site, footer: { ...site.footer, contactTitle } })} />
          <Field label="Texto WhatsApp" value={site.footer.whatsappLabel} onChange={(whatsappLabel) => setSite({ ...site, footer: { ...site.footer, whatsappLabel } })} />
          <Field label="Número WhatsApp (con prefijo país)" value={site.footer.whatsappPhone} onChange={(whatsappPhone) => setSite({ ...site, footer: { ...site.footer, whatsappPhone } })} placeholder="34624239598" />
          <Field label="Texto botón llamar" value={site.footer.callLabel} onChange={(callLabel) => setSite({ ...site, footer: { ...site.footer, callLabel } })} />
          <Field label="Teléfono de llamada" value={site.footer.callPhone} onChange={(callPhone) => setSite({ ...site, footer: { ...site.footer, callPhone } })} />
          <Field label="Nombre de Instagram" value={site.footer.instagramLabel} onChange={(instagramLabel) => setSite({ ...site, footer: { ...site.footer, instagramLabel } })} />
          <Field label="URL de Instagram" value={site.footer.instagramUrl} onChange={(instagramUrl) => setSite({ ...site, footer: { ...site.footer, instagramUrl } })} />
          <Field label="Texto de ubicación" value={site.footer.mapsLabel} onChange={(mapsLabel) => setSite({ ...site, footer: { ...site.footer, mapsLabel } })} />
          <Field label="Dirección/URL de Google Maps" value={site.footer.mapsUrl} onChange={(mapsUrl) => setSite({ ...site, footer: { ...site.footer, mapsUrl } })} />
        </div>
        <div className="mt-5 rounded-xl border border-border bg-background p-4">
          <label className="flex items-center gap-3 font-bold">
            <input type="checkbox" checked={site.floatingWhatsapp.enabled} onChange={(e) => setSite({ ...site, floatingWhatsapp: { ...site.floatingWhatsapp, enabled: e.target.checked } })} />
            Mostrar botón flotante de WhatsApp
          </label>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Field label="Número del botón flotante" value={site.floatingWhatsapp.phone} onChange={(phone) => setSite({ ...site, floatingWhatsapp: { ...site.floatingWhatsapp, phone } })} />
            <Field label="Descripción accesible del botón" value={site.floatingWhatsapp.ariaLabel} onChange={(ariaLabel) => setSite({ ...site, floatingWhatsapp: { ...site.floatingWhatsapp, ariaLabel } })} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-5 text-xl font-black">Copyright y enlaces legales</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Copyright" value={site.footer.copyright} onChange={(copyright) => setSite({ ...site, footer: { ...site.footer, copyright } })} />
          <Field label="Crédito/desarrollador" value={site.footer.developerLabel} onChange={(developerLabel) => setSite({ ...site, footer: { ...site.footer, developerLabel } })} />
          <LinkEditor title="Privacidad" value={{ label: site.footer.privacyLabel, href: site.footer.privacyHref }} onChange={(value) => setSite({ ...site, footer: { ...site.footer, privacyLabel: value.label, privacyHref: value.href } })} />
          <LinkEditor title="Cookies" value={{ label: site.footer.cookiesLabel, href: site.footer.cookiesHref }} onChange={(value) => setSite({ ...site, footer: { ...site.footer, cookiesLabel: value.label, cookiesHref: value.href } })} />
          <LinkEditor title="Términos" value={{ label: site.footer.termsLabel, href: site.footer.termsHref }} onChange={(value) => setSite({ ...site, footer: { ...site.footer, termsLabel: value.label, termsHref: value.href } })} />
        </div>
      </section>

      <div className="sticky bottom-4 z-20 flex justify-end">
        <button type="button" onClick={() => void saveAll()} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-primary px-7 py-4 text-lg font-black text-primary-foreground shadow-2xl disabled:opacity-50">
          <Save className="h-5 w-5" /> {saving ? "Guardando..." : "Guardar y publicar"}
        </button>
      </div>
    </div>
  );
}
