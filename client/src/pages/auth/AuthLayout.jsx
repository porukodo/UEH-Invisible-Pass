export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-card p-6 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-ueh-green flex items-center justify-center text-white font-black text-xl">
            UIP
          </div>
          <h1 className="text-lg font-bold text-slate-800">{title}</h1>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
