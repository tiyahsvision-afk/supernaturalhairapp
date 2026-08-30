import { useEffect, useState } from "react";
import { getExistingSubscription, pushSupported, subscribeToPush, unsubscribeFromPush } from "../lib/push";

export function NotificationsToggle() {
  const [supported] = useState(pushSupported());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    getExistingSubscription()
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, [supported]);

  if (!supported) return null;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        await subscribeToPush();
        setSubscribed(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change notification settings");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={busy}
        title={subscribed ? "Turn off notifications" : "Get notified about new deliveries and messages"}
        className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:flex ${
          subscribed ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
        } disabled:opacity-50`}
      >
        <span>{subscribed ? "🔔" : "🔕"}</span>
        {subscribed ? "Notifications on" : "Enable notifications"}
      </button>
      {error && <span className="hidden text-[11px] text-red-500 sm:inline">{error}</span>}
    </div>
  );
}
