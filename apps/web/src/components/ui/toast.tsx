import { useToastStore } from '@/stores/toastStore';

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.removing ? 'removing' : ''}`}>
          <span className="toast-icon">{t.icon}</span>
          <div className="toast-msg">
            <strong>{t.title}</strong>
            {t.message && <span>{t.message}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
