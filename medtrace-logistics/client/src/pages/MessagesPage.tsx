import { Layout } from "../components/Layout";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { MessageThread } from "../components/MessageThread";
import type { Driver } from "../types";

export function MessagesPage() {
  const { user } = useAuth();
  const { data } = useApi<{ drivers: Driver[] }>("/drivers");
  const myDriver = data?.drivers.find((d) => d.user_email === user?.email);

  return (
    <Layout>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Messages</h1>
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
