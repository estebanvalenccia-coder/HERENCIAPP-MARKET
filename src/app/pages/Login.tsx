import { useEffect, useState } from "react";
import { Mail, Lock, User, Phone, MapPin } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import logo from "figma:asset/8c5f2b4f88c45fd4812e5bb91610bff5272333d7.png";
import { backendApi, backendStorage } from "../lib/backendStorage";

function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
function readSavedUser() { try { return JSON.parse(backendStorage.getItem("user") || "null"); } catch { return null; } }

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.22c0-.74-.07-1.46-.2-2.15H12v4.07h5.23a4.47 4.47 0 0 1-1.94 2.93v2.43h3.14c1.84-1.69 2.92-4.19 2.92-7.28Z"/>
      <path fill="#34A853" d="M12 21.72c2.63 0 4.84-.87 6.45-2.36l-3.14-2.43c-.87.58-1.99.93-3.31.93-2.54 0-4.69-1.71-5.46-4.01H3.3v2.5A9.73 9.73 0 0 0 12 21.72Z"/>
      <path fill="#FBBC05" d="M6.54 13.85a5.86 5.86 0 0 1 0-3.7v-2.5H3.3a9.73 9.73 0 0 0 0 8.7l3.24-2.5Z"/>
      <path fill="#EA4335" d="M12 6.14c1.43 0 2.72.49 3.73 1.45l2.79-2.79A9.36 9.36 0 0 0 12 2.28 9.73 9.73 0 0 0 3.3 7.65l3.24 2.5c.77-2.3 2.92-4.01 5.46-4.01Z"/>
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#1877F2"/>
      <path fill="#fff" d="M13.36 20v-7h2.35l.35-2.73h-2.7V8.53c0-.79.22-1.33 1.35-1.33h1.44V4.76c-.25-.03-1.1-.1-2.09-.1-2.07 0-3.49 1.26-3.49 3.58v2.03H8.23V13h2.34v7h2.79Z"/>
    </svg>
  );
}

