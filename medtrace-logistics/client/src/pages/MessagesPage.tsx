import { Layout } from "../components/Layout";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { MessageThread } from "../components/MessageThread";
import { ChatIcon } from "../components/Icons";
import type { Driver } from "../types";

export function MessagesPage() {
  const { user } = useAuth();
  const { data } = useApi<{ drivers: Driver[] }>("/drivers");
  const myDriver = data?.drivers.find((d) => d.user_email === user?.email);

  return (
    <Layout>
      <h1 className="mb-1 flex items-center gap-2.5 text-2xl font-bold text-slate-900">
        <ChatIcon size={22} className="text-teal-600" />
        Messages
      </h1>
      <p className="mb-6 text-sm text-slate-500">Chat with dispatch about your deliveries.</p>
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-4">
        {myDriver ? (
          <MessageThread driverId={myDriver.id} driverName="dispatch" />
        ) : (
          <p className="text-sm text-slate-400">
            No driver profile linked to your account yet — ask your dispatcher to add one with this email.
          </p>
        )}
      </div>
    </Layout>
  );
}