export function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "facebook" | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [formData, setFormData] = useState({ name:"", email:"", phone:"", address:"", password:"" });
  const navigate = useNavigate();

  useEffect(() => {
    backendApi.customerSession().then(async session => {
      if (session.authenticated && session.user) {
        await backendStorage.setItem("user", JSON.stringify({ ...session.user, isLoggedIn:true }));
        navigate("/perfil");
      }
    }).catch(()=>{});

    const params = new URLSearchParams(window.location.search);
    const socialError = params.get("social_error");
    if (socialError) {
      toast.error(socialError);
      window.history.replaceState({}, "", window.location.pathname);
    }

    const savedUser = readSavedUser();
    if (savedUser?.email) setFormData(prev => ({ ...prev, name:savedUser.name||"", email:savedUser.email||"", phone:savedUser.phone||"", address:savedUser.address||"" }));
  }, []);

  const handleSocialLogin = (provider: "google" | "facebook") => {
    setSocialLoading(provider);
    window.location.assign(`/api/customer/oauth/${provider}`);
  };

  const handleForgotPassword = async () => {
    const email = normalizeEmail(formData.email);
    if (!email) { toast.error("Escribe primero el correo de tu cuenta"); return; }
    try {
      setResetLoading(true);
      const response = await fetch("/api/customer/password/forgot", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) });
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || "No se pudo enviar el correo");
      toast.success(data.message || "Revisa tu correo para recuperar la contraseña");
    } catch (error:any) { toast.error(error?.message || "No se pudo enviar el correo de recuperación"); }
    finally { setResetLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = normalizeEmail(formData.email);
    if (!email || !formData.password) { toast.error("Completa email y contraseña"); return; }
    if (!isLogin && !formData.name.trim()) { toast.error("Escribe tu nombre completo"); return; }
    try {
      setLoading(true);
      const response = isLogin
        ? await backendApi.customerLogin({ email, password:formData.password })
        : await backendApi.customerRegister({ name:formData.name.trim(), email, password:formData.password, phone:formData.phone.trim(), address:formData.address.trim() });
      await backendStorage.setItem("user", JSON.stringify({ ...response.user, isLoggedIn:true }));
      toast.success(isLogin ? "¡Bienvenido de vuelta!" : "¡Cuenta creada exitosamente!");
      navigate("/perfil");
    } catch (error:any) { toast.error(error?.message || "No se pudo iniciar sesión"); }
    finally { setLoading(false); }
  };

  const inputClass = "w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary";
  const socialButtonClass = "w-full flex items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted/60 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/30 via-background to-muted/20 px-4 py-12">
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="w-full max-w-md">
        <div className="bg-card/95 backdrop-blur border border-border rounded-3xl p-7 sm:p-8 shadow-xl">
          <div className="flex justify-center mb-7">
            <img src={logo} alt="Herencia Floristería" className="h-20 w-auto"/>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">{isLogin ? "Bienvenido a Herencia" : "Crea tu cuenta"}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {isLogin ? "Accede a tus pedidos, favoritos y perfil." : "Guarda tus pedidos, favoritos y datos de compra."}
            </p>
          </div>

          <div className="flex gap-2 mb-6 bg-muted p-1 rounded-xl">
            <button type="button" onClick={()=>setIsLogin(true)} className={`flex-1 py-2 rounded-lg transition ${isLogin?"bg-background text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`}>Iniciar sesión</button>
            <button type="button" onClick={()=>setIsLogin(false)} className={`flex-1 py-2 rounded-lg transition ${!isLogin?"bg-background text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`}>Registrarse</button>
          </div>

          <div className="space-y-3 mb-6">
            <button type="button" disabled={socialLoading !== null} onClick={()=>handleSocialLogin("google")} className={socialButtonClass}>
              <GoogleLogo />
              <span>{socialLoading === "google" ? "Conectando con Google…" : "Continuar con Google"}</span>
            </button>
            <button type="button" disabled={socialLoading !== null} onClick={()=>handleSocialLogin("facebook")} className={socialButtonClass}>
              <FacebookLogo />
              <span>{socialLoading === "facebook" ? "Conectando con Facebook…" : "Continuar con Facebook"}</span>
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border"/></div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-[0.14em]"><span className="bg-card px-3 text-muted-foreground">o continúa con email</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && <div><label className="block text-sm font-medium mb-2">Nombre completo</label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"/><input type="text" value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})} placeholder="Tu nombre" required className={inputClass}/></div></div>}
            <div><label className="block text-sm font-medium mb-2">Correo electrónico</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"/><input type="email" value={formData.email} onChange={e=>setFormData({...formData,email:e.target.value})} placeholder="tu@email.com" required className={inputClass}/></div></div>
            {!isLogin && <><div><label className="block text-sm font-medium mb-2">Teléfono</label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"/><input type="tel" value={formData.phone} onChange={e=>setFormData({...formData,phone:e.target.value})} placeholder="+34 600 000 000" className={inputClass}/></div></div><div><label className="block text-sm font-medium mb-2">Dirección habitual</label><div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"/><input type="text" value={formData.address} onChange={e=>setFormData({...formData,address:e.target.value})} placeholder="Calle, número, ciudad" className={inputClass}/></div></div></>}
            <div><label className="block text-sm font-medium mb-2">Contraseña</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"/><input type="password" value={formData.password} onChange={e=>setFormData({...formData,password:e.target.value})} placeholder="••••••••" required className={inputClass}/></div></div>
            {isLogin && <div className="text-right"><button type="button" onClick={handleForgotPassword} disabled={resetLoading} className="text-sm text-primary hover:underline disabled:opacity-50">{resetLoading?"Enviando enlace...":"¿Olvidaste tu contraseña?"}</button></div>}
            <button type="submit" disabled={loading || socialLoading !== null} className="w-full py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-medium shadow-sm transition disabled:opacity-60">{loading?"Conectando...":isLogin?"Iniciar sesión":"Crear cuenta"}</button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isLogin?"¿No tienes cuenta? ":"¿Ya tienes cuenta? "}
            <button onClick={()=>setIsLogin(!isLogin)} className="text-primary font-medium hover:underline">{isLogin?"Regístrate":"Inicia sesión"}</button>
          </p>
          <p className="text-center text-xs text-muted-foreground mt-4 leading-relaxed">
            Al continuar aceptas las condiciones de Herencia y su política de privacidad.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
